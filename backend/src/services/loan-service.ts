import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import { DashboardService } from "./dashboard-service.js";

const dashboardService = new DashboardService();
type LockedItemRow = { id: number; codigo: string };

export class LoanService {
  async registrarEmprestimo(input: {
    matricula: string;
    operadorNome: string;
    quantidade: number;
    tipo: string;
    tamanho: string;
  }) {
    const tipo = input.tipo.trim().replace(/\s+/g, " ");
    const tamanho = input.tamanho.trim().toUpperCase();

    if (!tipo) {
      throw new AppError(400, "INVALID_ITEM_TYPE", "Tipo do item invalido");
    }

    if (!tamanho) {
      throw new AppError(400, "INVALID_ITEM_SIZE", "Tamanho do item invalido");
    }

    const funcionario = await prisma.funcionario.findFirst({
      where: {
        matricula: input.matricula,
        statusAtivo: true,
      },
      select: {
        nome: true,
      },
    });

    if (!funcionario) {
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionario nao encontrado");
    }

    const maxConfig = await prisma.configuracao.findUnique({
      where: { chave: "MAX_KITS_POR_FUNCIONARIO" },
      select: { valor: true },
    });

    const maxKits = Number(maxConfig?.valor ?? 2);

    const emprestadosAtuais = await prisma.item.count({
      where: {
        solicitanteMatricula: input.matricula,
        status: "emprestado",
        statusAtivo: true,
      },
    });

    if (emprestadosAtuais + input.quantidade > maxKits) {
      throw new AppError(409, "MAX_KITS_REACHED", "Limite de kits por funcionario excedido");
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
          "Nao ha itens suficientes disponiveis para o tipo e tamanho informados",
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
          solicitanteMatricula: input.matricula,
          setorSolicitante: null,
          dataEmprestimo: now,
          atualizadoPor: input.operadorNome,
          atualizadoEm: now,
        },
      });

      for (const itemCode of itemCodes) {
        await tx.solicitacao.create({
          data: {
            matricula: input.matricula,
            nomeFuncionario: funcionario.nome,
            itemCodigo: itemCode,
            operadorNome: input.operadorNome,
            origemOperacao: "colaborador",
            setorSolicitante: null,
          },
        });
      }

      return itemCodes;
    });

    await dashboardService.invalidateCache();

    return {
      sucesso: true,
      itens_emprestados: itensEmprestados,
    };
  }
}
