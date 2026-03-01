import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AppError } from "../errors/app-error.js";
import { sseManager } from "../sse/sse-manager.js";
import { LoanService } from "../services/loan-service.js";
import { ReturnService } from "../services/return-service.js";
import { SectorOperationService } from "../services/sector-operation-service.js";
import { ValidationQueueService } from "../services/validation-queue-service.js";

const queueService = new ValidationQueueService();
const loanService = new LoanService();
const returnService = new ReturnService();
const sectorOperationService = new SectorOperationService();
const tamanhoSchema = z
  .string()
  .min(1)
  .max(20)
  .transform((value) => value.trim().toUpperCase());
const tipoItemSchema = z
  .string()
  .max(100)
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .refine((value) => value.length > 0, "Tipo do item invalido");

const gerarCodigoSchema = z.object({
  matricula: z.string().min(1).max(20),
  tipo: z.enum(["emprestimo", "devolucao"]),
  quantidade: z.coerce.number().int().positive(),
  tipo_item: tipoItemSchema.optional(),
  tamanho: tamanhoSchema.optional(),
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

const buscaGlobalSchema = z.object({
  q: z.string().min(1).max(150),
  modo: z.enum(["operacao", "global"]).optional().default("operacao"),
});

const buscaSugestoesSchema = z.object({
  q: z.string().min(2).max(150),
  escopo: z.enum(["operacao", "global"]).optional().default("operacao"),
});

const historicoDetalhesSchema = z.object({
  entidade: z.enum(["funcionario", "kit"]),
  id: z.string().min(1).max(50),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(3).max(100).default(25),
});

type EventoHistoricoRaw = {
  timestamp: Date;
  matricula: string;
  nomeFuncionario: string;
  itemCodigo: string;
  operadorNome: string;
};

type CicloHistorico = {
  matricula: string;
  nome_funcionario: string;
  item_codigo: string;
  saida_em: string | null;
  saida_operador: string | null;
  entrada_em: string | null;
  entrada_operador: string | null;
  duracao_horas: number | null;
  em_aberto: boolean;
};

function montarCiclosHistorico(
  solicitacoes: EventoHistoricoRaw[],
  devolucoes: EventoHistoricoRaw[],
): CicloHistorico[] {
  const pendentes = new Map<string, EventoHistoricoRaw[]>();
  const ciclos: CicloHistorico[] = [];

  const eventos = [
    ...solicitacoes.map((evento) => ({ tipo: "saida" as const, evento })),
    ...devolucoes.map((evento) => ({ tipo: "entrada" as const, evento })),
  ].sort((a, b) => a.evento.timestamp.getTime() - b.evento.timestamp.getTime());

  for (const item of eventos) {
    const key = `${item.evento.itemCodigo}::${item.evento.matricula}`;
    if (item.tipo === "saida") {
      const fila = pendentes.get(key) ?? [];
      fila.push(item.evento);
      pendentes.set(key, fila);
      continue;
    }

    const fila = pendentes.get(key) ?? [];
    const saida = fila.shift();
    if (fila.length > 0) {
      pendentes.set(key, fila);
    } else {
      pendentes.delete(key);
    }

    if (!saida) {
      continue;
    }

    const duracaoMs = item.evento.timestamp.getTime() - saida.timestamp.getTime();
    ciclos.push({
      matricula: saida.matricula,
      nome_funcionario: saida.nomeFuncionario,
      item_codigo: saida.itemCodigo,
      saida_em: saida.timestamp.toISOString(),
      saida_operador: saida.operadorNome,
      entrada_em: item.evento.timestamp.toISOString(),
      entrada_operador: item.evento.operadorNome,
      duracao_horas: duracaoMs >= 0 ? Number((duracaoMs / 3_600_000).toFixed(2)) : null,
      em_aberto: false,
    });
  }

  for (const fila of pendentes.values()) {
    for (const saida of fila) {
      ciclos.push({
        matricula: saida.matricula,
        nome_funcionario: saida.nomeFuncionario,
        item_codigo: saida.itemCodigo,
        saida_em: saida.timestamp.toISOString(),
        saida_operador: saida.operadorNome,
        entrada_em: null,
        entrada_operador: null,
        duracao_horas: null,
        em_aberto: true,
      });
    }
  }

  return ciclos.sort((a, b) => {
    const aTime = a.saida_em ? new Date(a.saida_em).getTime() : 0;
    const bTime = b.saida_em ? new Date(b.saida_em).getTime() : 0;
    return bTime - aTime;
  });
}

function extrairSetoresFuncionario(setorPrincipal: string, setoresRelacionados: string[]) {
  const vistos = new Set<string>();
  const setores: string[] = [];

  for (const nome of [setorPrincipal, ...setoresRelacionados]) {
    const normalizado = nome.trim();
    if (!normalizado || vistos.has(normalizado)) {
      continue;
    }
    vistos.add(normalizado);
    setores.push(normalizado);
  }

  return setores;
}

function extrairUnidadesFuncionario(unidadePrincipal: string, unidadesRelacionadas: string[]) {
  const vistos = new Set<string>();
  const unidades: string[] = [];

  for (const nome of [unidadePrincipal, ...unidadesRelacionadas]) {
    const normalizado = nome.trim();
    if (!normalizado || vistos.has(normalizado)) {
      continue;
    }
    vistos.add(normalizado);
    unidades.push(normalizado);
  }

  return unidades;
}

function formatarSetorLabel(setores: string[]) {
  if (setores.length === 0) {
    return "-";
  }
  return setores.join(", ");
}

function formatarUnidadeLabel(unidades: string[]) {
  if (unidades.length === 0) {
    return "-";
  }
  return unidades.join(", ");
}

function extrairFuncoesFuncionario(funcaoPrincipal: string, funcoesRelacionadas: string[]) {
  const vistos = new Set<string>();
  const funcoes: string[] = [];

  for (const nome of [funcaoPrincipal, ...funcoesRelacionadas]) {
    const normalizado = nome.trim();
    if (!normalizado || vistos.has(normalizado)) {
      continue;
    }
    vistos.add(normalizado);
    funcoes.push(normalizado);
  }

  return funcoes;
}

function formatarFuncaoLabel(funcoes: string[]) {
  if (funcoes.length === 0) {
    return "-";
  }
  return funcoes.join(", ");
}

function formatarDescricaoItem(descricao: string | null | undefined) {
  const normalizada = (descricao ?? "").trim();
  return normalizada;
}

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
          tipo_item: pending.payload.tipo_item ?? null,
          tamanho: pending.payload.tamanho ?? null,
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
        tipo_item: pending.payload.tipo_item ?? null,
        tamanho: pending.payload.tamanho ?? null,
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

      if (parsed.data.tipo === "emprestimo" && (!parsed.data.tipo_item || !parsed.data.tamanho)) {
        throw new AppError(400, "INVALID_ITEM_FILTERS", "Emprestimo exige tipo de item e tamanho");
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
        tipoItem: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
        itemCodigos: parsed.data.item_codigos,
        operadorNome: operador,
      });

      app.log.info({
        evento: "ops.gerar_codigo",
        matricula: parsed.data.matricula,
        tipo: parsed.data.tipo,
        quantidade: parsed.data.quantidade,
        tipo_item: parsed.data.tipo_item ?? null,
        tamanho: parsed.data.tamanho ?? null,
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
    "/ops/limpar-fila",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const schema = z.object({
        matricula: z.string().min(1).max(20),
      });

      const parsed = schema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      await Promise.all([
        queueService.limparOperacao(parsed.data.matricula, "emprestimo"),
        queueService.limparOperacao(parsed.data.matricula, "devolucao"),
      ]);

      app.log.info({
        evento: "ops.limpar_fila",
        matricula: parsed.data.matricula,
        operador_nome: request.user?.nomeCompleto,
      });

      return reply.status(200).send({ sucesso: true });
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
        if (!payload.tamanho) {
          throw new AppError(409, "INVALID_ITEM_SIZE", "Codigo pendente sem tamanho informado");
        }
        const tipoItem = payload.tipo_item?.trim() || "Sem tipo";

        const result = await loanService.registrarEmprestimo({
          matricula: parsed.data.matricula,
          operadorNome: payload.operador_nome,
          quantidade: payload.quantidade,
          tipo: tipoItem,
          tamanho: payload.tamanho,
        });

        await queueService.limparOperacao(parsed.data.matricula, parsed.data.tipo);
        await queueService.registrarResultado(parsed.data.matricula, true, "Emprestimo registrado");
        app.log.info({
          evento: "loan.created",
          matricula: parsed.data.matricula,
          itens: result.itens_emprestados,
          tipo_item: tipoItem,
          tamanho: payload.tamanho,
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

  app.post(
    "/ops/emprestimo-direto",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const schema = z.object({
        matricula: z.string().min(1).max(20),
        quantidade: z.coerce.number().int().positive(),
        tipo_item: tipoItemSchema,
        tamanho: tamanhoSchema,
      });

      const parsed = schema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const operador = request.user?.nomeCompleto;

      if (!operador) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao de operador invalida");
      }

      const result = await loanService.registrarEmprestimo({
        matricula: parsed.data.matricula,
        operadorNome: operador,
        quantidade: parsed.data.quantidade,
        tipo: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
      });

      app.log.info({
        evento: "loan.created_direto",
        matricula: parsed.data.matricula,
        itens: result.itens_emprestados,
        tipo_item: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
        operador_nome: operador,
      });

      return reply.status(200).send(result);
    },
  );

  app.post(
    "/ops/devolucao-direta",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const schema = z.object({
        matricula: z.string().min(1).max(20),
        item_codigos: z.array(z.string().min(1).max(50)).min(1),
      });

      const parsed = schema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const operador = request.user?.nomeCompleto;

      if (!operador) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao de operador invalida");
      }

      const itemCodigos = [...new Set(parsed.data.item_codigos)];

      const result = await returnService.registrarDevolucao({
        matricula: parsed.data.matricula,
        operadorNome: operador,
        itemCodigos,
      });

      app.log.info({
        evento: "return.created_direto",
        matricula: parsed.data.matricula,
        itens: result.itens_devolvidos,
        operador_nome: operador,
      });

      return reply.status(200).send(result);
    },
  );

  app.get(
    "/ops/tamanhos-disponiveis",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (_request, reply) => {
      const rows = await prisma.item.groupBy({
        by: ["tipo", "tamanho"],
        where: {
          status: "disponivel",
          statusAtivo: true,
        },
        _count: {
          _all: true,
        },
        orderBy: [{ tipo: "asc" }, { tamanho: "asc" }],
      });

      return reply.status(200).send(
        rows.map((row) => ({
          tipo: row.tipo,
          tamanho: row.tamanho,
          disponiveis: row._count._all,
        })),
      );
    },
  );

  app.get(
    "/ops/setores-disponiveis",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (_request, reply) => {
      const setores = await sectorOperationService.listarSetoresAtivos();
      return reply.status(200).send({ setores });
    },
  );

  app.post(
    "/ops/saida-setor-direta",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const schema = z.object({
        setor: z.string().min(1).max(100),
        quantidade: z.coerce.number().int().positive(),
        tipo_item: tipoItemSchema,
        tamanho: tamanhoSchema,
      });

      const parsed = schema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const operador = request.user?.nomeCompleto;

      if (!operador) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao de operador invalida");
      }

      const result = await sectorOperationService.registrarSaidaSetor({
        setor: parsed.data.setor,
        operadorNome: operador,
        quantidade: parsed.data.quantidade,
        tipo: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
      });

      app.log.info({
        evento: "loan.setor.created_direto",
        setor: result.setor,
        itens: result.itens_emprestados,
        quantidade: parsed.data.quantidade,
        tipo_item: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
        operador_nome: operador,
      });

      return reply.status(200).send(result);
    },
  );

  app.post(
    "/ops/devolucao-setor-direta",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const schema = z.object({
        setor: z.string().min(1).max(100),
        quantidade: z.coerce.number().int().positive(),
        tipo_item: tipoItemSchema,
        tamanho: tamanhoSchema,
      });

      const parsed = schema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
      }

      const operador = request.user?.nomeCompleto;

      if (!operador) {
        throw new AppError(401, "UNAUTHENTICATED", "Sessao de operador invalida");
      }

      const result = await sectorOperationService.registrarDevolucaoSetor({
        setor: parsed.data.setor,
        operadorNome: operador,
        quantidade: parsed.data.quantidade,
        tipo: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
      });

      app.log.info({
        evento: "return.setor.created_direto",
        setor: result.setor,
        itens: result.itens_devolvidos,
        quantidade: parsed.data.quantidade,
        tipo_item: parsed.data.tipo_item,
        tamanho: parsed.data.tamanho,
        operador_nome: operador,
      });

      return reply.status(200).send(result);
    },
  );

  app.get(
    "/ops/pendencias-setor",
    {
      preHandler: [authenticate, authorize(["setor"])],
    },
    async (request, reply) => {
      const query = z.object({ setor: z.string().min(1).max(100).optional() }).parse(request.query);
      const pendencias = await sectorOperationService.listarPendenciasSetor(query.setor);
      const totalPendente = pendencias.reduce((acc, row) => acc + row.quantidade_pendente, 0);

      return reply.status(200).send({
        setor: query.setor ?? null,
        total_pendente: totalPendente,
        pendencias,
      });
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
          tipo: true,
          tamanho: true,
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
          unidade: true,
          setor: true,
          funcao: true,
          unidades: {
            include: {
              unidade: {
                select: { nome: true },
              },
            },
            orderBy: {
              unidade: { nome: "asc" },
            },
          },
          setores: {
            include: {
              setor: {
                select: { nome: true },
              },
            },
            orderBy: {
              setor: { nome: "asc" },
            },
          },
          funcoes: {
            include: {
              funcao: {
                select: { nome: true },
              },
            },
            orderBy: {
              funcao: { nome: "asc" },
            },
          },
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

      const setoresFuncionario = extrairSetoresFuncionario(
        funcionario.setor,
        funcionario.setores.map((item) => item.setor.nome),
      );
      const unidadesFuncionario = extrairUnidadesFuncionario(
        funcionario.unidade,
        funcionario.unidades.map((item) => item.unidade.nome),
      );
      const funcoesFuncionario = extrairFuncoesFuncionario(
        funcionario.funcao,
        funcionario.funcoes.map((item) => item.funcao.nome),
      );

      return reply.status(200).send({
        nome: funcionario.nome,
        unidade: formatarUnidadeLabel(unidadesFuncionario),
        unidades: unidadesFuncionario,
        setor: formatarSetorLabel(setoresFuncionario),
        setores: setoresFuncionario,
        funcao: funcionario.funcao,
        funcoes: funcoesFuncionario,
        kits_em_uso: kitsEmUso,
        max_kits: Number(maxConfig?.valor ?? 2),
      });
    },
  );

  app.get(
    "/ops/busca-sugestoes",
    {
      preHandler: [authenticate, authorize(["setor", "admin", "superadmin"])],
    },
    async (request, reply) => {
      const query = buscaSugestoesSchema.parse(request.query);
      const termo = query.q.trim();
      const escopo = query.escopo;

      if (escopo === "global") {
        const [funcionarios, kits, setores, unidades, funcoes] = await Promise.all([
          prisma.funcionario.findMany({
            where: {
              OR: [
                { matricula: { contains: termo, mode: "insensitive" } },
                { nome: { contains: termo, mode: "insensitive" } },
                { unidade: { contains: termo, mode: "insensitive" } },
                { setor: { contains: termo, mode: "insensitive" } },
                { funcao: { contains: termo, mode: "insensitive" } },
              ],
            },
            select: {
              matricula: true,
              nome: true,
              unidade: true,
              setor: true,
              funcao: true,
              statusAtivo: true,
              unidades: {
                include: {
                  unidade: {
                    select: { nome: true },
                  },
                },
                orderBy: {
                  unidade: { nome: "asc" },
                },
              },
              funcoes: {
                include: {
                  funcao: {
                    select: { nome: true },
                  },
                },
                orderBy: {
                  funcao: { nome: "asc" },
                },
              },
              setores: {
                include: {
                  setor: {
                    select: { nome: true },
                  },
                },
                orderBy: {
                  setor: { nome: "asc" },
                },
              },
            },
            orderBy: [{ nome: "asc" }, { matricula: "asc" }],
            take: 5,
          }),
          prisma.item.findMany({
            where: {
              OR: [
                { codigo: { contains: termo, mode: "insensitive" } },
                { descricao: { contains: termo, mode: "insensitive" } },
                { tipo: { contains: termo, mode: "insensitive" } },
                { tamanho: { contains: termo, mode: "insensitive" } },
                { solicitanteMatricula: { contains: termo, mode: "insensitive" } },
                { setorSolicitante: { contains: termo, mode: "insensitive" } },
              ],
            },
            select: {
              codigo: true,
              descricao: true,
              tipo: true,
              tamanho: true,
              status: true,
              statusAtivo: true,
              solicitanteMatricula: true,
              setorSolicitante: true,
            },
            orderBy: [{ codigo: "asc" }],
            take: 5,
          }),
          prisma.setor.findMany({
            where: { nome: { contains: termo, mode: "insensitive" } },
            select: {
              nome: true,
              statusAtivo: true,
              _count: {
                select: {
                  unidades: true,
                  funcionarios: true,
                },
              },
            },
            orderBy: { nome: "asc" },
            take: 5,
          }),
          prisma.unidade.findMany({
            where: { nome: { contains: termo, mode: "insensitive" } },
            select: {
              nome: true,
              statusAtivo: true,
              _count: {
                select: {
                  setores: true,
                  funcionarios: true,
                },
              },
            },
            orderBy: { nome: "asc" },
            take: 5,
          }),
          prisma.funcao.findMany({
            where: { nome: { contains: termo, mode: "insensitive" } },
            select: {
              nome: true,
              statusAtivo: true,
              _count: {
                select: {
                  funcionarios: true,
                },
              },
            },
            orderBy: { nome: "asc" },
            take: 5,
          }),
        ]);

        const sugestoes = [
          ...funcionarios.map((funcionario) => {
            const setoresFuncionario = extrairSetoresFuncionario(
              funcionario.setor,
              funcionario.setores.map((item) => item.setor.nome),
            );
            const unidadesFuncionario = extrairUnidadesFuncionario(
              funcionario.unidade,
              funcionario.unidades.map((item) => item.unidade.nome),
            );
            const funcoesFuncionario = extrairFuncoesFuncionario(
              funcionario.funcao,
              funcionario.funcoes.map((item) => item.funcao.nome),
            );

            return {
              tipo: "funcionario" as const,
              chave: funcionario.matricula,
              titulo: funcionario.nome,
              subtitulo: `Funcionario | Matricula ${funcionario.matricula} | ${formatarUnidadeLabel(unidadesFuncionario)} | ${formatarSetorLabel(setoresFuncionario)} | ${formatarFuncaoLabel(funcoesFuncionario)} | ${funcionario.statusAtivo ? "Ativo" : "Inativo"}`,
            };
          }),
          ...kits.map((kit) => ({
            tipo: "kit" as const,
            chave: kit.codigo,
            titulo: `Kit ${kit.codigo}`,
            subtitulo: [
              "Kit",
              kit.tipo,
              formatarDescricaoItem(kit.descricao),
              `Tam: ${kit.tamanho}`,
              `Status: ${kit.status}`,
              kit.solicitanteMatricula ? `Matricula atual: ${kit.solicitanteMatricula}` : "",
              kit.setorSolicitante ? `Setor atual: ${kit.setorSolicitante}` : "",
              kit.statusAtivo ? "" : "Inativo",
            ].filter(Boolean).join(" | "),
          })),
          ...setores.map((setor) => ({
            tipo: "setor" as const,
            chave: setor.nome,
            titulo: setor.nome,
            subtitulo: `Setor | ${setor.statusAtivo ? "Ativo" : "Inativo"} | ${setor._count.unidades} unidades | ${setor._count.funcionarios} funcionarios`,
          })),
          ...unidades.map((unidade) => ({
            tipo: "unidade" as const,
            chave: unidade.nome,
            titulo: unidade.nome,
            subtitulo: `Unidade | ${unidade.statusAtivo ? "Ativa" : "Inativa"} | ${unidade._count.setores} setores | ${unidade._count.funcionarios} funcionarios`,
          })),
          ...funcoes.map((funcao) => ({
            tipo: "funcao" as const,
            chave: funcao.nome,
            titulo: funcao.nome,
            subtitulo: `Funcao | ${funcao.statusAtivo ? "Ativa" : "Inativa"} | ${funcao._count.funcionarios} funcionarios`,
          })),
        ];

        return reply.status(200).send({ sugestoes: sugestoes.slice(0, 18) });
      }

      const [funcionarios, kits] = await Promise.all([
        prisma.funcionario.findMany({
          where: {
            statusAtivo: true,
            OR: [
              { matricula: { contains: termo, mode: "insensitive" } },
              { nome: { contains: termo, mode: "insensitive" } },
            ],
          },
          select: {
            matricula: true,
            nome: true,
            unidade: true,
            setor: true,
            funcao: true,
            unidades: {
              include: {
                unidade: {
                  select: { nome: true },
                },
              },
              orderBy: {
                unidade: { nome: "asc" },
              },
            },
            funcoes: {
              include: {
                funcao: {
                  select: { nome: true },
                },
              },
              orderBy: {
                funcao: { nome: "asc" },
              },
            },
            setores: {
              include: {
                setor: {
                  select: { nome: true },
                },
              },
              orderBy: {
                setor: { nome: "asc" },
              },
            },
          },
          orderBy: [{ nome: "asc" }, { matricula: "asc" }],
          take: 6,
        }),
        prisma.item.findMany({
          where: {
            OR: [
              { codigo: { contains: termo, mode: "insensitive" } },
              { descricao: { contains: termo, mode: "insensitive" } },
              { tipo: { contains: termo, mode: "insensitive" } },
              { tamanho: { contains: termo, mode: "insensitive" } },
            ],
          },
        select: {
          codigo: true,
          descricao: true,
          tipo: true,
          tamanho: true,
          status: true,
          solicitanteMatricula: true,
          setorSolicitante: true,
        },
        orderBy: [{ codigo: "asc" }],
        take: 4,
        }),
      ]);

      const sugestoes = [
        ...funcionarios.map((funcionario) => {
          const setoresFuncionario = extrairSetoresFuncionario(
            funcionario.setor,
            funcionario.setores.map((item) => item.setor.nome),
          );
          const unidadesFuncionario = extrairUnidadesFuncionario(
            funcionario.unidade,
            funcionario.unidades.map((item) => item.unidade.nome),
          );
          const funcoesFuncionario = extrairFuncoesFuncionario(
            funcionario.funcao,
            funcionario.funcoes.map((item) => item.funcao.nome),
          );

          return {
            tipo: "funcionario" as const,
            chave: funcionario.matricula,
            titulo: funcionario.nome,
            subtitulo: `Matricula ${funcionario.matricula} | ${formatarUnidadeLabel(unidadesFuncionario)} | ${formatarSetorLabel(setoresFuncionario)} | ${formatarFuncaoLabel(funcoesFuncionario)}`,
          };
        }),
        ...kits.map((kit) => ({
          tipo: "kit" as const,
          chave: kit.codigo,
          titulo: `Kit ${kit.codigo}`,
          subtitulo: [
            kit.tipo,
            formatarDescricaoItem(kit.descricao),
            `Tam: ${kit.tamanho}`,
            `Status: ${kit.status}`,
            kit.solicitanteMatricula ? `Matricula atual: ${kit.solicitanteMatricula}` : "",
            kit.setorSolicitante ? `Setor atual: ${kit.setorSolicitante}` : "",
          ].filter(Boolean).join(" | "),
        })),
      ];

      return reply.status(200).send({ sugestoes });
    },
  );

  app.get(
    "/ops/busca-global",
    {
      preHandler: [authenticate, authorize(["setor", "admin", "superadmin"])],
    },
    async (request, reply) => {
      const query = buscaGlobalSchema.parse(request.query);
      const termo = query.q.trim();
      const modo = query.modo;

      const kit = await prisma.item.findFirst({
        where: {
          codigo: {
            equals: termo,
            mode: "insensitive",
          },
        },
        select: {
          codigo: true,
          descricao: true,
          tipo: true,
          tamanho: true,
          status: true,
          statusAtivo: true,
          solicitanteMatricula: true,
          setorSolicitante: true,
          dataEmprestimo: true,
        },
      });

      if (kit) {
        const [solicitacoes, devolucoes] = await Promise.all([
          prisma.solicitacao.findMany({
            where: { itemCodigo: kit.codigo },
            select: {
              timestamp: true,
              matricula: true,
              nomeFuncionario: true,
              itemCodigo: true,
              operadorNome: true,
            },
            orderBy: { timestamp: "desc" },
            take: 20,
          }),
          prisma.devolucao.findMany({
            where: { itemCodigo: kit.codigo },
            select: {
              timestamp: true,
              matricula: true,
              nomeFuncionario: true,
              itemCodigo: true,
              operadorNome: true,
            },
            orderBy: { timestamp: "desc" },
            take: 20,
          }),
        ]);

        return reply.status(200).send({
          tipo: "kit",
          consulta: termo,
          kit: {
            codigo: kit.codigo,
            descricao: kit.descricao,
            tipo: kit.tipo,
            tamanho: kit.tamanho,
            status: kit.status,
            status_ativo: kit.statusAtivo,
            solicitante_matricula: kit.solicitanteMatricula,
            setor_solicitante: kit.setorSolicitante,
            data_emprestimo: kit.dataEmprestimo,
          },
          historico: {
            solicitacoes: solicitacoes.map((evento) => ({
              timestamp: evento.timestamp,
              matricula: evento.matricula,
              nome_funcionario: evento.nomeFuncionario,
              item_codigo: evento.itemCodigo,
              operador_nome: evento.operadorNome,
            })),
            devolucoes: devolucoes.map((evento) => ({
              timestamp: evento.timestamp,
              matricula: evento.matricula,
              nome_funcionario: evento.nomeFuncionario,
              item_codigo: evento.itemCodigo,
              operador_nome: evento.operadorNome,
            })),
          },
        });
      }

      const funcionarios = await prisma.funcionario.findMany({
        where: {
          ...(modo === "operacao" ? { statusAtivo: true } : {}),
          OR: [
            {
              matricula: {
                equals: termo,
                mode: "insensitive",
              },
            },
            {
              nome: {
                contains: termo,
                mode: "insensitive",
              },
            },
            ...(modo === "global"
              ? [
                  {
                    unidade: {
                      contains: termo,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    setor: {
                      contains: termo,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    funcao: {
                      contains: termo,
                      mode: "insensitive" as const,
                    },
                  },
                ]
              : []),
          ],
        },
        select: {
          matricula: true,
          nome: true,
          unidade: true,
          setor: true,
          funcao: true,
          statusAtivo: true,
          unidades: {
            include: {
              unidade: {
                select: { nome: true },
              },
            },
            orderBy: {
              unidade: { nome: "asc" },
            },
          },
          setores: {
            include: {
              setor: {
                select: { nome: true },
              },
            },
            orderBy: {
              setor: { nome: "asc" },
            },
          },
          funcoes: {
            include: {
              funcao: {
                select: { nome: true },
              },
            },
            orderBy: {
              funcao: { nome: "asc" },
            },
          },
        },
        orderBy: [{ nome: "asc" }, { matricula: "asc" }],
        take: modo === "global" ? 10 : 8,
      });

      const funcionarioExato = funcionarios.find(
        (funcionario) => funcionario.matricula.toLowerCase() === termo.toLowerCase(),
      );

      if (modo === "global" && !funcionarioExato) {
        const [kits, setores, unidades, funcoes] = await Promise.all([
          prisma.item.findMany({
            where: {
              OR: [
                { codigo: { contains: termo, mode: "insensitive" } },
                { descricao: { contains: termo, mode: "insensitive" } },
                { tipo: { contains: termo, mode: "insensitive" } },
                { tamanho: { contains: termo, mode: "insensitive" } },
                { solicitanteMatricula: { contains: termo, mode: "insensitive" } },
                { setorSolicitante: { contains: termo, mode: "insensitive" } },
              ],
            },
            select: {
              codigo: true,
              descricao: true,
              tipo: true,
              tamanho: true,
              status: true,
              statusAtivo: true,
              solicitanteMatricula: true,
              setorSolicitante: true,
            },
            orderBy: { codigo: "asc" },
            take: 10,
          }),
          prisma.setor.findMany({
            where: { nome: { contains: termo, mode: "insensitive" } },
            select: {
              id: true,
              nome: true,
              statusAtivo: true,
              _count: {
                select: {
                  unidades: true,
                  funcionarios: true,
                },
              },
            },
            orderBy: { nome: "asc" },
            take: 10,
          }),
          prisma.unidade.findMany({
            where: { nome: { contains: termo, mode: "insensitive" } },
            select: {
              id: true,
              nome: true,
              statusAtivo: true,
              _count: {
                select: {
                  setores: true,
                  funcionarios: true,
                },
              },
            },
            orderBy: { nome: "asc" },
            take: 10,
          }),
          prisma.funcao.findMany({
            where: { nome: { contains: termo, mode: "insensitive" } },
            select: {
              id: true,
              nome: true,
              statusAtivo: true,
              _count: {
                select: {
                  funcionarios: true,
                },
              },
            },
            orderBy: { nome: "asc" },
            take: 10,
          }),
        ]);

        const funcionariosResumo = funcionarios.map((funcionario) => {
          const setoresFuncionario = extrairSetoresFuncionario(
            funcionario.setor,
            funcionario.setores.map((item) => item.setor.nome),
          );
          const unidadesFuncionario = extrairUnidadesFuncionario(
            funcionario.unidade,
            funcionario.unidades.map((item) => item.unidade.nome),
          );
          const funcoesFuncionario = extrairFuncoesFuncionario(
            funcionario.funcao,
            funcionario.funcoes.map((item) => item.funcao.nome),
          );

          return {
            matricula: funcionario.matricula,
            nome: funcionario.nome,
            unidade: formatarUnidadeLabel(unidadesFuncionario),
            unidades: unidadesFuncionario,
            setor: formatarSetorLabel(setoresFuncionario),
            setores: setoresFuncionario,
            funcao: funcionario.funcao,
            funcoes: funcoesFuncionario,
            status_ativo: funcionario.statusAtivo,
          };
        });

        const kitsResumo = kits.map((item) => ({
          codigo: item.codigo,
          descricao: item.descricao,
          tipo: item.tipo,
          tamanho: item.tamanho,
          status: item.status,
          status_ativo: item.statusAtivo,
          solicitante_matricula: item.solicitanteMatricula,
          setor_solicitante: item.setorSolicitante,
        }));

        const setoresResumo = setores.map((setor) => ({
          id: setor.id,
          nome: setor.nome,
          status_ativo: setor.statusAtivo,
          total_unidades: setor._count.unidades,
          total_funcionarios: setor._count.funcionarios,
        }));

        const unidadesResumo = unidades.map((unidade) => ({
          id: unidade.id,
          nome: unidade.nome,
          status_ativo: unidade.statusAtivo,
          total_setores: unidade._count.setores,
          total_funcionarios: unidade._count.funcionarios,
        }));

        const funcoesResumo = funcoes.map((funcao) => ({
          id: funcao.id,
          nome: funcao.nome,
          status_ativo: funcao.statusAtivo,
          total_funcionarios: funcao._count.funcionarios,
        }));

        const totalResultados =
          funcionariosResumo.length +
          kitsResumo.length +
          setoresResumo.length +
          unidadesResumo.length +
          funcoesResumo.length;

        if (totalResultados === 0) {
          return reply.status(200).send({
            tipo: "nao_encontrado",
            consulta: termo,
          });
        }

        return reply.status(200).send({
          tipo: "resultados_globais",
          consulta: termo,
          resultados: {
            funcionarios: funcionariosResumo,
            kits: kitsResumo,
            setores: setoresResumo,
            unidades: unidadesResumo,
            funcoes: funcoesResumo,
          },
        });
      }

      if (funcionarios.length === 0) {
        return reply.status(200).send({
          tipo: "nao_encontrado",
          consulta: termo,
        });
      }

      if (!funcionarioExato && funcionarios.length > 1) {
        return reply.status(200).send({
          tipo: "sugestoes_funcionario",
          consulta: termo,
          sugestoes: funcionarios.map((funcionario) => {
            const setoresFuncionario = extrairSetoresFuncionario(
              funcionario.setor,
              funcionario.setores.map((item) => item.setor.nome),
            );
            const unidadesFuncionario = extrairUnidadesFuncionario(
              funcionario.unidade,
              funcionario.unidades.map((item) => item.unidade.nome),
            );
            const funcoesFuncionario = extrairFuncoesFuncionario(
              funcionario.funcao,
              funcionario.funcoes.map((item) => item.funcao.nome),
            );

            return {
              matricula: funcionario.matricula,
              nome: funcionario.nome,
              unidade: formatarUnidadeLabel(unidadesFuncionario),
              unidades: unidadesFuncionario,
              setor: formatarSetorLabel(setoresFuncionario),
              setores: setoresFuncionario,
              funcao: funcionario.funcao,
              funcoes: funcoesFuncionario,
            };
          }),
        });
      }

      const funcionario = funcionarioExato ?? funcionarios[0];
      const setoresFuncionario = extrairSetoresFuncionario(
        funcionario.setor,
        funcionario.setores.map((item) => item.setor.nome),
      );
      const unidadesFuncionario = extrairUnidadesFuncionario(
        funcionario.unidade,
        funcionario.unidades.map((item) => item.unidade.nome),
      );
      const funcoesFuncionario = extrairFuncoesFuncionario(
        funcionario.funcao,
        funcionario.funcoes.map((item) => item.funcao.nome),
      );

      const [itensEmprestados, solicitacoes, devolucoes] = await Promise.all([
        prisma.item.findMany({
          where: {
            solicitanteMatricula: funcionario.matricula,
            status: "emprestado",
            statusAtivo: true,
          },
          select: {
            codigo: true,
            descricao: true,
            tipo: true,
            tamanho: true,
            dataEmprestimo: true,
          },
          orderBy: { codigo: "asc" },
        }),
        prisma.solicitacao.findMany({
          where: { matricula: funcionario.matricula },
          select: {
            timestamp: true,
            matricula: true,
            nomeFuncionario: true,
            itemCodigo: true,
            operadorNome: true,
          },
          orderBy: { timestamp: "desc" },
          take: 20,
        }),
        prisma.devolucao.findMany({
          where: { matricula: funcionario.matricula },
          select: {
            timestamp: true,
            matricula: true,
            nomeFuncionario: true,
            itemCodigo: true,
            operadorNome: true,
          },
          orderBy: { timestamp: "desc" },
          take: 20,
        }),
      ]);

      return reply.status(200).send({
        tipo: "funcionario",
        consulta: termo,
        funcionario: {
          matricula: funcionario.matricula,
          nome: funcionario.nome,
          unidade: formatarUnidadeLabel(unidadesFuncionario),
          unidades: unidadesFuncionario,
          setor: formatarSetorLabel(setoresFuncionario),
          setores: setoresFuncionario,
          funcao: funcionario.funcao,
          funcoes: funcoesFuncionario,
          status_ativo: funcionario.statusAtivo,
        },
        itens_emprestados: itensEmprestados.map((item) => ({
          codigo: item.codigo,
          descricao: item.descricao,
          tipo: item.tipo,
          tamanho: item.tamanho,
          data_emprestimo: item.dataEmprestimo,
        })),
        historico: {
          solicitacoes: solicitacoes.map((evento) => ({
            timestamp: evento.timestamp,
            matricula: evento.matricula,
            nome_funcionario: evento.nomeFuncionario,
            item_codigo: evento.itemCodigo,
            operador_nome: evento.operadorNome,
          })),
          devolucoes: devolucoes.map((evento) => ({
            timestamp: evento.timestamp,
            matricula: evento.matricula,
            nome_funcionario: evento.nomeFuncionario,
            item_codigo: evento.itemCodigo,
            operador_nome: evento.operadorNome,
          })),
        },
      });
    },
  );

  app.get(
    "/ops/historico-detalhes",
    {
      preHandler: [authenticate, authorize(["setor", "admin", "superadmin"])],
    },
    async (request, reply) => {
      const query = historicoDetalhesSchema.parse(request.query);
      const skip = (query.pagina - 1) * query.limite;
      const where =
        query.entidade === "funcionario"
          ? { matricula: query.id }
          : { itemCodigo: query.id };

      const [solicitacoes, devolucoes] = await Promise.all([
        prisma.solicitacao.findMany({
          where,
          select: {
            timestamp: true,
            matricula: true,
            nomeFuncionario: true,
            itemCodigo: true,
            operadorNome: true,
          },
          orderBy: { timestamp: "asc" },
        }),
        prisma.devolucao.findMany({
          where,
          select: {
            timestamp: true,
            matricula: true,
            nomeFuncionario: true,
            itemCodigo: true,
            operadorNome: true,
          },
          orderBy: { timestamp: "asc" },
        }),
      ]);

      const ciclos = montarCiclosHistorico(solicitacoes, devolucoes);
      const total = ciclos.length;
      const rows = ciclos.slice(skip, skip + query.limite);

      return reply.status(200).send({
        pagina: query.pagina,
        limite: query.limite,
        total,
        ciclos: rows,
      });
    },
  );
};
