import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import { DashboardService } from "./dashboard-service.js";

const dashboardService = new DashboardService();
type LockedReturnRow = { id: number; codigo: string };

export class ReturnService {
  async registrarDevolucao(input: {
    matricula: string;
    operadorNome: string;
    itemCodigos: string[];
  }) {
    const normalizedCodes = [...new Set(input.itemCodigos)];

    if (normalizedCodes.length === 0) {
      throw new AppError(400, "EMPTY_ITEMS", "Nenhum item informado para devolução");
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
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionário não encontrado");
    }

    const itensDevolvidos = await prisma.$transaction(async (tx) => {
      const itens = await tx.$queryRaw<LockedReturnRow[]>`
        SELECT id, codigo
        FROM itens
        WHERE codigo = ANY(${normalizedCodes}::text[])
          AND status = 'emprestado'
          AND solicitante_matricula = ${input.matricula}
        FOR UPDATE SKIP LOCKED
      `;

      if (itens.length !== normalizedCodes.length) {
        throw new AppError(409, "INVALID_RETURN_ITEMS", "Um ou mais itens não pertencem ao funcionário");
      }

      const now = new Date();
      const itemIds = itens.map((item) => item.id);
      const itemCodes = itens.map((item) => item.codigo);

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

      for (const itemCode of itemCodes) {
        await tx.devolucao.create({
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
      itens_devolvidos: itensDevolvidos,
    };
  }
}
