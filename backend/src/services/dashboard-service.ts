import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

export interface DashboardFiltros {
  data_inicio?: string;
  data_fim?: string;
  unidade?: string;
  setor?: string;
  matricula?: string;
}

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
      timestamp: Date;
      matricula: string;
      nome_funcionario: string;
      item_codigo: string;
      operador_nome: string;
      unidade: string | null;
      setor: string | null;
    }>;
    devolucoes: Array<{
      id: number;
      timestamp: Date;
      matricula: string;
      nome_funcionario: string;
      item_codigo: string;
      operador_nome: string;
      unidade: string | null;
      setor: string | null;
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
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [solicitacoes, devolucoes, itensDisponiveis, itensEmprestados, funcionariosAtivos] =
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
      ]);

    const matriculas = new Set<string>();
    for (const s of solicitacoes) matriculas.add(s.matricula);
    for (const d of devolucoes) matriculas.add(d.matricula);

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
        this.extractUnidades(funcionario.unidade, funcionario.unidades.map((item) => item.unidade.nome)),
      ]),
    );

    let solicitacoesRows = solicitacoes.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      matricula: s.matricula,
      nome_funcionario: s.nomeFuncionario,
      item_codigo: s.itemCodigo,
      operador_nome: s.operadorNome,
      unidade: this.formatUnidadeLabel(unidadesByMatricula.get(s.matricula) ?? []),
      setor: this.formatSetorLabel(setoresByMatricula.get(s.matricula) ?? []),
    }));

    let devolucoesRows = devolucoes.map((d) => ({
      id: d.id,
      timestamp: d.timestamp,
      matricula: d.matricula,
      nome_funcionario: d.nomeFuncionario,
      item_codigo: d.itemCodigo,
      operador_nome: d.operadorNome,
      unidade: this.formatUnidadeLabel(unidadesByMatricula.get(d.matricula) ?? []),
      setor: this.formatSetorLabel(setoresByMatricula.get(d.matricula) ?? []),
    }));

    if (normalized.unidade) {
      solicitacoesRows = solicitacoesRows.filter((row) =>
        (unidadesByMatricula.get(row.matricula) ?? []).includes(normalized.unidade),
      );
      devolucoesRows = devolucoesRows.filter((row) =>
        (unidadesByMatricula.get(row.matricula) ?? []).includes(normalized.unidade),
      );
    }

    if (normalized.setor) {
      solicitacoesRows = solicitacoesRows.filter((row) =>
        (setoresByMatricula.get(row.matricula) ?? []).includes(normalized.setor),
      );
      devolucoesRows = devolucoesRows.filter((row) =>
        (setoresByMatricula.get(row.matricula) ?? []).includes(normalized.setor),
      );
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

  private extractUnidades(unidadePrincipal: string, unidadesRelacionadas: string[]) {
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

  private cacheKey(filters: Required<DashboardFiltros>) {
    const payload = JSON.stringify(filters);
    const hash = createHash("sha256").update(payload).digest("hex");
    return `dashboard:data:${hash}`;
  }

  private normalizeFilters(input: DashboardFiltros): Required<DashboardFiltros> {
    return {
      data_inicio: input.data_inicio ?? "",
      data_fim: input.data_fim ?? "",
      unidade: input.unidade ?? "",
      setor: input.setor ?? "",
      matricula: input.matricula ?? "",
    };
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
