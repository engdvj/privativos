import bcrypt from "bcrypt";
import { Perfil, Prisma, StatusItem } from "@prisma/client";
import { BACKUP_FORMAT_VERSION, RESET_DB_TARGETS, type ResetDbTarget } from "../constants/manutencao.js";
import { env } from "../config/env.js";
import { CONFIG_DEFAULT_KEYS, CONFIG_DEFAULTS, isConfiguracaoComPadrao } from "../constants/configuracoes.js";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { DashboardService } from "./dashboard-service.js";

const dashboardService = new DashboardService();

type BackupConfiguracao = {
  chave: string;
  valor: string;
  atualizadoPor?: string | null;
  atualizadoEm?: string | Date | null;
};

type BackupCredencial = {
  usuario: string;
  senhaHash: string;
  perfil: "setor" | "admin" | "superadmin";
  nomeCompleto: string;
  ativo: boolean;
  deveAlterarSenha: boolean;
  temaPreferido?: string;
  criadoEm: string | Date;
  criadoPor: string;
  atualizadoPor?: string | null;
  atualizadoEm?: string | Date | null;
};

type BackupSetor = {
  nome: string;
  statusAtivo: boolean;
  criadoEm: string | Date;
  atualizadoPor?: string | null;
  atualizadoEm?: string | Date | null;
};

type BackupUnidade = BackupSetor;
type BackupFuncao = BackupSetor;

type BackupFuncionario = {
  matricula: string;
  nome: string;
  unidade?: string;
  unidades?: string[];
  setor?: string;
  setores?: string[];
  funcao: string;
  funcoes?: string[];
  statusAtivo: boolean;
  criadoEm: string | Date;
  atualizadoPor?: string | null;
  atualizadoEm?: string | Date | null;
};

type FuncionarioComSetores = {
  matricula: string;
  nome: string;
  unidade: string;
  setor: string;
  funcao: string;
  statusAtivo: boolean;
  unidades: string[];
  setores: string[];
  funcoes: string[];
};

type BackupItem = {
  codigo: string;
  descricao: string;
  tamanho: string;
  status: "disponivel" | "emprestado" | "inativo";
  solicitanteMatricula?: string | null;
  dataEmprestimo?: string | Date | null;
  statusAtivo: boolean;
  criadoEm: string | Date;
  atualizadoPor?: string | null;
  atualizadoEm?: string | Date | null;
};

type BackupSolicitacao = {
  timestamp: string | Date;
  matricula: string;
  nomeFuncionario: string;
  itemCodigo: string;
  operadorNome: string;
};

type BackupDevolucao = BackupSolicitacao;

type BackupAuditoria = {
  timestamp: string | Date;
  operador: string;
  entidade: string;
  operacao: string;
  registroId: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
};

type BackupData = {
  configuracoes: BackupConfiguracao[];
  credenciais: BackupCredencial[];
  unidades: BackupUnidade[];
  setores: BackupSetor[];
  funcoes: BackupFuncao[];
  funcionarios: BackupFuncionario[];
  itens: BackupItem[];
  solicitacoes: BackupSolicitacao[];
  devolucoes: BackupDevolucao[];
  auditoria: BackupAuditoria[];
};

export class AdminService {
  async listUnidades(includeInactive = false) {
    const rows = await prisma.unidade.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ nome: "asc" }],
      include: {
        _count: {
          select: {
            funcionarios: true,
          },
        },
      },
    });

    return rows.map(({ _count, ...row }) => ({
      ...row,
      totalFuncionarios: _count.funcionarios,
    }));
  }

  async createUnidade(input: { nome: string; operador: string }) {
    const created = await prisma.unidade.create({
      data: {
        nome: input.nome,
        statusAtivo: true,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "unidades",
      operacao: "INSERT",
      registroId: String(created.id),
      dadosAntes: null,
      dadosDepois: created,
    });

    return created;
  }

  async updateUnidade(
    id: number,
    input: { nome?: string; statusAtivo?: boolean; operador: string },
  ) {
    const before = await prisma.unidade.findUnique({ where: { id } });
    if (!before) {
      throw new AppError(404, "UNIDADE_NOT_FOUND", "Unidade nao encontrada");
    }

    const now = new Date();
    const updated = await prisma.unidade.update({
      where: { id },
      data: {
        nome: input.nome,
        statusAtivo: input.statusAtivo,
        atualizadoPor: input.operador,
        atualizadoEm: now,
      },
    });

    if (input.nome && input.nome !== before.nome) {
      await prisma.funcionario.updateMany({
        where: { unidade: before.nome },
        data: {
          unidade: input.nome,
          atualizadoPor: input.operador,
          atualizadoEm: now,
        },
      });
    }

    await this.audit({
      operador: input.operador,
      entidade: "unidades",
      operacao: "UPDATE",
      registroId: String(id),
      dadosAntes: before,
      dadosDepois: updated,
    });

    return updated;
  }

  async deleteUnidade(id: number, operador: string) {
    const before = await prisma.unidade.findUnique({ where: { id } });
    if (!before) {
      throw new AppError(404, "UNIDADE_NOT_FOUND", "Unidade nao encontrada");
    }

    const vinculados = await prisma.funcionarioUnidade.count({
      where: { unidadeId: id },
    });

    if (vinculados > 0) {
      throw new AppError(
        409,
        "UNIDADE_COM_FUNCIONARIOS",
        "Unidade possui funcionarios vinculados. Realoque os funcionarios antes de apagar.",
      );
    }

    await prisma.unidade.delete({ where: { id } });

    await this.audit({
      operador,
      entidade: "unidades",
      operacao: "DELETE",
      registroId: String(id),
      dadosAntes: before,
      dadosDepois: null,
    });
  }

  async listSetores(includeInactive = false) {
    const rows = await prisma.setor.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ nome: "asc" }],
      include: {
        _count: {
          select: {
            funcionarios: true,
          },
        },
      },
    });

    return rows.map(({ _count, ...row }) => ({
      ...row,
      totalFuncionarios: _count.funcionarios,
    }));
  }

  async createSetor(input: { nome: string; operador: string }) {
    const created = await prisma.setor.create({
      data: {
        nome: input.nome,
        statusAtivo: true,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "setores",
      operacao: "INSERT",
      registroId: String(created.id),
      dadosAntes: null,
      dadosDepois: created,
    });

    return created;
  }

  async updateSetor(
    id: number,
    input: { nome?: string; statusAtivo?: boolean; operador: string },
  ) {
    const before = await prisma.setor.findUnique({ where: { id } });
    if (!before) {
      throw new AppError(404, "SETOR_NOT_FOUND", "Setor nao encontrado");
    }

    const now = new Date();
    const updated = await prisma.setor.update({
      where: { id },
      data: {
        nome: input.nome,
        statusAtivo: input.statusAtivo,
        atualizadoPor: input.operador,
        atualizadoEm: now,
      },
    });

    if (input.nome && input.nome !== before.nome) {
      await prisma.funcionario.updateMany({
        where: { setor: before.nome },
        data: {
          setor: input.nome,
          atualizadoPor: input.operador,
          atualizadoEm: now,
        },
      });
    }

    await this.audit({
      operador: input.operador,
      entidade: "setores",
      operacao: "UPDATE",
      registroId: String(id),
      dadosAntes: before,
      dadosDepois: updated,
    });

    return updated;
  }

  async deleteSetor(id: number, operador: string) {
    const before = await prisma.setor.findUnique({ where: { id } });
    if (!before) {
      throw new AppError(404, "SETOR_NOT_FOUND", "Setor nao encontrado");
    }

    const vinculados = await prisma.funcionarioSetor.count({
      where: { setorId: id },
    });

    if (vinculados > 0) {
      throw new AppError(
        409,
        "SETOR_COM_FUNCIONARIOS",
        "Setor possui funcionarios vinculados. Realoque os funcionarios antes de apagar.",
      );
    }

    await prisma.setor.delete({ where: { id } });

    await this.audit({
      operador,
      entidade: "setores",
      operacao: "DELETE",
      registroId: String(id),
      dadosAntes: before,
      dadosDepois: null,
    });
  }

  async listFuncionariosPorSetor(
    setorId: number,
    input: {
      pagina: number;
      limite: number;
      includeInactive: boolean;
    },
  ) {
    const where: Prisma.FuncionarioSetorWhereInput = {
      setorId,
      ...(input.includeInactive ? {} : { funcionario: { statusAtivo: true } }),
    };

    const [total, rows] = await Promise.all([
      prisma.funcionarioSetor.count({ where }),
      prisma.funcionarioSetor.findMany({
        where,
        include: {
          funcionario: {
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
          },
        },
        orderBy: [{ funcionario: { nome: "asc" } }, { funcionario: { matricula: "asc" } }],
        skip: (input.pagina - 1) * input.limite,
        take: input.limite,
      }),
    ]);

    return {
      pagina: input.pagina,
      limite: input.limite,
      total,
      rows: rows.map((row) => this.mapFuncionarioComSetores(row.funcionario)),
    };
  }

  async listFuncionariosPorUnidade(
    unidadeId: number,
    input: {
      pagina: number;
      limite: number;
      includeInactive: boolean;
    },
  ) {
    const where: Prisma.FuncionarioUnidadeWhereInput = {
      unidadeId,
      ...(input.includeInactive ? {} : { funcionario: { statusAtivo: true } }),
    };

    const [total, rows] = await Promise.all([
      prisma.funcionarioUnidade.count({ where }),
      prisma.funcionarioUnidade.findMany({
        where,
        include: {
          funcionario: {
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
          },
        },
        orderBy: [{ funcionario: { nome: "asc" } }, { funcionario: { matricula: "asc" } }],
        skip: (input.pagina - 1) * input.limite,
        take: input.limite,
      }),
    ]);

    return {
      pagina: input.pagina,
      limite: input.limite,
      total,
      rows: rows.map((row) => this.mapFuncionarioComSetores(row.funcionario)),
    };
  }

  async listFuncoes(includeInactive = false) {
    return prisma.funcao.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ nome: "asc" }],
    });
  }

  async createFuncao(input: { nome: string; operador: string }) {
    const created = await prisma.funcao.create({
      data: {
        nome: input.nome,
        statusAtivo: true,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "funcoes",
      operacao: "INSERT",
      registroId: String(created.id),
      dadosAntes: null,
      dadosDepois: created,
    });

    return created;
  }

  async updateFuncao(
    id: number,
    input: { nome?: string; statusAtivo?: boolean; operador: string },
  ) {
    const before = await prisma.funcao.findUnique({ where: { id } });
    if (!before) {
      throw new AppError(404, "FUNCAO_NOT_FOUND", "Funcao nao encontrada");
    }

    const now = new Date();
    const updated = await prisma.funcao.update({
      where: { id },
      data: {
        nome: input.nome,
        statusAtivo: input.statusAtivo,
        atualizadoPor: input.operador,
        atualizadoEm: now,
      },
    });

    if (input.nome && input.nome !== before.nome) {
      await prisma.funcionario.updateMany({
        where: { funcao: before.nome },
        data: {
          funcao: input.nome,
          atualizadoPor: input.operador,
          atualizadoEm: now,
        },
      });
    }

    await this.audit({
      operador: input.operador,
      entidade: "funcoes",
      operacao: "UPDATE",
      registroId: String(id),
      dadosAntes: before,
      dadosDepois: updated,
    });

    return updated;
  }

  async deleteFuncao(id: number, operador: string) {
    const before = await prisma.funcao.findUnique({ where: { id } });
    if (!before) {
      throw new AppError(404, "FUNCAO_NOT_FOUND", "Funcao nao encontrada");
    }

    const vinculados = await prisma.funcionarioFuncao.count({
      where: { funcaoId: id },
    });

    if (vinculados > 0) {
      throw new AppError(
        409,
        "FUNCAO_COM_FUNCIONARIOS",
        "Funcao possui funcionarios vinculados. Realoque os funcionarios antes de apagar.",
      );
    }

    await prisma.funcao.delete({ where: { id } });

    await this.audit({
      operador,
      entidade: "funcoes",
      operacao: "DELETE",
      registroId: String(id),
      dadosAntes: before,
      dadosDepois: null,
    });
  }

  async listFuncionarios(includeInactive = false) {
    const rows = await prisma.funcionario.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ nome: "asc" }],
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
    });

    return rows.map((row) => this.mapFuncionarioComSetores(row));
  }

  async createFuncionario(input: {
    matricula: string;
    nome: string;
    unidade?: string;
    unidades?: string[];
    setor?: string;
    setores?: string[];
    funcao?: string;
    funcoes?: string[];
    operador: string;
  }) {
    const matriculaNormalizada = this.normalizarMatricula(input.matricula);
    const nomeNormalizado = this.normalizarNome(input.nome);
    const unidadesNormalizadas = this.normalizarUnidades(input.unidades, input.unidade);
    if (unidadesNormalizadas.length === 0) {
      throw new AppError(400, "UNIDADE_INVALIDA", "Informe ao menos uma unidade");
    }
    const setoresNormalizados = this.normalizarSetores(input.setores, input.setor);
    if (setoresNormalizados.length === 0) {
      throw new AppError(400, "SETOR_INVALIDO", "Informe ao menos um setor");
    }
    const funcoesNormalizadas = this.normalizarFuncoes(input.funcoes, input.funcao);
    if (funcoesNormalizadas.length === 0) {
      throw new AppError(400, "FUNCAO_INVALIDA", "Informe ao menos uma funcao");
    }

    const [unidadesAtivas, setoresAtivos, funcoesAtivas, funcionarioComMatricula, funcionarioComMesmoNome] = await Promise.all([
      prisma.unidade.findMany({
        where: {
          nome: { in: unidadesNormalizadas },
          statusAtivo: true,
        },
        select: {
          id: true,
          nome: true,
        },
      }),
      prisma.setor.findMany({
        where: {
          nome: { in: setoresNormalizados },
          statusAtivo: true,
        },
        select: {
          id: true,
          nome: true,
        },
      }),
      prisma.funcao.findMany({
        where: {
          nome: { in: funcoesNormalizadas },
          statusAtivo: true,
        },
        select: {
          id: true,
          nome: true,
        },
      }),
      prisma.funcionario.findFirst({
        where: {
          matricula: {
            equals: matriculaNormalizada,
            mode: "insensitive",
          },
        },
        select: {
          matricula: true,
        },
      }),
      prisma.funcionario.findFirst({
        where: {
          nome: {
            equals: nomeNormalizado,
            mode: "insensitive",
          },
        },
        select: {
          matricula: true,
        },
      }),
    ]);

    this.validarUnidadesAtivas(unidadesNormalizadas, unidadesAtivas.map((row) => row.nome));
    this.validarSetoresAtivos(setoresNormalizados, setoresAtivos.map((row) => row.nome));
    this.validarFuncoesAtivas(funcoesNormalizadas, funcoesAtivas.map((row) => row.nome));

    if (funcionarioComMatricula) {
      throw new AppError(409, "MATRICULA_DUPLICADA", "Ja existe funcionario com esta matricula");
    }

    if (funcionarioComMesmoNome) {
      throw new AppError(409, "FUNCIONARIO_DUPLICADO", "Ja existe funcionario com este nome");
    }

    const created = await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.funcionario.create({
        data: {
          matricula: matriculaNormalizada,
          nome: nomeNormalizado,
          unidade: unidadesNormalizadas[0],
          setor: setoresNormalizados[0],
          funcao: funcoesNormalizadas[0],
          atualizadoPor: input.operador,
          atualizadoEm: now,
        },
      });

      await tx.funcionarioUnidade.createMany({
        data: unidadesAtivas.map((unidade) => ({
          funcionarioMatricula: matriculaNormalizada,
          unidadeId: unidade.id,
        })),
      });

      await tx.funcionarioSetor.createMany({
        data: setoresAtivos.map((setor) => ({
          funcionarioMatricula: matriculaNormalizada,
          setorId: setor.id,
        })),
      });

      await tx.funcionarioFuncao.createMany({
        data: funcoesAtivas.map((funcao) => ({
          funcionarioMatricula: matriculaNormalizada,
          funcaoId: funcao.id,
        })),
      });

      return tx.funcionario.findUniqueOrThrow({
        where: { matricula: matriculaNormalizada },
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
      });
    });

    await this.audit({
      operador: input.operador,
      entidade: "funcionarios",
      operacao: "INSERT",
      registroId: matriculaNormalizada,
      dadosAntes: null,
      dadosDepois: created,
    });
    await this.invalidateDashboardCaches();

    return this.mapFuncionarioComSetores(created);
  }

  async updateFuncionario(
    matricula: string,
    input: {
      nome?: string;
      unidade?: string;
      unidades?: string[];
      setor?: string;
      setores?: string[];
      funcao?: string;
      funcoes?: string[];
      statusAtivo?: boolean;
      operador: string;
    },
  ) {
    const before = await prisma.funcionario.findUnique({
      where: { matricula },
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
    });

    if (!before) {
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionario nao encontrado");
    }

    const nomeNormalizado = input.nome !== undefined ? this.normalizarNome(input.nome) : undefined;
    const atualizarUnidades = input.unidades !== undefined || input.unidade !== undefined;
    const atualizarSetores = input.setores !== undefined || input.setor !== undefined;
    const atualizarFuncoes = input.funcoes !== undefined || input.funcao !== undefined;

    const unidadesNormalizadas = this.normalizarUnidades(input.unidades, input.unidade);
    if (atualizarUnidades && unidadesNormalizadas.length === 0) {
      throw new AppError(400, "UNIDADE_INVALIDA", "Informe ao menos uma unidade");
    }
    const setoresNormalizados = this.normalizarSetores(input.setores, input.setor);
    if (atualizarSetores && setoresNormalizados.length === 0) {
      throw new AppError(400, "SETOR_INVALIDO", "Informe ao menos um setor");
    }
    const funcoesNormalizadas = this.normalizarFuncoes(input.funcoes, input.funcao);
    if (atualizarFuncoes && funcoesNormalizadas.length === 0) {
      throw new AppError(400, "FUNCAO_INVALIDA", "Informe ao menos uma funcao");
    }

    const [unidadesAtivas, setoresAtivos, funcoesAtivas, funcionarioComMesmoNome] = await Promise.all([
      atualizarUnidades
        ? prisma.unidade.findMany({
            where: {
              nome: { in: unidadesNormalizadas },
              statusAtivo: true,
            },
            select: {
              id: true,
              nome: true,
            },
          })
        : Promise.resolve([]),
      atualizarSetores
        ? prisma.setor.findMany({
            where: {
              nome: { in: setoresNormalizados },
              statusAtivo: true,
            },
            select: {
              id: true,
              nome: true,
            },
          })
        : Promise.resolve([]),
      atualizarFuncoes
        ? prisma.funcao.findMany({
            where: {
              nome: { in: funcoesNormalizadas },
              statusAtivo: true,
            },
            select: {
              id: true,
              nome: true,
            },
          })
        : Promise.resolve([]),
      nomeNormalizado
        ? prisma.funcionario.findFirst({
            where: {
              nome: {
                equals: nomeNormalizado,
                mode: "insensitive",
              },
              matricula: {
                not: matricula,
              },
            },
            select: {
              matricula: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (atualizarUnidades) {
      this.validarUnidadesAtivas(unidadesNormalizadas, unidadesAtivas.map((row) => row.nome));
    }

    if (atualizarSetores) {
      this.validarSetoresAtivos(setoresNormalizados, setoresAtivos.map((row) => row.nome));
    }

    if (atualizarFuncoes) {
      this.validarFuncoesAtivas(funcoesNormalizadas, funcoesAtivas.map((row) => row.nome));
    }

    if (funcionarioComMesmoNome) {
      throw new AppError(409, "FUNCIONARIO_DUPLICADO", "Ja existe funcionario com este nome");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.funcionario.update({
        where: { matricula },
        data: {
          nome: nomeNormalizado,
          unidade: atualizarUnidades ? unidadesNormalizadas[0] : undefined,
          setor: atualizarSetores ? setoresNormalizados[0] : undefined,
          funcao: atualizarFuncoes ? funcoesNormalizadas[0] : undefined,
          statusAtivo: input.statusAtivo,
          atualizadoPor: input.operador,
          atualizadoEm: now,
        },
      });

      if (atualizarUnidades) {
        await tx.funcionarioUnidade.deleteMany({
          where: { funcionarioMatricula: matricula },
        });

        await tx.funcionarioUnidade.createMany({
          data: unidadesAtivas.map((unidade) => ({
            funcionarioMatricula: matricula,
            unidadeId: unidade.id,
          })),
        });
      }

      if (atualizarSetores) {
        await tx.funcionarioSetor.deleteMany({
          where: { funcionarioMatricula: matricula },
        });

        await tx.funcionarioSetor.createMany({
          data: setoresAtivos.map((setor) => ({
            funcionarioMatricula: matricula,
            setorId: setor.id,
          })),
        });
      }

      if (atualizarFuncoes) {
        await tx.funcionarioFuncao.deleteMany({
          where: { funcionarioMatricula: matricula },
        });

        await tx.funcionarioFuncao.createMany({
          data: funcoesAtivas.map((funcao) => ({
            funcionarioMatricula: matricula,
            funcaoId: funcao.id,
          })),
        });
      }

      return tx.funcionario.findUniqueOrThrow({
        where: { matricula },
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
      });
    });

    await this.audit({
      operador: input.operador,
      entidade: "funcionarios",
      operacao: "UPDATE",
      registroId: matricula,
      dadosAntes: this.mapFuncionarioComSetores(before),
      dadosDepois: updated,
    });
    await this.invalidateDashboardCaches();

    return this.mapFuncionarioComSetores(updated);
  }

  async deleteFuncionario(matricula: string, operador: string) {
    const before = await prisma.funcionario.findUnique({ where: { matricula } });
    if (!before) {
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionario nao encontrado");
    }

    const emprestados = await prisma.item.count({
      where: {
        solicitanteMatricula: matricula,
        status: "emprestado",
        statusAtivo: true,
      },
    });

    if (emprestados > 0) {
      throw new AppError(
        409,
        "FUNCIONARIO_COM_EMPRESTIMO",
        "Funcionario possui itens emprestados e nao pode ser removido",
      );
    }

    await prisma.funcionario.delete({ where: { matricula } });

    await this.audit({
      operador,
      entidade: "funcionarios",
      operacao: "DELETE",
      registroId: matricula,
      dadosAntes: before,
      dadosDepois: null,
    });
    await this.invalidateDashboardCaches();
  }

  async listItens(includeInactive = false) {
    return prisma.item.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ codigo: "asc" }],
    });
  }

  async createItem(input: {
    codigo: string;
    descricao: string;
    tamanho: string;
    status?: StatusItem;
    operador: string;
  }) {
    const created = await prisma.item.create({
      data: {
        codigo: input.codigo,
        descricao: input.descricao,
        tamanho: input.tamanho,
        status: input.status ?? "disponivel",
        statusAtivo: true,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "itens",
      operacao: "INSERT",
      registroId: input.codigo,
      dadosAntes: null,
      dadosDepois: created,
    });
    await this.invalidateDashboardCaches();

    return created;
  }

  async updateItem(
    codigo: string,
    input: {
      descricao?: string;
      tamanho?: string;
      status?: StatusItem;
      statusAtivo?: boolean;
      operador: string;
    },
  ) {
    const before = await prisma.item.findUnique({ where: { codigo } });

    if (!before) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item nao encontrado");
    }

    if (before.status === "emprestado" && input.statusAtivo === false) {
      const holder = before.solicitanteMatricula
        ? await prisma.funcionario.findUnique({
            where: { matricula: before.solicitanteMatricula },
            select: { matricula: true, nome: true },
          })
        : null;

      const detalhes = holder ? `${holder.matricula} - ${holder.nome}` : "desconhecido";
      throw new AppError(409, "ITEM_EMPRESTADO", `Item emprestado para ${detalhes}`);
    }

    const shouldForceInactive = input.statusAtivo === false;

    const updated = await prisma.item.update({
      where: { codigo },
      data: {
        descricao: input.descricao,
        tamanho: input.tamanho,
        status: shouldForceInactive ? "inativo" : input.status,
        statusAtivo: input.statusAtivo,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "itens",
      operacao: "UPDATE",
      registroId: codigo,
      dadosAntes: before,
      dadosDepois: updated,
    });
    await this.invalidateDashboardCaches();

    return updated;
  }

  async deleteItem(codigo: string, operador: string) {
    const before = await prisma.item.findUnique({ where: { codigo } });
    if (!before) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item nao encontrado");
    }

    if (before.status === "emprestado") {
      throw new AppError(409, "ITEM_EMPRESTADO", "Item emprestado nao pode ser removido");
    }

    await prisma.item.delete({ where: { codigo } });

    await this.audit({
      operador,
      entidade: "itens",
      operacao: "DELETE",
      registroId: codigo,
      dadosAntes: before,
      dadosDepois: null,
    });
    await this.invalidateDashboardCaches();
  }

  async listCredenciais() {
    return prisma.credencial.findMany({
      orderBy: [{ usuario: "asc" }],
      select: {
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
        criadoEm: true,
        criadoPor: true,
        atualizadoPor: true,
        atualizadoEm: true,
      },
    });
  }

  async createCredencial(input: {
    usuario: string;
    senha: string;
    perfil: "setor" | "admin" | "superadmin";
    nomeCompleto: string;
    operador: string;
  }) {
    const senhaHash = await bcrypt.hash(input.senha, env.BCRYPT_ROUNDS);

    const created = await prisma.credencial.create({
      data: {
        usuario: input.usuario,
        senhaHash,
        perfil:
          input.perfil === "superadmin"
            ? Perfil.superadmin
            : input.perfil === "admin"
              ? Perfil.admin
              : Perfil.setor,
        nomeCompleto: input.nomeCompleto,
        ativo: true,
        deveAlterarSenha: true,
        criadoPor: input.operador,
      },
      select: {
        id: true,
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "credenciais",
      operacao: "INSERT",
      registroId: input.usuario,
      dadosAntes: null,
      dadosDepois: created,
    });

    return created;
  }

  async updateCredencial(
    usuario: string,
    input: {
      nomeCompleto?: string;
      perfil?: "setor" | "admin" | "superadmin";
      ativo?: boolean;
      senha?: string;
      deveAlterarSenha?: boolean;
      operador: string;
    },
  ) {
    const before = await prisma.credencial.findUnique({
      where: { usuario },
      select: {
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    if (!before) {
      throw new AppError(404, "CREDENCIAL_NOT_FOUND", "Credencial nao encontrada");
    }

    const senhaHash = input.senha ? await bcrypt.hash(input.senha, env.BCRYPT_ROUNDS) : undefined;

    const updated = await prisma.credencial.update({
      where: { usuario },
      data: {
        nomeCompleto: input.nomeCompleto,
        perfil: input.perfil
          ? input.perfil === "superadmin"
            ? Perfil.superadmin
            : input.perfil === "admin"
              ? Perfil.admin
              : Perfil.setor
          : undefined,
        ativo: input.ativo,
        senhaHash,
        deveAlterarSenha: input.deveAlterarSenha,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
      select: {
        id: true,
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "credenciais",
      operacao: "UPDATE",
      registroId: usuario,
      dadosAntes: before,
      dadosDepois: updated,
    });

    return updated;
  }

  async deleteCredencial(usuario: string, operador: string) {
    const before = await prisma.credencial.findUnique({
      where: { usuario },
      select: {
        id: true,
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    if (!before) {
      throw new AppError(404, "CREDENCIAL_NOT_FOUND", "Credencial nao encontrada");
    }

    try {
      await prisma.credencial.delete({ where: { usuario } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new AppError(
          409,
          "CREDENCIAL_DEPENDENTE",
          "Credencial possui dependencias e nao pode ser removida com hard delete",
        );
      }
      throw err;
    }

    await this.audit({
      operador,
      entidade: "credenciais",
      operacao: "DELETE",
      registroId: usuario,
      dadosAntes: before,
      dadosDepois: null,
    });
  }

  async getConfiguracoes() {
    return prisma.configuracao.findMany({ orderBy: [{ chave: "asc" }] });
  }

  async setMaxKitsPorFuncionario(valor: number, operador: string) {
    return this.upsertConfiguracao("MAX_KITS_POR_FUNCIONARIO", String(valor), operador);
  }

  async resetConfiguracoes(chaves: string[] | undefined, operador: string) {
    const requested = chaves && chaves.length > 0 ? [...new Set(chaves)] : CONFIG_DEFAULT_KEYS;
    const invalidas = requested.filter((chave) => !isConfiguracaoComPadrao(chave));

    if (invalidas.length > 0) {
      throw new AppError(
        400,
        "INVALID_PAYLOAD",
        `Chaves de configuracao invalidas: ${invalidas.join(", ")}`,
      );
    }

    const chavesReset = requested.filter(isConfiguracaoComPadrao);
    const existentes = await prisma.configuracao.findMany({
      where: { chave: { in: chavesReset } },
    });
    const beforeByKey = new Map(existentes.map((row) => [row.chave, row]));
    const atualizadoEm = new Date();

    const atualizadas = await prisma.$transaction(
      chavesReset.map((chave) =>
        prisma.configuracao.upsert({
          where: { chave },
          update: {
            valor: CONFIG_DEFAULTS[chave],
            atualizadoPor: operador,
            atualizadoEm,
          },
          create: {
            chave,
            valor: CONFIG_DEFAULTS[chave],
            atualizadoPor: operador,
            atualizadoEm,
          },
        }),
      ),
    );

    await Promise.all(
      atualizadas.map((row) =>
        this.audit({
          operador,
          entidade: "configuracoes",
          operacao: "UPDATE",
          registroId: row.chave,
          dadosAntes: beforeByKey.get(row.chave) ?? null,
          dadosDepois: row,
        }),
      ),
    );

    await this.invalidateDashboardCaches();

    return atualizadas.sort((a, b) => a.chave.localeCompare(b.chave));
  }

  async gerarBackupBanco(operador: string) {
    const [
      configuracoes,
      credenciais,
      unidades,
      setores,
      funcoes,
      funcionarios,
      itens,
      solicitacoes,
      devolucoes,
      auditoria,
    ] = await Promise.all([
      prisma.configuracao.findMany({ orderBy: [{ chave: "asc" }] }),
      prisma.credencial.findMany({
        orderBy: [{ usuario: "asc" }],
        select: {
          usuario: true,
          senhaHash: true,
          perfil: true,
          nomeCompleto: true,
          ativo: true,
          deveAlterarSenha: true,
          temaPreferido: true,
          criadoEm: true,
          criadoPor: true,
          atualizadoPor: true,
          atualizadoEm: true,
        },
      }),
      prisma.unidade.findMany({
        orderBy: [{ nome: "asc" }],
        select: {
          nome: true,
          statusAtivo: true,
          criadoEm: true,
          atualizadoPor: true,
          atualizadoEm: true,
        },
      }),
      prisma.setor.findMany({
        orderBy: [{ nome: "asc" }],
        select: {
          nome: true,
          statusAtivo: true,
          criadoEm: true,
          atualizadoPor: true,
          atualizadoEm: true,
        },
      }),
      prisma.funcao.findMany({
        orderBy: [{ nome: "asc" }],
        select: {
          nome: true,
          statusAtivo: true,
          criadoEm: true,
          atualizadoPor: true,
          atualizadoEm: true,
        },
      }),
      prisma.funcionario.findMany({
        orderBy: [{ matricula: "asc" }],
        select: {
          matricula: true,
          nome: true,
          unidade: true,
          setor: true,
          funcao: true,
          statusAtivo: true,
          criadoEm: true,
          atualizadoPor: true,
          atualizadoEm: true,
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
        },
      }),
      prisma.item.findMany({
        orderBy: [{ codigo: "asc" }],
        select: {
          codigo: true,
          descricao: true,
          tamanho: true,
          status: true,
          solicitanteMatricula: true,
          dataEmprestimo: true,
          statusAtivo: true,
          criadoEm: true,
          atualizadoPor: true,
          atualizadoEm: true,
        },
      }),
      prisma.solicitacao.findMany({
        orderBy: [{ timestamp: "asc" }],
        select: {
          timestamp: true,
          matricula: true,
          nomeFuncionario: true,
          itemCodigo: true,
          operadorNome: true,
        },
      }),
      prisma.devolucao.findMany({
        orderBy: [{ timestamp: "asc" }],
        select: {
          timestamp: true,
          matricula: true,
          nomeFuncionario: true,
          itemCodigo: true,
          operadorNome: true,
        },
      }),
      prisma.auditoria.findMany({
        orderBy: [{ timestamp: "asc" }],
        select: {
          timestamp: true,
          operador: true,
          entidade: true,
          operacao: true,
          registroId: true,
          dadosAntes: true,
          dadosDepois: true,
        },
      }),
    ]);

    const funcionariosBackup = funcionarios.map((row) => {
      const setores = row.setores
        .map((item) => item.setor.nome)
        .filter(Boolean);
      const funcoes = row.funcoes
        .map((item) => item.funcao.nome)
        .filter(Boolean);
      const unidades = row.unidades
        .map((item) => item.unidade.nome)
        .filter(Boolean);
      return {
        matricula: row.matricula,
        nome: row.nome,
        unidade: row.unidade,
        unidades,
        setor: row.setor,
        setores,
        funcao: row.funcao,
        funcoes,
        statusAtivo: row.statusAtivo,
        criadoEm: row.criadoEm,
        atualizadoPor: row.atualizadoPor,
        atualizadoEm: row.atualizadoEm,
      };
    });

    return {
      versao_formato: BACKUP_FORMAT_VERSION,
      gerado_em: new Date().toISOString(),
      gerado_por: operador,
      dados: {
        configuracoes,
        credenciais,
        unidades,
        setores,
        funcoes,
        funcionarios: funcionariosBackup,
        itens,
        solicitacoes,
        devolucoes,
        auditoria,
      },
    };
  }

  async resetBanco(input: {
    alvos?: ResetDbTarget[];
    preservarUsuarioAtual?: boolean;
    usuarioAtual?: string;
    operador: string;
  }) {
    const alvos = input.alvos && input.alvos.length > 0 ? [...new Set(input.alvos)] : [...RESET_DB_TARGETS];
    const contagens = this.criarContadoresReset();
    const now = new Date();
    const preservarUsuarioAtual = input.preservarUsuarioAtual !== false && Boolean(input.usuarioAtual);

    await prisma.$transaction(async (tx) => {
      if (alvos.includes("credenciais") && input.usuarioAtual && preservarUsuarioAtual) {
        contagens.credenciais = (
          await tx.credencial.deleteMany({
            where: { usuario: { not: input.usuarioAtual } },
          })
        ).count;
      } else if (alvos.includes("credenciais")) {
        contagens.credenciais = (await tx.credencial.deleteMany({})).count;
      }

      if (alvos.includes("auditoria")) {
        contagens.auditoria = (await tx.auditoria.deleteMany({})).count;
      }

      if (alvos.includes("devolucoes")) {
        contagens.devolucoes = (await tx.devolucao.deleteMany({})).count;
      }

      if (alvos.includes("solicitacoes")) {
        contagens.solicitacoes = (await tx.solicitacao.deleteMany({})).count;
      }

      if (alvos.includes("itens")) {
        contagens.itens = (await tx.item.deleteMany({})).count;
      } else if (alvos.includes("funcionarios")) {
        await tx.item.updateMany({
          where: { solicitanteMatricula: { not: null } },
          data: {
            solicitanteMatricula: null,
            dataEmprestimo: null,
            status: "disponivel",
            atualizadoPor: input.operador,
            atualizadoEm: now,
          },
        });
      }

      if (alvos.includes("funcionarios")) {
        contagens.funcionarios = (await tx.funcionario.deleteMany({})).count;
      }

      if (alvos.includes("unidades")) {
        contagens.unidades = (await tx.unidade.deleteMany({})).count;
      }

      if (alvos.includes("setores")) {
        contagens.setores = (await tx.setor.deleteMany({})).count;
      }

      if (alvos.includes("funcoes")) {
        contagens.funcoes = (await tx.funcao.deleteMany({})).count;
      }

      if (alvos.includes("configuracoes")) {
        contagens.configuracoes = (await tx.configuracao.deleteMany({})).count;
        await tx.configuracao.createMany({
          data: CONFIG_DEFAULT_KEYS.map((chave) => ({
            chave,
            valor: CONFIG_DEFAULTS[chave],
            atualizadoPor: input.operador,
            atualizadoEm: now,
          })),
        });
      }
    });

    await this.invalidateDashboardCaches();

    return {
      alvos,
      contagens,
      usuarioPreservado:
        alvos.includes("credenciais") && input.usuarioAtual && preservarUsuarioAtual
          ? input.usuarioAtual
          : null,
    };
  }

  async restaurarBanco(input: {
    backup: { versao_formato: number; dados: BackupData };
    preservarUsuarioAtual?: boolean;
    usuarioAtual?: string;
    operador: string;
  }) {
    const now = new Date();
    const preservarUsuarioAtual = input.preservarUsuarioAtual !== false && Boolean(input.usuarioAtual);

    const credencialAtual =
      preservarUsuarioAtual && input.usuarioAtual
        ? await prisma.credencial.findUnique({
            where: { usuario: input.usuarioAtual },
            select: {
              usuario: true,
              senhaHash: true,
              perfil: true,
              nomeCompleto: true,
              ativo: true,
              deveAlterarSenha: true,
              temaPreferido: true,
              criadoEm: true,
              criadoPor: true,
              atualizadoPor: true,
              atualizadoEm: true,
            },
          })
        : null;

    if (input.backup.dados.credenciais.length === 0 && !credencialAtual) {
      throw new AppError(
        400,
        "INVALID_PAYLOAD",
        "Backup sem credenciais e sem usuario atual para preservacao",
      );
    }

    const funcionariosBackup = new Set(input.backup.dados.funcionarios.map((row) => row.matricula));
    const itensComMatriculaInvalida = input.backup.dados.itens
      .filter((row) => row.solicitanteMatricula && !funcionariosBackup.has(row.solicitanteMatricula))
      .map((row) => row.codigo);

    if (itensComMatriculaInvalida.length > 0) {
      throw new AppError(
        400,
        "INVALID_PAYLOAD",
        `Backup invalido: itens com matricula inexistente (${itensComMatriculaInvalida.slice(0, 10).join(", ")})`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditoria.deleteMany({});
      await tx.devolucao.deleteMany({});
      await tx.solicitacao.deleteMany({});
      await tx.item.deleteMany({});
      await tx.funcionario.deleteMany({});
      await tx.unidade.deleteMany({});
      await tx.setor.deleteMany({});
      await tx.funcao.deleteMany({});
      await tx.credencial.deleteMany({});
      await tx.configuracao.deleteMany({});

      if (input.backup.dados.configuracoes.length > 0) {
        await tx.configuracao.createMany({
          data: input.backup.dados.configuracoes.map((row) => ({
            chave: row.chave,
            valor: row.valor,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });
      } else {
        await tx.configuracao.createMany({
          data: CONFIG_DEFAULT_KEYS.map((chave) => ({
            chave,
            valor: CONFIG_DEFAULTS[chave],
            atualizadoPor: input.operador,
            atualizadoEm: now,
          })),
        });
      }

      if (input.backup.dados.credenciais.length > 0) {
        await tx.credencial.createMany({
          data: input.backup.dados.credenciais.map((row) => ({
            usuario: row.usuario,
            senhaHash: row.senhaHash,
            perfil: row.perfil === "superadmin"
              ? Perfil.superadmin
              : row.perfil === "admin"
                ? Perfil.admin
                : Perfil.setor,
            nomeCompleto: row.nomeCompleto,
            ativo: row.ativo,
            deveAlterarSenha: row.deveAlterarSenha,
            temaPreferido: row.temaPreferido || "light",
            criadoEm: this.toDateOrNull(row.criadoEm) ?? now,
            criadoPor: row.criadoPor || input.operador,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });
      }

      if (
        credencialAtual &&
        !input.backup.dados.credenciais.some((row) => row.usuario === credencialAtual.usuario)
      ) {
        await tx.credencial.create({
          data: {
            usuario: credencialAtual.usuario,
            senhaHash: credencialAtual.senhaHash,
            perfil: credencialAtual.perfil,
            nomeCompleto: credencialAtual.nomeCompleto,
            ativo: credencialAtual.ativo,
            deveAlterarSenha: credencialAtual.deveAlterarSenha,
            temaPreferido: credencialAtual.temaPreferido,
            criadoEm: credencialAtual.criadoEm,
            criadoPor: credencialAtual.criadoPor,
            atualizadoPor: credencialAtual.atualizadoPor,
            atualizadoEm: credencialAtual.atualizadoEm,
          },
        });
      }

      if (input.backup.dados.setores.length > 0) {
        await tx.setor.createMany({
          data: input.backup.dados.setores.map((row) => ({
            nome: row.nome,
            statusAtivo: row.statusAtivo,
            criadoEm: this.toDateOrNull(row.criadoEm) ?? now,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });
      }

      if (input.backup.dados.unidades.length > 0) {
        await tx.unidade.createMany({
          data: input.backup.dados.unidades.map((row) => ({
            nome: row.nome,
            statusAtivo: row.statusAtivo,
            criadoEm: this.toDateOrNull(row.criadoEm) ?? now,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });
      }

      if (input.backup.dados.funcoes.length > 0) {
        await tx.funcao.createMany({
          data: input.backup.dados.funcoes.map((row) => ({
            nome: row.nome,
            statusAtivo: row.statusAtivo,
            criadoEm: this.toDateOrNull(row.criadoEm) ?? now,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });
      }

      if (input.backup.dados.funcionarios.length > 0) {
        const [unidadesDisponiveis, setoresDisponiveis, funcoesDisponiveis] = await Promise.all([
          tx.unidade.findMany({
            select: { id: true, nome: true },
          }),
          tx.setor.findMany({
            select: { id: true, nome: true },
          }),
          tx.funcao.findMany({
            select: { id: true, nome: true },
          }),
        ]);
        const unidadeIdByNome = new Map(unidadesDisponiveis.map((row) => [row.nome, row.id]));
        const setorIdByNome = new Map(setoresDisponiveis.map((row) => [row.nome, row.id]));
        const funcaoIdByNome = new Map(funcoesDisponiveis.map((row) => [row.nome, row.id]));

        const funcionariosNormalizados = input.backup.dados.funcionarios.map((row) => {
          const matricula = this.normalizarMatricula(row.matricula);
          const nome = this.normalizarNome(row.nome);
          const unidades = this.normalizarUnidades(row.unidades, row.unidade);
          if (unidades.length === 0) {
            throw new AppError(
              400,
              "INVALID_PAYLOAD",
              `Backup invalido: funcionario ${matricula} sem unidade definida`,
            );
          }
          const setores = this.normalizarSetores(row.setores, row.setor);
          if (setores.length === 0) {
            throw new AppError(
              400,
              "INVALID_PAYLOAD",
              `Backup invalido: funcionario ${matricula} sem setor definido`,
            );
          }

          const funcoes = this.normalizarFuncoes(row.funcoes, row.funcao);
          if (funcoes.length === 0) {
            throw new AppError(
              400,
              "INVALID_PAYLOAD",
              `Backup invalido: funcionario ${matricula} sem funcao definida`,
            );
          }

          return {
            row: {
              ...row,
              matricula,
              nome,
            },
            unidades,
            setores,
            funcoes,
          };
        });

        const unidadesInvalidas = [...new Set(
          funcionariosNormalizados
            .flatMap((item) => item.unidades)
            .filter((nome) => !unidadeIdByNome.has(nome)),
        )];

        if (unidadesInvalidas.length > 0) {
          throw new AppError(
            400,
            "INVALID_PAYLOAD",
            `Backup invalido: unidades inexistentes (${unidadesInvalidas.slice(0, 10).join(", ")})`,
          );
        }

        const setoresInvalidos = [...new Set(
          funcionariosNormalizados
            .flatMap((item) => item.setores)
            .filter((nome) => !setorIdByNome.has(nome)),
        )];

        if (setoresInvalidos.length > 0) {
          throw new AppError(
            400,
            "INVALID_PAYLOAD",
            `Backup invalido: setores inexistentes (${setoresInvalidos.slice(0, 10).join(", ")})`,
          );
        }

        const funcoesInvalidas = [...new Set(
          funcionariosNormalizados
            .flatMap((item) => item.funcoes)
            .filter((nome) => !funcaoIdByNome.has(nome)),
        )];

        if (funcoesInvalidas.length > 0) {
          throw new AppError(
            400,
            "INVALID_PAYLOAD",
            `Backup invalido: funcoes inexistentes (${funcoesInvalidas.slice(0, 10).join(", ")})`,
          );
        }

        await tx.funcionario.createMany({
          data: funcionariosNormalizados.map(({ row, unidades, setores, funcoes }) => ({
            matricula: row.matricula,
            nome: row.nome,
            unidade: unidades[0],
            setor: setores[0],
            funcao: funcoes[0],
            statusAtivo: row.statusAtivo,
            criadoEm: this.toDateOrNull(row.criadoEm) ?? now,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });

        await tx.funcionarioSetor.createMany({
          data: funcionariosNormalizados.flatMap(({ row, setores }) =>
            setores.map((setorNome) => ({
              funcionarioMatricula: row.matricula,
              setorId: setorIdByNome.get(setorNome)!,
            })),
          ),
          skipDuplicates: true,
        });

        await tx.funcionarioFuncao.createMany({
          data: funcionariosNormalizados.flatMap(({ row, funcoes }) =>
            funcoes.map((funcaoNome) => ({
              funcionarioMatricula: row.matricula,
              funcaoId: funcaoIdByNome.get(funcaoNome)!,
            })),
          ),
          skipDuplicates: true,
        });

        await tx.funcionarioUnidade.createMany({
          data: funcionariosNormalizados.flatMap(({ row, unidades }) =>
            unidades.map((unidadeNome) => ({
              funcionarioMatricula: row.matricula,
              unidadeId: unidadeIdByNome.get(unidadeNome)!,
            })),
          ),
          skipDuplicates: true,
        });
      }

      if (input.backup.dados.itens.length > 0) {
        await tx.item.createMany({
          data: input.backup.dados.itens.map((row) => ({
            codigo: row.codigo,
            descricao: row.descricao,
            tamanho: row.tamanho,
            status:
              row.status === "emprestado"
                ? StatusItem.emprestado
                : row.status === "inativo"
                  ? StatusItem.inativo
                  : StatusItem.disponivel,
            solicitanteMatricula: row.solicitanteMatricula,
            dataEmprestimo: this.toDateOrNull(row.dataEmprestimo),
            statusAtivo: row.statusAtivo,
            criadoEm: this.toDateOrNull(row.criadoEm) ?? now,
            atualizadoPor: row.atualizadoPor,
            atualizadoEm: this.toDateOrNull(row.atualizadoEm),
          })),
        });
      }

      if (input.backup.dados.solicitacoes.length > 0) {
        await tx.solicitacao.createMany({
          data: input.backup.dados.solicitacoes.map((row) => ({
            timestamp: this.toDateOrNull(row.timestamp) ?? now,
            matricula: row.matricula,
            nomeFuncionario: row.nomeFuncionario,
            itemCodigo: row.itemCodigo,
            operadorNome: row.operadorNome,
          })),
        });
      }

      if (input.backup.dados.devolucoes.length > 0) {
        await tx.devolucao.createMany({
          data: input.backup.dados.devolucoes.map((row) => ({
            timestamp: this.toDateOrNull(row.timestamp) ?? now,
            matricula: row.matricula,
            nomeFuncionario: row.nomeFuncionario,
            itemCodigo: row.itemCodigo,
            operadorNome: row.operadorNome,
          })),
        });
      }

      if (input.backup.dados.auditoria.length > 0) {
        await tx.auditoria.createMany({
          data: input.backup.dados.auditoria.map((row) => ({
            timestamp: this.toDateOrNull(row.timestamp) ?? now,
            operador: row.operador,
            entidade: row.entidade,
            operacao: row.operacao,
            registroId: row.registroId,
            dadosAntes: this.toJsonField(row.dadosAntes),
            dadosDepois: this.toJsonField(row.dadosDepois),
          })),
        });
      }
    });

    await this.invalidateDashboardCaches();
    const preservouCredencialAtual = Boolean(
      credencialAtual &&
      !input.backup.dados.credenciais.some((row) => row.usuario === credencialAtual.usuario),
    );

    return {
      restauradoEm: now.toISOString(),
      usuarioPreservado:
        preservouCredencialAtual && credencialAtual ? credencialAtual.usuario : null,
      contagens: {
        configuracoes: input.backup.dados.configuracoes.length || CONFIG_DEFAULT_KEYS.length,
        credenciais: input.backup.dados.credenciais.length + (preservouCredencialAtual ? 1 : 0),
        unidades: input.backup.dados.unidades.length,
        setores: input.backup.dados.setores.length,
        funcoes: input.backup.dados.funcoes.length,
        funcionarios: input.backup.dados.funcionarios.length,
        itens: input.backup.dados.itens.length,
        solicitacoes: input.backup.dados.solicitacoes.length,
        devolucoes: input.backup.dados.devolucoes.length,
        auditoria: input.backup.dados.auditoria.length,
      },
    };
  }

  async listAuditoria(limit = 100) {
    return prisma.auditoria.findMany({
      orderBy: [{ timestamp: "desc" }],
      take: limit,
    });
  }

  private async audit(input: {
    operador: string;
    entidade: string;
    operacao: string;
    registroId: string;
    dadosAntes: unknown;
    dadosDepois: unknown;
  }) {
    await prisma.auditoria.create({
      data: {
        operador: input.operador,
        entidade: input.entidade,
        operacao: input.operacao,
        registroId: input.registroId,
        dadosAntes:
          input.dadosAntes === null
            ? Prisma.JsonNull
            : (input.dadosAntes as Prisma.InputJsonValue),
        dadosDepois:
          input.dadosDepois === null
            ? Prisma.JsonNull
            : (input.dadosDepois as Prisma.InputJsonValue),
      },
    });
  }

  private criarContadoresReset(): Record<ResetDbTarget, number> {
    return {
      credenciais: 0,
      configuracoes: 0,
      unidades: 0,
      setores: 0,
      funcoes: 0,
      funcionarios: 0,
      itens: 0,
      solicitacoes: 0,
      devolucoes: 0,
      auditoria: 0,
    };
  }

  private toDateOrNull(value: string | Date | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toJsonField(value: unknown) {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private normalizarMatricula(matricula: string) {
    const normalizada = matricula.trim();
    if (!normalizada) {
      throw new AppError(400, "MATRICULA_INVALIDA", "Informe a matricula do funcionario");
    }
    return normalizada;
  }

  private normalizarNome(nome: string) {
    const normalizado = nome.trim();
    if (!normalizado) {
      throw new AppError(400, "NOME_INVALIDO", "Informe o nome do funcionario");
    }
    return normalizado;
  }

  private normalizarListaNomes(candidatos: Array<string | null | undefined>) {
    const vistos = new Set<string>();
    const nomes: string[] = [];

    for (const nome of candidatos) {
      const normalizado = (nome ?? "").trim();
      if (!normalizado || vistos.has(normalizado)) {
        continue;
      }
      vistos.add(normalizado);
      nomes.push(normalizado);
    }

    return nomes;
  }

  private normalizarUnidades(unidadesInput?: string[] | null, unidadePrincipal?: string | null) {
    return this.normalizarListaNomes([unidadePrincipal, ...(unidadesInput ?? [])]);
  }

  private normalizarSetores(setoresInput?: string[] | null, setorPrincipal?: string | null) {
    return this.normalizarListaNomes([setorPrincipal, ...(setoresInput ?? [])]);
  }

  private normalizarFuncoes(funcoesInput?: string[] | null, funcaoPrincipal?: string | null) {
    return this.normalizarListaNomes([funcaoPrincipal, ...(funcoesInput ?? [])]);
  }

  private validarUnidadesAtivas(unidadesSolicitadas: string[], unidadesAtivas: string[]) {
    const ativas = new Set(unidadesAtivas);
    const invalidas = unidadesSolicitadas.filter((nome) => !ativas.has(nome));

    if (invalidas.length > 0) {
      throw new AppError(
        400,
        "UNIDADE_INVALIDA",
        `Unidade invalida ou inativa: ${invalidas.join(", ")}`,
      );
    }
  }

  private validarSetoresAtivos(setoresSolicitados: string[], setoresAtivos: string[]) {
    const ativos = new Set(setoresAtivos);
    const invalidos = setoresSolicitados.filter((nome) => !ativos.has(nome));

    if (invalidos.length > 0) {
      throw new AppError(
        400,
        "SETOR_INVALIDO",
        `Setor invalido ou inativo: ${invalidos.join(", ")}`,
      );
    }
  }

  private validarFuncoesAtivas(funcoesSolicitadas: string[], funcoesAtivas: string[]) {
    const ativas = new Set(funcoesAtivas);
    const invalidas = funcoesSolicitadas.filter((nome) => !ativas.has(nome));

    if (invalidas.length > 0) {
      throw new AppError(
        400,
        "FUNCAO_INVALIDA",
        `Funcao invalida ou inativa: ${invalidas.join(", ")}`,
      );
    }
  }

  private mapFuncionarioComSetores(row: {
    matricula: string;
    nome: string;
    unidade: string;
    setor: string;
    funcao: string;
    statusAtivo: boolean;
    unidades: Array<{ unidade: { nome: string } }>;
    setores: Array<{ setor: { nome: string } }>;
    funcoes: Array<{ funcao: { nome: string } }>;
  }): FuncionarioComSetores {
    const unidades = this.normalizarUnidades(
      [row.unidade, ...row.unidades.map((item) => item.unidade.nome)],
    );
    const setores = this.normalizarSetores(
      [row.setor, ...row.setores.map((item) => item.setor.nome)],
    );
    const funcoes = this.normalizarFuncoes(
      [row.funcao, ...row.funcoes.map((item) => item.funcao.nome)],
    );

    return {
      matricula: row.matricula,
      nome: row.nome,
      unidade: row.unidade,
      setor: row.setor,
      funcao: row.funcao,
      statusAtivo: row.statusAtivo,
      unidades,
      setores,
      funcoes,
    };
  }

  private async invalidateDashboardCaches() {
    await dashboardService.invalidateCache();
    await dashboardService.invalidateFilterCache();
  }

  private async upsertConfiguracao(chave: string, valor: string, operador: string) {
    const before = await prisma.configuracao.findUnique({ where: { chave } });

    const updated = await prisma.configuracao.upsert({
      where: { chave },
      update: {
        valor,
        atualizadoPor: operador,
        atualizadoEm: new Date(),
      },
      create: {
        chave,
        valor,
        atualizadoPor: operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador,
      entidade: "configuracoes",
      operacao: "UPDATE",
      registroId: chave,
      dadosAntes: before,
      dadosDepois: updated,
    });
    await this.invalidateDashboardCaches();

    return updated;
  }
}
