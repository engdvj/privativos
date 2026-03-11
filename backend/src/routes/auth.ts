import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../services/auth-service.js";
import { AppError } from "../errors/app-error.js";
import { getBearerToken } from "../utils/auth.js";

const loginSchema = z.object({
  usuario: z.string().min(1),
  senha: z.string().min(1),
});

const solicitanteSchema = z.object({
  matricula: z.string().min(1).max(20),
});

const atualizarPerfilSchema = z.object({
  nomeCompleto: z.string().min(1).max(150).optional(),
  senhaNova: z.string().min(6).optional(),
});

const atualizarTemaSchema = z.object({
  tema: z.enum(["light", "dark"]),
});

const authService = new AuthService();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    try {
      const data = await authService.login(parsed.data);
      app.log.info({
        evento: "auth.login",
        usuario: parsed.data.usuario,
        perfil: data.perfil,
        resultado: "ok",
        ip: request.ip,
      });
      return reply.status(200).send(data);
    } catch (error) {
      app.log.warn({
        evento: "auth.login",
        usuario: parsed.data.usuario,
        resultado: "falha",
        ip: request.ip,
      });
      throw error;
    }
  });

  app.post("/auth/solicitante", async (request, reply) => {
    const parsed = solicitanteSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const data = await authService.criarSessaoSolicitante(parsed.data);
    app.log.info({
      evento: "auth.solicitante",
      matricula: parsed.data.matricula,
      resultado: "ok",
      ip: request.ip,
    });
    return reply.status(200).send(data);
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Não autenticado");
    }

    const session = await authService.validarSessao(token);
    await authService.logout(token);
    app.log.info({
      evento: "auth.logout",
      usuario:
        session?.tipo === "setor_admin"
          ? session.dados.usuario
          : session?.tipo === "solicitante"
            ? session.dados.matricula
            : null,
      ip: request.ip,
    });
    return reply.status(204).send();
  });

  app.get("/auth/session", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Não autenticado");
    }

    const session = await authService.validarSessao(token);

    if (!session) {
      throw new AppError(401, "INVALID_SESSION", "Sessão inválida");
    }

    return reply.status(200).send(session);
  });

  app.get("/auth/perfil", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Não autenticado");
    }

    const session = await authService.validarSessao(token);

    if (!session || session.tipo !== "setor_admin") {
      throw new AppError(401, "INVALID_SESSION", "Sessão inválida");
    }

    const perfil = await authService.obterPerfilUsuario(session.dados.usuario);
    return reply.status(200).send(perfil);
  });

  app.put("/auth/perfil", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Não autenticado");
    }

    const session = await authService.validarSessao(token);

    if (!session || session.tipo !== "setor_admin") {
      throw new AppError(401, "INVALID_SESSION", "Sessão inválida");
    }

    const parsed = atualizarPerfilSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const perfil = await authService.atualizarPerfil({
      usuario: session.dados.usuario,
      ...parsed.data,
    });

    app.log.info({
      evento: "auth.perfil_atualizado",
      usuario: session.dados.usuario,
      campos: Object.keys(parsed.data),
      ip: request.ip,
    });

    return reply.status(200).send(perfil);
  });

  app.put("/auth/tema", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Não autenticado");
    }

    const session = await authService.validarSessao(token);

    if (!session || session.tipo !== "setor_admin") {
      throw new AppError(401, "INVALID_SESSION", "Sessão inválida");
    }

    const parsed = atualizarTemaSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const resultado = await authService.atualizarTema(
      session.dados.usuario,
      parsed.data.tema,
    );

    app.log.info({
      evento: "auth.tema_atualizado",
      usuario: session.dados.usuario,
      tema: parsed.data.tema,
      ip: request.ip,
    });

    return reply.status(200).send(resultado);
  });
};
