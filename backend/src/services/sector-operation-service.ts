import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import { DashboardService } from "./dashboard-service.js";

const dashboardService = new DashboardService();
const MATRICULA_OPERACAO_SETOR = "__SETOR__";

type LockedItemRow = { id: number; codigo: string };

type PendingRow = {
  setorSolicitante: string | null;
  tipo: string;
  tamanho: string;
  _count: {
    _all: number;
  };
};

function normalizeSetor(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTipo(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTamanho(value: string) {
  return value.trim().toUpperCase();
}

function nomeSolicitanteSetor(setor: string) {
  return `Setor ${setor}`;
}

export class SectorOperationService {
  async listarSetoresAtivos() {
    const rows = await prisma.setor.findMany({
      where: { statusAtivo: true },
      select: { nome: true },
      orderBy: { nome: "asc" },
    });

    return rows.map((row) => row.nome);
  }

  async listarPendenciasSetor(setor?: string) {
    const setorNormalizado = setor ? normalizeSetor(setor) : "";
    const where =
      setorNormalizado.length > 0
        ? {
            setorSolicitante: setorNormalizado,
            status: "emprestado" as const,
            statusAtivo: true,
          }
        : {
            setorSolicitante: {
              not: null,
            },
            status: "emprestado" as const,
            statusAtivo: true,
          };

    const rows = await prisma.item.groupBy({
      by: ["setorSolicitante", "tipo", "tamanho"],
      where,
      _count: {
        _all: true,
      },
      orderBy: [{ setorSolicitante: "asc" }, { tipo: "asc" }, { tamanho: "asc" }],
    });

    return (rows as PendingRow[])
      .filter((row) => row.setorSolicitante)
      .map((row) => ({
        setor: row.setorSolicitante as string,
        tipo: row.tipo,
        tamanho: row.tamanho,
        quantidade_pendente: row._count._all,
      }));
  }

  async registrarSaidaSetor(input: {
    setor: string;
    operadorNome: string;
    quantidade: number;
    tipo: string;
    tamanho: string;
  }) {
    const setor = normalizeSetor(input.setor);
    const tipo = normalizeTipo(input.tipo);
    const tamanho = normalizeTamanho(input.tamanho);

    if (!setor) {
      throw new AppError(400, "INVALID_SECTOR", "Setor inválido");
    }

    if (!tipo) {
      throw new AppError(400, "INVALID_ITEM_TYPE", "Tipo do item inválido");
    }

    if (!tamanho) {
      throw new AppError(400, "INVALID_ITEM_SIZE", "Tamanho do item inválido");
    }

    const setorExistente = await prisma.setor.findFirst({
      where: {
        nome: {
          equals: setor,
          mode: "insensitive",
        },
        statusAtivo: true,
      },
      select: {
        nome: true,
      },
    });

    if (!setorExistente) {
      throw new AppError(404, "SETOR_NOT_FOUND", "Setor não encontrado");
    }

    const itensEmprestados = await prisma.$transaction(async (tx) => {
      const disponiveis = await tx.$queryRaw<LockedItemRow[]>`
        SELECT id, codigo
        FROM itens
        WHERE status = 'disponivel'
          AND status_ativo = true
          AND tipo = ${tipo}
          AND tamanho = ${tamanho}
        ORDER BY codigo ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.quantidade}
      `;

      if (disponiveis.length !== input.quantidade) {
        throw new AppError(
          409,
          "INSUFFICIENT_ITEMS",
          "Não há itens suficientes disponíveis para o tipo e tamanho informados",
        );
      }

      const now = new Date();
      const itemIds = disponiveis.map((item) => item.id);
      const itemCodes = disponiveis.map((item) => item.codigo);

      await tx.item.updateMany({
        where: {
          id: { in: itemIds },
        },
        data: {
          status: "emprestado",
          solicitanteMatricula: null,
          setorSolicitante: setorExistente.nome,
          dataEmprestimo: now,
          atualizadoPor: input.operadorNome,
          atualizadoEm: now,
        },
      });

      await tx.solicitacao.createMany({
        data: itemCodes.map((itemCodigo) => ({
          matricula: MATRICULA_OPERACAO_SETOR,
          nomeFuncionario: nomeSolicitanteSetor(setorExistente.nome),
          itemCodigo,
          operadorNome: input.operadorNome,
          origemOperacao: "setor",
          setorSolicitante: setorExistente.nome,
        })),
      });

      return itemCodes;
    });

    await dashboardService.invalidateCache();

    return {
      sucesso: true,
      setor: setorExistente.nome,
      itens_emprestados: itensEmprestados,
    };
  }

  async registrarDevolucaoSetor(input: {
    setor: string;
    operadorNome: string;
    quantidade: number;
    tipo: string;
    tamanho: string;
  }) {
    const setor = normalizeSetor(input.setor);
    const tipo = normalizeTipo(input.tipo);
    const tamanho = normalizeTamanho(input.tamanho);

    if (!setor) {
      throw new AppError(400, "INVALID_SECTOR", "Setor inválido");
    }

    if (!tipo) {
      throw new AppError(400, "INVALID_ITEM_TYPE", "Tipo do item inválido");
    }

    if (!tamanho) {
      throw new AppError(400, "INVALID_ITEM_SIZE", "Tamanho do item inválido");
    }

    const setorExistente = await prisma.setor.findFirst({
      where: {
        nome: {
          equals: setor,
          mode: "insensitive",
        },
        statusAtivo: true,
      },
      select: {
        nome: true,
      },
    });

    if (!setorExistente) {
      throw new AppError(404, "SETOR_NOT_FOUND", "Setor não encontrado");
    }

    const itensDevolvidos = await prisma.$transaction(async (tx) => {
      const emprestados = await tx.$queryRaw<LockedItemRow[]>`
        SELECT id, codigo
        FROM itens
        WHERE status = 'emprestado'
          AND status_ativo = true
          AND setor_solicitante = ${setorExistente.nome}
          AND tipo = ${tipo}
          AND tamanho = ${tamanho}
        ORDER BY data_emprestimo ASC NULLS FIRST, codigo ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.quantidade}
      `;

      if (emprestados.length !== input.quantidade) {
        throw new AppError(
          409,
          "INSUFFICIENT_PENDING_ITEMS",
          "Não há itens pendentes suficientes para devolução nesse setor",
        );
      }

      const now = new Date();
      const itemIds = emprestados.map((item) => item.id);
      const itemCodes = emprestados.map((item) => item.codigo);

      await tx.item.updateMany({
        where: {
          id: { in: itemIds },
        },
        data: {
          status: "disponivel",
          solicitanteMatricula: null,
          setorSolicitante: null,
          dataEmprestimo: null,
          atualizadoPor: input.operadorNome,
          atualizadoEm: now,
        },
      });

      await tx.devolucao.createMany({
        data: itemCodes.map((itemCodigo) => ({
          matricula: MATRICULA_OPERACAO_SETOR,
          nomeFuncionario: nomeSolicitanteSetor(setorExistente.nome),
          itemCodigo,
          operadorNome: input.operadorNome,
          origemOperacao: "setor",
          setorSolicitante: setorExistente.nome,
        })),
      });

      return itemCodes;
    });

    await dashboardService.invalidateCache();

    return {
      sucesso: true,
      setor: setorExistente.nome,
      itens_devolvidos: itensDevolvidos,
    };
  }
}
