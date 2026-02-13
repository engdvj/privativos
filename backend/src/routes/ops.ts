import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AppError } from "../errors/app-error.js";
import { sseManager } from "../sse/sse-manager.js";
import { LoanService } from "../services/loan-service.js";
import { ReturnService } from "../services/return-service.js";
import { ValidationQueueService } from "../services/validation-queue-service.js";

const queueService = new ValidationQueueService();
const loanService = new LoanService();
const returnService = new ReturnService();

const gerarCodigoSchema = z.object({
  matricula: z.string().min(1).max(20),
  tipo: z.enum(["emprestimo", "devolucao"]),
  quantidade: z.coerce.number().int().positive(),
  item_codigos: z.array(z.string().min(1).max(50)).optional(),
});

const confirmarSchema = z.object({
  matricula: z.string().min(1).max(20),
  tipo: z.enum(["emprestimo", "devolucao"]),
  codigo: z.string().regex(/^\d{6}$/),
});

const cancelarSchema = z.object({
  matricula: z.string().min(1).max(20),
  tipo: z.enum(["emprestimo", "devolucao"]),
});

export const opsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/ops/stream",
    {
      preHandler: [authenticate, authorize(["solicitante"])],
    },
    async (request, reply) => {
      const matricula = request.user?.matricula;

      if (!matricula) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao do solicitante invalida");
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });

      const unregister = sseManager.register(matricula, reply.raw);
      reply.raw.write('event: connected\ndata: {"ok":true}\n\n');

      const heartbeat = setInterval(() => {
        reply.raw.write(
          `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
        );
      }, 30000);

      const pending = await queueService.getPendingByMatricula(matricula);
      if (pending) {
        sseManager.emit(matricula, "code_generated", {
          codigo: pending.payload.codigo,
          tipo: pending.tipo,
          quantidade: pending.payload.quantidade,
          item_codigos: pending.payload.item_codigos,
        });
      }

      request.raw.on("close", () => {
        clearInterval(heartbeat);
        unregister();
      });

      return reply;
    },
  );

  app.get(
    "/ops/pending/:matricula",
    {
      preHandler: [authenticate, authorize(["solicitante"])],
    },
    async (request, reply) => {
      const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);
      const userMatricula = request.user?.matricula;

      if (!userMatricula || userMatricula !== params.matricula) {
        throw new AppError(403, "FORBIDDEN", "Matricula nao autorizada");
      }

      const pending = await queueService.getPendingByMatricula(params.matricula);

      if (!pending) {
        return reply.status(200).send({ pendente: false });
      }

      return reply.status(200).send({
        pendente: true,
        tipo: pending.tipo,
        codigo: pending.payload.codigo,
        quantidade: pending.payload.quantidade,
        item_codigos: pending.payload.item_codigos,
      });
    },
  );

  app.get(
    "/ops/status-setor/:matricula",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);
      const status = await queueService.statusSetor(params.matricula);
      return reply.status(200).send(status);
    },
  );

  app.post(
    "/ops/gerar-codigo",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const parsed = gerarCodigoSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const operador = request.user?.nomeCompleto;

      if (!operador) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao de operador invalida");
      }

      if (parsed.data.tipo === "devolucao") {
        const itemCodigos = [...new Set(parsed.data.item_codigos ?? [])];
        if (itemCodigos.length === 0) {
          throw new AppError(400, "INVALID_RETURN_ITEMS", "Devolucao exige item_codigos");
        }
        if (itemCodigos.length !== parsed.data.quantidade) {
          throw new AppError(
            400,
            "INVALID_RETURN_QUANTITY",
            "Quantidade deve ser igual ao numero de item_codigos",
          );
        }
      }

      const data = await queueService.gerarCodigo({
        matricula: parsed.data.matricula,
        tipo: parsed.data.tipo,
        quantidade: parsed.data.quantidade,
        itemCodigos: parsed.data.item_codigos,
        operadorNome: operador,
      });

      app.log.info({
        evento: "ops.gerar_codigo",
        matricula: parsed.data.matricula,
        tipo: parsed.data.tipo,
        quantidade: parsed.data.quantidade,
        operador_nome: operador,
      });

      return reply.status(200).send(data);
    },
  );

  app.post(
    "/ops/cancelar",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const parsed = cancelarSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const result = await queueService.cancelar(parsed.data);
      app.log.info({
        evento: "ops.cancelar",
        matricula: parsed.data.matricula,
        tipo: parsed.data.tipo,
        operador_nome: request.user?.nomeCompleto,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    "/ops/confirmar",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const parsed = confirmarSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const payload = await queueService.consumirCodigo(parsed.data);

      if (parsed.data.tipo === "emprestimo") {
        const result = await loanService.registrarEmprestimo({
          matricula: parsed.data.matricula,
          operadorNome: payload.operador_nome,
          quantidade: payload.quantidade,
        });

        await queueService.limparOperacao(parsed.data.matricula, parsed.data.tipo);
        await queueService.registrarResultado(parsed.data.matricula, true, "Emprestimo registrado");
        app.log.info({
          evento: "loan.created",
          matricula: parsed.data.matricula,
          itens: result.itens_emprestados,
          operador_nome: payload.operador_nome,
        });
        return reply.status(200).send(result);
      }

      const result = await returnService.registrarDevolucao({
        matricula: parsed.data.matricula,
        operadorNome: payload.operador_nome,
        itemCodigos: payload.item_codigos,
      });

      await queueService.limparOperacao(parsed.data.matricula, parsed.data.tipo);
      await queueService.registrarResultado(parsed.data.matricula, true, "Devolucao registrada");
      app.log.info({
        evento: "return.created",
        matricula: parsed.data.matricula,
        itens: result.itens_devolvidos,
        operador_nome: payload.operador_nome,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    "/ops/itens-emprestados/:matricula",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);

      const itens = await prisma.item.findMany({
        where: {
          solicitanteMatricula: params.matricula,
          status: "emprestado",
          statusAtivo: true,
        },
        select: {
          codigo: true,
          descricao: true,
        },
        orderBy: { codigo: "asc" },
      });

      return reply.status(200).send(itens);
    },
  );

  app.get(
    "/ops/funcionario/:matricula",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);

      const funcionario = await prisma.funcionario.findFirst({
        where: {
          matricula: params.matricula,
          statusAtivo: true,
        },
        select: {
          nome: true,
          setor: true,
        },
      });

      if (!funcionario) {
        throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionario nao encontrado");
      }

      const kitsEmUso = await prisma.item.count({
        where: {
          solicitanteMatricula: params.matricula,
          status: "emprestado",
          statusAtivo: true,
        },
      });

      const maxConfig = await prisma.configuracao.findUnique({
        where: { chave: "MAX_KITS_POR_FUNCIONARIO" },
        select: { valor: true },
      });

      return reply.status(200).send({
        nome: funcionario.nome,
        setor: funcionario.setor,
        kits_em_uso: kitsEmUso,
        max_kits: Number(maxConfig?.valor ?? 2),
      });
    },
  );
};
