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

const buscaGlobalSchema = z.object({
  q: z.string().min(1).max(150),
});

const buscaSugestoesSchema = z.object({
  q: z.string().min(2).max(150),
});

const historicoDetalhesSchema = z.object({
  entidade: z.enum(["funcionario", "kit"]),
  id: z.string().min(1).max(50),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(5).max(100).default(25),
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

  app.get(
    "/ops/busca-sugestoes",
    {
      preHandler: [authenticate, authorize(["setor", "admin", "superadmin"])],
    },
    async (request, reply) => {
      const query = buscaSugestoesSchema.parse(request.query);
      const termo = query.q.trim();

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
            setor: true,
            funcao: true,
          },
          orderBy: [{ nome: "asc" }, { matricula: "asc" }],
          take: 6,
        }),
        prisma.item.findMany({
          where: {
            OR: [
              { codigo: { contains: termo, mode: "insensitive" } },
              { descricao: { contains: termo, mode: "insensitive" } },
            ],
          },
          select: {
            codigo: true,
            descricao: true,
            status: true,
            solicitanteMatricula: true,
          },
          orderBy: [{ codigo: "asc" }],
          take: 4,
        }),
      ]);

      const sugestoes = [
        ...funcionarios.map((funcionario) => ({
          tipo: "funcionario" as const,
          chave: funcionario.matricula,
          titulo: funcionario.nome,
          subtitulo: `Matricula ${funcionario.matricula} | ${funcionario.setor} | ${funcionario.funcao}`,
        })),
        ...kits.map((kit) => ({
          tipo: "kit" as const,
          chave: kit.codigo,
          titulo: `Kit ${kit.codigo}`,
          subtitulo: `${kit.descricao} | Status: ${kit.status}${kit.solicitanteMatricula ? ` | Matricula atual: ${kit.solicitanteMatricula}` : ""}`,
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
          status: true,
          statusAtivo: true,
          solicitanteMatricula: true,
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
            status: kit.status,
            status_ativo: kit.statusAtivo,
            solicitante_matricula: kit.solicitanteMatricula,
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
          statusAtivo: true,
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
          ],
        },
        select: {
          matricula: true,
          nome: true,
          setor: true,
          funcao: true,
          statusAtivo: true,
        },
        orderBy: [{ nome: "asc" }, { matricula: "asc" }],
        take: 8,
      });

      if (funcionarios.length === 0) {
        return reply.status(200).send({
          tipo: "nao_encontrado",
          consulta: termo,
        });
      }

      const funcionarioExato = funcionarios.find(
        (funcionario) => funcionario.matricula.toLowerCase() === termo.toLowerCase(),
      );

      if (!funcionarioExato && funcionarios.length > 1) {
        return reply.status(200).send({
          tipo: "sugestoes_funcionario",
          consulta: termo,
          sugestoes: funcionarios.map((funcionario) => ({
            matricula: funcionario.matricula,
            nome: funcionario.nome,
            setor: funcionario.setor,
            funcao: funcionario.funcao,
          })),
        });
      }

      const funcionario = funcionarioExato ?? funcionarios[0];

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
          setor: funcionario.setor,
          funcao: funcionario.funcao,
          status_ativo: funcionario.statusAtivo,
        },
        itens_emprestados: itensEmprestados.map((item) => ({
          codigo: item.codigo,
          descricao: item.descricao,
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
