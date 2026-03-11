import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { AppError } from "./errors/app-error.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { opsRoutes } from "./routes/ops.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "../../frontend/dist");
const frontendIndexFile = path.join(frontendDist, "index.html");

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  app.register(helmet, {
    // Local HTTP deploy (sem TLS): evita forcar upgrade para HTTPS dos assets do SPA.
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: null,
      },
    },
    hsts: false,
  });

  // Serve frontend build (production)
  if (existsSync(frontendDist)) {
    app.register(fastifyStatic, {
      root: frontendDist,
      prefix: "/",
      wildcard: false,
    });
  }
  app.addHook("onRequest", async (request) => {
    request.startTimeNs = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request, reply) => {
    const start = request.startTimeNs ?? 0n;
    const durationMs =
      start === 0n ? undefined : Number((process.hrtime.bigint() - start) / 1000000n);

    app.log.info({
      evento: "http.request",
      request_id: request.id,
      metodo: request.method,
      rota: request.routerPath ?? request.url,
      status: reply.statusCode,
      duracao_ms: durationMs,
      ip: request.ip,
      usuario: request.user?.usuario ?? request.user?.matricula ?? null,
      perfil: request.user?.perfil ?? (request.user?.kind === "solicitante" ? "solicitante" : null),
    });
  });
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Request-ID", request.id);
    return payload;
  });

  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(opsRoutes);
  app.register(adminRoutes);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ erro: error.message, codigo: error.code });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({ erro: "Payload inválido", detalhes: error.flatten() });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.status(409).send({ erro: "Registro duplicado", codigo: "CONFLICT" });
      }

      if (error.code === "P2003") {
        return reply.status(409).send({
          erro: "Registro possui dependências e não pode ser removido",
          codigo: "FOREIGN_KEY_CONFLICT",
        });
      }

      if (error.code === "P2025") {
        return reply.status(404).send({ erro: "Registro não encontrado", codigo: "NOT_FOUND" });
      }
    }

    app.log.error(error);
    reply.status(500).send({ erro: "Erro interno" });
  });

  // SPA fallback: rotas não-API servem index.html
  if (existsSync(frontendDist)) {
    app.setNotFoundHandler(async (request, reply) => {
      const [requestPath] = request.url.split("?");
      const spaEntryPaths = new Set([
        "/",
        "/monitor-operacao",
        "/monitor-operacao/",
        "/setor",
        "/setor/",
        "/admin",
        "/admin/",
      ]);
      const acceptHeader = request.headers.accept ?? "";
      const acceptsHtml = acceptHeader.includes("text/html");
      const isApiPath =
        requestPath === "/health" ||
        requestPath.startsWith("/auth/") ||
        requestPath.startsWith("/ops/") ||
        requestPath.startsWith("/admin/");
      const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(requestPath);

      if (spaEntryPaths.has(requestPath)) {
        return reply.sendFile("index.html");
      }

      if (isApiPath && !acceptsHtml) {
        return reply.status(404).send({ erro: "Rota nao encontrada" });
      }

      if (isStaticAsset) {
        return reply.status(404).send({ erro: "Recurso nao encontrado" });
      }

      const sendFile = (reply as unknown as { sendFile?: (fileName: string) => unknown }).sendFile;
      if (typeof sendFile === "function") {
        return reply.sendFile("index.html");
      }

      if (existsSync(frontendIndexFile)) {
        return reply.type("text/html; charset=UTF-8").send(readFileSync(frontendIndexFile, "utf-8"));
      }

      return reply.status(500).send({ erro: "Frontend indisponivel" });
    });
  }

  return app;
}

