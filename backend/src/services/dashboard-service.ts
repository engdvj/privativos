import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

const DASHBOARD_DATA_CACHE_VERSION = "v5";
type OrigemDashboard = "colaborador" | "setor";

export interface DashboardFiltros {
  data_inicio?: string;
  data_fim?: string;
  unidade?: string;
  setor?: string;
  matricula?: string;
  origem?: OrigemDashboard;
}

type DashboardFiltrosNormalizados = Required<Omit<DashboardFiltros, "origem">> & {
  origem: OrigemDashboard | "";
};

interface DashboardResponse {
  kpis: {
    total_emprestimos: number;
    total_devolucoes: number;
    itens_disponiveis: number;
    itens_emprestados: number;
    funcionarios_ativos: number;
  };
  rows: {
    solicitacoes: Array<{
      id: number;
      timestamp: string;
      matricula: string;
      nome_funcionario: string;
      item_codigo: string;
      operador_nome: string;
      unidade: string | null;
      setor: string | null;
      origem: OrigemDashboard;
      setor_solicitante: string | null;
    }>;
    devolucoes: Array<{
      id: number;
      timestamp: string;
      matricula: string;
      nome_funcionario: string;
      item_codigo: string;
      operador_nome: string;
      unidade: string | null;
      setor: string | null;
      origem: OrigemDashboard;
      setor_solicitante: string | null;
    }>;
  };
  total: number;
  gerado_em: string;
}

export class DashboardService {
  async getData(filtros: DashboardFiltros): Promise<DashboardResponse> {
    const normalized = this.normalizeFilters(filtros);
    const cacheKey = this.cacheKey(normalized);
    const startDate = this.parseStartDate(normalized.data_inicio);
    const endDate = this.parseEndDate(normalized.data_fim);

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as DashboardResponse;
    }

    const whereSolicitacoes = {
      ...(normalized.matricula ? { matricula: normalized.matricula } : {}),
      ...(normalized.origem ? { origemOperacao: normalized.origem } : {}),
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const whereDevolucoes = {
      ...(normalized.matricula ? { matricula: normalized.matricula } : {}),
      ...(normalized.origem ? { origemOperacao: normalized.origem } : {}),
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [solicitacoes, devolucoes, itensDisponiveis, itensEmprestados, funcionariosAtivos, unidadesAtivasRaw, setoresRaw] =
      await Promise.all([
        prisma.solicitacao.findMany({
          where: whereSolicitacoes,
          orderBy: [{ timestamp: "desc" }],
          take: 1000,
        }),
        prisma.devolucao.findMany({
          where: whereDevolucoes,
          orderBy: [{ timestamp: "desc" }],
          take: 1000,
        }),
        prisma.item.count({ where: { statusAtivo: true, status: "disponivel" } }),
        prisma.item.count({ where: { statusAtivo: true, status: "emprestado" } }),
        prisma.funcionario.count({ where: { statusAtivo: true } }),
        prisma.unidade.findMany({
          where: { statusAtivo: true },
          select: { nome: true },
        }),
        prisma.setor.findMany({
          select: {
            nome: true,
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
      ]);
    const itensEmprestadosSetor = await prisma.item.findMany({
      where: {
        statusAtivo: true,
        status: "emprestado",
        setorSolicitante: { not: null },
      },
      select: {
        id: true,
        codigo: true,
        setorSolicitante: true,
        dataEmprestimo: true,
        atualizadoEm: true,
      },
      orderBy: [{ dataEmprestimo: "desc" }, { atualizadoEm: "desc" }],
      take: 1000,
    });
    const unidadesAtivas = new Set(
      unidadesAtivasRaw.map((row) => row.nome.trim()).filter(Boolean),
    );
    const unidadesBySetor = new Map(
      setoresRaw.map((setor) => [
        setor.nome,
        this.extractUnidades(
          "",
          setor.unidades.map((item) => item.unidade.nome),
          unidadesAtivas,
        ),
      ] as const),
    );
    const unidadesBySetorNormalized = new Map(
      [...unidadesBySetor.entries()].map(([nome, unidades]) => [
        nome.toLocaleLowerCase("pt-BR"),
        unidades,
      ] as const),
    );
    const obterUnidadesSetor = (setorSolicitante: string | null | undefined) => {
      const setor = this.normalizeOptionalText(setorSolicitante);
      if (!setor) {
        return [] as string[];
      }
      const direto = unidadesBySetor.get(setor);
      if (direto) {
        return direto;
      }
      return unidadesBySetorNormalized.get(setor.toLocaleLowerCase("pt-BR")) ?? [];
    };

    const matriculas = new Set<string>();
    for (const s of solicitacoes) {
      if (this.normalizeOrigemOperacao(s.origemOperacao) === "colaborador") {
        matriculas.add(s.matricula);
      }
    }
    for (const d of devolucoes) {
      if (this.normalizeOrigemOperacao(d.origemOperacao) === "colaborador") {
        matriculas.add(d.matricula);
      }
    }

    const funcionarios = matriculas.size
      ? await prisma.funcionario.findMany({
          where: { matricula: { in: Array.from(matriculas) } },
          select: {
            matricula: true,
            unidade: true,
            setor: true,
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
          },
        })
      : [];

    const setoresByMatricula = new Map(
      funcionarios.map((funcionario) => [
        funcionario.matricula,
        this.extractSetores(funcionario.setor, funcionario.setores.map((item) => item.setor.nome)),
      ]),
    );
    const unidadesByMatricula = new Map(
      funcionarios.map((funcionario) => [
        funcionario.matricula,
        this.extractUnidades(
          funcionario.unidade,
          funcionario.unidades.map((item) => item.unidade.nome),
          unidadesAtivas,
        ),
      ]),
    );

    let solicitacoesRows = solicitacoes.map((s) => {
      const origem = this.normalizeOrigemOperacao(s.origemOperacao);
      const setorFuncionario = this.formatSetorLabel(setoresByMatricula.get(s.matricula) ?? []);
      const setorSolicitante = this.normalizeOptionalText(s.setorSolicitante);
      return {
        id: s.id,
        timestamp: s.timestamp.toISOString(),
        matricula: s.matricula,
        nome_funcionario: s.nomeFuncionario,
        item_codigo: s.itemCodigo,
        operador_nome: s.operadorNome,
        unidade:
          origem === "setor"
            ? this.formatUnidadeLabel(obterUnidadesSetor(setorSolicitante))
            : this.formatUnidadeLabel(unidadesByMatricula.get(s.matricula) ?? []),
        setor: origem === "setor" ? setorSolicitante : setorFuncionario,
        origem,
        setor_solicitante: setorSolicitante,
      };
    });

    let devolucoesRows = devolucoes.map((d) => {
      const origem = this.normalizeOrigemOperacao(d.origemOperacao);
      const setorFuncionario = this.formatSetorLabel(setoresByMatricula.get(d.matricula) ?? []);
      const setorSolicitante = this.normalizeOptionalText(d.setorSolicitante);
      return {
        id: d.id,
        timestamp: d.timestamp.toISOString(),
        matricula: d.matricula,
        nome_funcionario: d.nomeFuncionario,
        item_codigo: d.itemCodigo,
        operador_nome: d.operadorNome,
        unidade:
          origem === "setor"
            ? this.formatUnidadeLabel(obterUnidadesSetor(setorSolicitante))
            : this.formatUnidadeLabel(unidadesByMatricula.get(d.matricula) ?? []),
        setor: origem === "setor" ? setorSolicitante : setorFuncionario,
        origem,
        setor_solicitante: setorSolicitante,
      };
    });

    if (normalized.origem !== "colaborador") {
      const solicitacoesSetorExistentes = new Set(
        solicitacoesRows
          .filter((row) => row.origem === "setor")
          .map((row) => `${row.item_codigo}::${row.setor_solicitante ?? ""}`),
      );

      const solicitacoesSetorFallback = itensEmprestadosSetor
        .map((item) => {
          const setor = this.normalizeOptionalText(item.setorSolicitante);
          if (!setor) {
            return null;
          }

          const timestamp = item.dataEmprestimo ?? item.atualizadoEm;
          if (!timestamp) {
            return null;
          }

          if (startDate && timestamp < startDate) {
            return null;
          }
          if (endDate && timestamp > endDate) {
            return null;
          }

          const key = `${item.codigo}::${setor}`;
          if (solicitacoesSetorExistentes.has(key)) {
            return null;
          }

          return {
            id: -item.id,
            timestamp: timestamp.toISOString(),
            matricula: "__SETOR__",
            nome_funcionario: `Setor ${setor}`,
            item_codigo: item.codigo,
            operador_nome: "Operacao setor",
            unidade: this.formatUnidadeLabel(obterUnidadesSetor(setor)),
            setor,
            origem: "setor" as const,
            setor_solicitante: setor,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      if (solicitacoesSetorFallback.length > 0) {
        solicitacoesRows = [...solicitacoesSetorFallback, ...solicitacoesRows].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() || b.id - a.id,
        );
      }
    }

    if (normalized.unidade) {
      solicitacoesRows = solicitacoesRows.filter((row) => {
        if (row.origem === "setor") {
          return obterUnidadesSetor(row.setor_solicitante).includes(normalized.unidade);
        }
        return (unidadesByMatricula.get(row.matricula) ?? []).includes(normalized.unidade);
      });
      devolucoesRows = devolucoesRows.filter((row) => {
        if (row.origem === "setor") {
          return obterUnidadesSetor(row.setor_solicitante).includes(normalized.unidade);
        }
        return (unidadesByMatricula.get(row.matricula) ?? []).includes(normalized.unidade);
      });
    }

    if (normalized.setor) {
      solicitacoesRows = solicitacoesRows.filter((row) => {
        if (row.origem === "setor") {
          return row.setor_solicitante === normalized.setor;
        }
        return (setoresByMatricula.get(row.matricula) ?? []).includes(normalized.setor);
      });
      devolucoesRows = devolucoesRows.filter((row) => {
        if (row.origem === "setor") {
          return row.setor_solicitante === normalized.setor;
        }
        return (setoresByMatricula.get(row.matricula) ?? []).includes(normalized.setor);
      });
    }

    const data: DashboardResponse = {
      kpis: {
        total_emprestimos: solicitacoesRows.length,
        total_devolucoes: devolucoesRows.length,
        itens_disponiveis: itensDisponiveis,
        itens_emprestados: itensEmprestados,
        funcionarios_ativos: funcionariosAtivos,
      },
      rows: {
        solicitacoes: solicitacoesRows,
        devolucoes: devolucoesRows,
      },
      total: solicitacoesRows.length + devolucoesRows.length,
      gerado_em: new Date().toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(data));
    return data;
  }

  async getFilterOptions() {
    const cacheKey = "dashboard:filters";
    const cached = await redis.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached) as Partial<{
        unidades: string[];
        setores: string[];
        funcionarios: Array<{ matricula: string; nome: string }>;
      }>;
      return {
        unidades: Array.isArray(parsed.unidades) ? parsed.unidades : [],
        setores: Array.isArray(parsed.setores) ? parsed.setores : [],
        funcionarios: Array.isArray(parsed.funcionarios) ? parsed.funcionarios : [],
      };
    }

    const [unidadesRaw, setoresRaw, funcionariosRaw] = await Promise.all([
      prisma.unidade.findMany({
        where: { statusAtivo: true },
        select: { nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.setor.findMany({
        where: { statusAtivo: true },
        select: { nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.funcionario.findMany({
        where: { statusAtivo: true },
        select: { matricula: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    const payload = {
      unidades: unidadesRaw.map((u) => u.nome),
      setores: setoresRaw.map((s) => s.nome),
      funcionarios: funcionariosRaw,
    };

    await redis.set(cacheKey, JSON.stringify(payload), "EX", 600);
    return payload;
  }

  async invalidateCache() {
    const keys: string[] = [];
    let cursor = "0";

    do {
      const result = await redis.scan(cursor, "MATCH", "dashboard:data:*", "COUNT", 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async invalidateFilterCache() {
    await redis.del("dashboard:filters");
  }

  private extractSetores(setorPrincipal: string, setoresRelacionados: string[]) {
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

  private extractUnidades(
    unidadePrincipal: string,
    unidadesRelacionadas: string[],
    unidadesAtivas?: Set<string>,
  ) {
    const vistos = new Set<string>();
    const unidades: string[] = [];

    for (const nome of [unidadePrincipal, ...unidadesRelacionadas]) {
      const normalizado = nome.trim();
      if (
        !normalizado ||
        vistos.has(normalizado) ||
        (unidadesAtivas && !unidadesAtivas.has(normalizado))
      ) {
        continue;
      }
      vistos.add(normalizado);
      unidades.push(normalizado);
    }

    return unidades;
  }

  private formatSetorLabel(setores: string[]) {
    if (setores.length === 0) {
      return null;
    }
    return setores.join(", ");
  }

  private formatUnidadeLabel(unidades: string[]) {
    if (unidades.length === 0) {
      return null;
    }
    return unidades.join(", ");
  }

  private cacheKey(filters: DashboardFiltrosNormalizados) {
    const payload = JSON.stringify(filters);
    const hash = createHash("sha256").update(payload).digest("hex");
    return `dashboard:data:${DASHBOARD_DATA_CACHE_VERSION}:${hash}`;
  }

  private normalizeFilters(input: DashboardFiltros): DashboardFiltrosNormalizados {
    const origemNormalizada = this.normalizeOrigemOperacao(input.origem);
    return {
      data_inicio: input.data_inicio ?? "",
      data_fim: input.data_fim ?? "",
      unidade: input.unidade ?? "",
      setor: input.setor ?? "",
      matricula: input.matricula ?? "",
      origem: input.origem ? origemNormalizada : "",
    };
  }

  private normalizeOrigemOperacao(value: string | null | undefined): OrigemDashboard {
    return value === "setor" ? "setor" : "colaborador";
  }

  private normalizeOptionalText(value: string | null | undefined) {
    const normalized = value?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  }

  private parseStartDate(value: string) {
    if (!value) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value}T00:00:00.000`);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed;
  }

  private parseEndDate(value: string) {
    if (!value) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value}T23:59:59.999`);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed;
  }
}
