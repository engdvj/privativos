import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/use-toast";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  Download,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import type { DashboardDataResponse, DashboardFiltersResponse } from "../types";

const ITENS_POR_PAGINA = 5;
const LIMITE_LISTA_DISTRIBUICAO_POPOVER = 4;

const FILTROS_INICIAIS = {
  data_inicio: "",
  data_fim: "",
  unidade: "",
  setor: "",
  matricula: "",
};

type MovimentacaoRow = DashboardDataResponse["rows"]["solicitacoes"][number];

const COLUNAS_MOVIMENTACAO: DataTableColumn<MovimentacaoRow>[] = [
  {
    key: "timestamp",
    title: "Data/Hora",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => new Date(row.timestamp).getTime(),
  },
  {
    key: "matricula",
    title: "Matricula",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => row.matricula,
  },
  {
    key: "nome",
    title: "Nome",
    align: "center",
    sortValue: (row) => row.nome_funcionario,
  },
  {
    key: "unidade",
    title: "Unidade",
    align: "center",
    sortValue: (row) => row.unidade ?? "",
  },
  {
    key: "setor",
    title: "Setor",
    align: "center",
    sortValue: (row) => row.setor ?? "",
  },
  {
    key: "item",
    title: "Item",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => row.item_codigo,
  },
];

type KpiChave = "emprestimos" | "devolucoes" | "disponiveis" | "emprestados";

type ItemDashboardResumo = {
  codigo: string;
  tamanho: string;
  status: "disponivel" | "emprestado" | "inativo";
  solicitanteMatricula: string | null;
  dataEmprestimo: string | null;
  statusAtivo: boolean;
};

type FuncionarioDashboardResumo = {
  matricula: string;
  nome: string;
  unidade: string;
  unidades: string[];
  setor: string;
  funcao: string;
  setores: string[];
  statusAtivo: boolean;
};

type ResumoDistribuicao = {
  label: string;
  valor: number;
  percentual: number;
};

type IndicadorRapido = {
  rotulo: string;
  valor: string;
  apoio?: string;
};

type ResumoKpi = {
  titulo: string;
  subtitulo: string;
  indicadores: IndicadorRapido[];
};

function normalizarLabel(valor: string | null | undefined, fallback = "Nao informado") {
  const limpo = (valor ?? "").trim();
  return limpo || fallback;
}

function setorPrincipal(setorLabel: string | null) {
  if (!setorLabel) return "Nao informado";
  const [primeiro] = setorLabel.split(",");
  return normalizarLabel(primeiro);
}

function montarDistribuicao(
  valores: Array<string | null | undefined>,
  {
    limite = 4,
    incluirOutros = true,
    fallback = "Nao informado",
  }: {
    limite?: number;
    incluirOutros?: boolean;
    fallback?: string;
  } = {},
) {
  if (valores.length === 0) {
    return [] satisfies ResumoDistribuicao[];
  }

  const contagem = new Map<string, number>();
  for (const valor of valores) {
    const label = normalizarLabel(valor, fallback);
    contagem.set(label, (contagem.get(label) ?? 0) + 1);
  }

  const ordenados = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ordenados.slice(0, limite);

  if (incluirOutros && ordenados.length > limite) {
    const totalTop = top.reduce((acc, [, valor]) => acc + valor, 0);
    const outros = valores.length - totalTop;
    if (outros > 0) {
      top.push(["Outros", outros]);
    }
  }

  const total = valores.length;
  return top.map(([label, valor]) => ({
    label,
    valor,
    percentual: total === 0 ? 0 : Math.round((valor / total) * 100),
  }));
}

function pluralizar(valor: number, singular: string, plural: string) {
  return valor === 1 ? singular : plural;
}

function calcularDiasDesde(dataIso: string | null) {
  if (!dataIso) return null;
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return null;
  const diffMs = Date.now() - data.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function obterTop(distribuicao: ResumoDistribuicao[], fallback: string) {
  const top = distribuicao[0];
  return top ? `${top.label} (${top.valor})` : fallback;
}

function formatarDataFiltro(valor: string) {
  if (!valor) return "--";
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
}

function formatarTimestamp(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return { data: "--", hora: "--", completo: "--" };
  }

  return {
    data: data.toLocaleDateString("pt-BR"),
    hora: data.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    completo: data.toLocaleString("pt-BR"),
  };
}

function normalizarBuscaTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function DashboardTab() {
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIAIS });
  const [opcoes, setOpcoes] = useState<DashboardFiltersResponse>({
    unidades: [],
    setores: [],
    funcionarios: [],
  });
  const [data, setData] = useState<DashboardDataResponse | null>(null);
  const [itensResumo, setItensResumo] = useState<ItemDashboardResumo[]>([]);
  const [funcionariosResumo, setFuncionariosResumo] = useState<FuncionarioDashboardResumo[]>([]);
  const [kpiSelecionado, setKpiSelecionado] = useState<KpiChave | null>(null);
  const [openEmprestimosModal, setOpenEmprestimosModal] = useState(false);
  const [openDevolucoesModal, setOpenDevolucoesModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paginaSolicitacoes, setPaginaSolicitacoes] = useState(1);
  const [paginaDevolucoes, setPaginaDevolucoes] = useState(1);
  const [buscaFuncionario, setBuscaFuncionario] = useState("");
  const [buscaFuncionarioDebounced, setBuscaFuncionarioDebounced] = useState("");
  const [mostrarSugestoesFuncionario, setMostrarSugestoesFuncionario] = useState(false);
  const [loadingBuscaFuncionario, setLoadingBuscaFuncionario] = useState(false);
  const { success, error } = useToast();
  const { openFuncionario, openKit } = useGlobalDetail();
  const containerBuscaFuncionarioRef = useRef<HTMLDivElement | null>(null);
  const unidadesFuncionarioPorMatricula = useMemo(() => {
    const mapa = new Map<string, Set<string>>();

    for (const funcionario of funcionariosResumo) {
      const unidadesNormalizadas = new Set<string>();
      for (const unidade of [...(funcionario.unidades ?? []), funcionario.unidade]) {
        const normalizado = normalizarBuscaTexto(unidade);
        if (normalizado) {
          unidadesNormalizadas.add(normalizado);
        }
      }
      mapa.set(funcionario.matricula, unidadesNormalizadas);
    }

    return mapa;
  }, [funcionariosResumo]);
  const setoresFuncionarioPorMatricula = useMemo(() => {
    const mapa = new Map<string, Set<string>>();

    for (const funcionario of funcionariosResumo) {
      const setoresNormalizados = new Set<string>();
      for (const setor of [...funcionario.setores, funcionario.setor]) {
        const normalizado = normalizarBuscaTexto(setor);
        if (normalizado) {
          setoresNormalizados.add(normalizado);
        }
      }
      mapa.set(funcionario.matricula, setoresNormalizados);
    }

    return mapa;
  }, [funcionariosResumo]);

  const carregarOpcoes = useCallback(async () => {
    try {
      const payload = await api.get<DashboardFiltersResponse>("/admin/dashboard/filtros");
      setOpcoes(payload);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar filtros");
    }
  }, [error]);

  const carregarDadosResumo = useCallback(async () => {
    try {
      const [itens, funcionarios] = await Promise.all([
        api.get<ItemDashboardResumo[]>("/admin/itens?include_inactive=true"),
        api.get<FuncionarioDashboardResumo[]>("/admin/funcionarios?include_inactive=true"),
      ]);
      setItensResumo(itens);
      setFuncionariosResumo(funcionarios);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar resumo dos cards");
    }
  }, [error]);

  const carregarDashboard = useCallback(
    async (filtrosOverride?: typeof FILTROS_INICIAIS) => {
      const filtrosAtuais = filtrosOverride ?? filtros;
      setLoading(true);
      try {
        const payload = await api.post<DashboardDataResponse>("/admin/dashboard", {
          data_inicio: filtrosAtuais.data_inicio || undefined,
          data_fim: filtrosAtuais.data_fim || undefined,
          unidade: filtrosAtuais.unidade || undefined,
          setor: filtrosAtuais.setor || undefined,
          matricula: filtrosAtuais.matricula || undefined,
        });
        setData(payload);
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    },
    [error, filtros],
  );

  async function exportar() {
    setExporting(true);
    try {
      const blob = await api.postBlob("/admin/export", {
        data_inicio: filtros.data_inicio || undefined,
        data_fim: filtros.data_fim || undefined,
        unidade: filtros.unidade || undefined,
        setor: filtros.setor || undefined,
        matricula: filtros.matricula || undefined,
      });

      const fileName = `privativos_export_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success("Exportacao XLSX concluida");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao exportar XLSX");
    } finally {
      setExporting(false);
    }
  }

  function limparFiltros() {
    setFiltros({ ...FILTROS_INICIAIS });
    setBuscaFuncionario("");
    setBuscaFuncionarioDebounced("");
    setMostrarSugestoesFuncionario(false);
    setLoadingBuscaFuncionario(false);
  }

  function limparFiltroFuncionario() {
    setBuscaFuncionario("");
    setBuscaFuncionarioDebounced("");
    setMostrarSugestoesFuncionario(false);
    setLoadingBuscaFuncionario(false);
    setFiltros((prev) => ({ ...prev, matricula: "" }));
  }

  function selecionarFuncionario(funcionario: DashboardFiltersResponse["funcionarios"][number]) {
    setBuscaFuncionario(`${funcionario.nome} (${funcionario.matricula})`);
    setBuscaFuncionarioDebounced("");
    setMostrarSugestoesFuncionario(false);
    setLoadingBuscaFuncionario(false);
    setFiltros((prev) => ({ ...prev, matricula: funcionario.matricula }));
  }

  useEffect(() => {
    void carregarOpcoes();
  }, [carregarOpcoes]);

  useEffect(() => {
    void carregarDadosResumo();
  }, [carregarDadosResumo]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const entidade = (event as CustomEvent<{ entidade?: string }>).detail?.entidade;
      if (entidade === "kit" || entidade === "funcionario") {
        void carregarDadosResumo();
      }
    };

    window.addEventListener("global-detail-updated", onUpdated);
    return () => window.removeEventListener("global-detail-updated", onUpdated);
  }, [carregarDadosResumo]);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerBuscaFuncionarioRef.current?.contains(target)) {
        setMostrarSugestoesFuncionario(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const funcionarioSelecionado = opcoes.funcionarios.find(
      (funcionario) => funcionario.matricula === filtros.matricula,
    );

    if (!funcionarioSelecionado) {
      return;
    }

    setBuscaFuncionario(`${funcionarioSelecionado.nome} (${funcionarioSelecionado.matricula})`);
    setBuscaFuncionarioDebounced("");
    setMostrarSugestoesFuncionario(false);
    setLoadingBuscaFuncionario(false);
  }, [filtros.matricula, opcoes.funcionarios]);

  useEffect(() => {
    const query = buscaFuncionario.trim();
    if (!mostrarSugestoesFuncionario || query.length < 2) {
      setBuscaFuncionarioDebounced("");
      setLoadingBuscaFuncionario(false);
      return;
    }

    setLoadingBuscaFuncionario(true);
    const timeoutId = window.setTimeout(() => {
      setBuscaFuncionarioDebounced(query);
      setLoadingBuscaFuncionario(false);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [buscaFuncionario, mostrarSugestoesFuncionario]);

  useEffect(() => {
    if (!filtros.matricula || funcionariosResumo.length === 0) {
      return;
    }

    const setorSelecionado = normalizarBuscaTexto(filtros.setor);
    const unidadeSelecionada = normalizarBuscaTexto(filtros.unidade);
    const setoresFuncionario = setoresFuncionarioPorMatricula.get(filtros.matricula);
    const unidadesFuncionario = unidadesFuncionarioPorMatricula.get(filtros.matricula);

    const setorCompativel = !setorSelecionado || setoresFuncionario?.has(setorSelecionado);
    const unidadeCompativel = !unidadeSelecionada || unidadesFuncionario?.has(unidadeSelecionada);
    if (setorCompativel && unidadeCompativel) {
      return;
    }

    setFiltros((prev) => ({ ...prev, matricula: "" }));
    setBuscaFuncionario("");
    setBuscaFuncionarioDebounced("");
    setMostrarSugestoesFuncionario(false);
    setLoadingBuscaFuncionario(false);
  }, [
    filtros.matricula,
    filtros.setor,
    filtros.unidade,
    funcionariosResumo.length,
    setoresFuncionarioPorMatricula,
    unidadesFuncionarioPorMatricula,
  ]);

  const solicitacoesFiltradas = useMemo(() => data?.rows.solicitacoes ?? [], [data]);
  const devolucoesFiltradas = useMemo(() => data?.rows.devolucoes ?? [], [data]);

  useEffect(() => {
    setPaginaSolicitacoes(1);
    setPaginaDevolucoes(1);
  }, [filtros.data_inicio, filtros.data_fim, filtros.unidade, filtros.setor, filtros.matricula, data]);

  const totalPaginasSolicitacoes = Math.max(1, Math.ceil(solicitacoesFiltradas.length / ITENS_POR_PAGINA));
  const totalPaginasDevolucoes = Math.max(1, Math.ceil(devolucoesFiltradas.length / ITENS_POR_PAGINA));

  const solicitacoesPaginadas = useMemo(() => {
    const inicio = (paginaSolicitacoes - 1) * ITENS_POR_PAGINA;
    return solicitacoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [solicitacoesFiltradas, paginaSolicitacoes]);

  const devolucoesPaginadas = useMemo(() => {
    const inicio = (paginaDevolucoes - 1) * ITENS_POR_PAGINA;
    return devolucoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [devolucoesFiltradas, paginaDevolucoes]);

  useEffect(() => {
    if (paginaSolicitacoes > totalPaginasSolicitacoes) setPaginaSolicitacoes(totalPaginasSolicitacoes);
  }, [paginaSolicitacoes, totalPaginasSolicitacoes]);

  useEffect(() => {
    if (paginaDevolucoes > totalPaginasDevolucoes) setPaginaDevolucoes(totalPaginasDevolucoes);
  }, [paginaDevolucoes, totalPaginasDevolucoes]);

  const inicioSolicitacoes = solicitacoesFiltradas.length === 0 ? 0 : (paginaSolicitacoes - 1) * ITENS_POR_PAGINA + 1;
  const fimSolicitacoes = Math.min(paginaSolicitacoes * ITENS_POR_PAGINA, solicitacoesFiltradas.length);
  const inicioDevolucoes = devolucoesFiltradas.length === 0 ? 0 : (paginaDevolucoes - 1) * ITENS_POR_PAGINA + 1;
  const fimDevolucoes = Math.min(paginaDevolucoes * ITENS_POR_PAGINA, devolucoesFiltradas.length);

  const periodoAtivo = filtros.data_inicio || filtros.data_fim
    ? `${formatarDataFiltro(filtros.data_inicio)} - ${formatarDataFiltro(filtros.data_fim)}`
    : "Periodo completo";
  const sugestoesFuncionario = useMemo(() => {
    const termo = normalizarBuscaTexto(buscaFuncionarioDebounced);
    if (!mostrarSugestoesFuncionario || termo.length < 2) {
      return [] satisfies DashboardFiltersResponse["funcionarios"];
    }

    const setorSelecionado = normalizarBuscaTexto(filtros.setor);
    const unidadeSelecionada = normalizarBuscaTexto(filtros.unidade);

    return opcoes.funcionarios
      .filter((funcionario) => {
        if (unidadeSelecionada) {
          const unidadesFuncionario = unidadesFuncionarioPorMatricula.get(funcionario.matricula);
          if (!unidadesFuncionario || !unidadesFuncionario.has(unidadeSelecionada)) {
            return false;
          }
        }

        if (setorSelecionado) {
          const setoresFuncionario = setoresFuncionarioPorMatricula.get(funcionario.matricula);
          if (!setoresFuncionario || !setoresFuncionario.has(setorSelecionado)) {
            return false;
          }
        }

        return normalizarBuscaTexto(`${funcionario.nome} ${funcionario.matricula}`).includes(termo);
      })
      .slice(0, 8);
  }, [
    buscaFuncionarioDebounced,
    filtros.setor,
    filtros.unidade,
    mostrarSugestoesFuncionario,
    opcoes.funcionarios,
    setoresFuncionarioPorMatricula,
    unidadesFuncionarioPorMatricula,
  ]);
  const mostrarDropdownFuncionario =
    mostrarSugestoesFuncionario &&
    (loadingBuscaFuncionario ||
      sugestoesFuncionario.length > 0 ||
      buscaFuncionarioDebounced.trim().length >= 2);

  const itemByCodigo = useMemo(
    () => new Map(itensResumo.map((item) => [item.codigo, item])),
    [itensResumo],
  );
  const funcionarioByMatricula = useMemo(
    () => new Map(funcionariosResumo.map((funcionario) => [funcionario.matricula, funcionario])),
    [funcionariosResumo],
  );

  const itensAtivos = useMemo(() => itensResumo.filter((item) => item.statusAtivo), [itensResumo]);
  const itensDisponiveisAtivos = useMemo(
    () => itensAtivos.filter((item) => item.status === "disponivel"),
    [itensAtivos],
  );
  const itensEmprestadosAtivos = useMemo(
    () => itensAtivos.filter((item) => item.status === "emprestado"),
    [itensAtivos],
  );
  const emprestimosPorSetorTodos = useMemo(
    () =>
      montarDistribuicao(
        solicitacoesFiltradas.map((row) => setorPrincipal(row.setor)),
        { limite: Math.max(1, solicitacoesFiltradas.length), incluirOutros: false },
      ),
    [solicitacoesFiltradas],
  );

  const emprestimosPorTamanhoTodos = useMemo(
    () =>
      montarDistribuicao(
        solicitacoesFiltradas.map((row) => itemByCodigo.get(row.item_codigo)?.tamanho ?? "Sem tamanho"),
        {
          limite: Math.max(1, solicitacoesFiltradas.length),
          incluirOutros: false,
          fallback: "Sem tamanho",
        },
      ),
    [itemByCodigo, solicitacoesFiltradas],
  );

  const devolucoesPorSetorTodos = useMemo(
    () =>
      montarDistribuicao(
        devolucoesFiltradas.map((row) => setorPrincipal(row.setor)),
        { limite: Math.max(1, devolucoesFiltradas.length), incluirOutros: false },
      ),
    [devolucoesFiltradas],
  );

  const devolucoesPorTamanhoTodos = useMemo(
    () =>
      montarDistribuicao(
        devolucoesFiltradas.map((row) => itemByCodigo.get(row.item_codigo)?.tamanho ?? "Sem tamanho"),
        {
          limite: Math.max(1, devolucoesFiltradas.length),
          incluirOutros: false,
          fallback: "Sem tamanho",
        },
      ),
    [devolucoesFiltradas, itemByCodigo],
  );

  const disponiveisPorTamanhoTodos = useMemo(
    () =>
      montarDistribuicao(
        itensDisponiveisAtivos.map((item) => item.tamanho),
        {
          limite: Math.max(1, itensDisponiveisAtivos.length),
          incluirOutros: false,
          fallback: "Sem tamanho",
        },
      ),
    [itensDisponiveisAtivos],
  );

  const emprestadosPorTamanhoTodos = useMemo(
    () =>
      montarDistribuicao(
        itensEmprestadosAtivos.map((item) => item.tamanho),
        {
          limite: Math.max(1, itensEmprestadosAtivos.length),
          incluirOutros: false,
          fallback: "Sem tamanho",
        },
      ),
    [itensEmprestadosAtivos],
  );

  const detalhesKpi = useMemo<Record<KpiChave, ResumoKpi>>(() => {
    const emprestimosPorSetor = emprestimosPorSetorTodos.slice(0, 3);
    const emprestimosPorTamanho = emprestimosPorTamanhoTodos.slice(0, 3);
    const emprestimosPorItem = montarDistribuicao(
      solicitacoesFiltradas.map((row) => row.item_codigo),
      { limite: 3, incluirOutros: false, fallback: "Sem item" },
    );

    const devolucoesPorSetor = devolucoesPorSetorTodos.slice(0, 3);
    const devolucoesPorTamanho = devolucoesPorTamanhoTodos.slice(0, 3);

    const disponiveisPorTamanho = montarDistribuicao(
      itensDisponiveisAtivos.map((item) => item.tamanho),
      { limite: 3, fallback: "Sem tamanho" },
    );
    const panoramaEstoque = montarDistribuicao(
      itensAtivos.map((item) => {
        if (item.status === "disponivel") return "Disponiveis";
        if (item.status === "emprestado") return "Emprestados";
        return "Inativos";
      }),
      { limite: 3, incluirOutros: false },
    );

    const emprestadosPorTamanho = montarDistribuicao(
      itensEmprestadosAtivos.map((item) => item.tamanho),
      { limite: 3, fallback: "Sem tamanho" },
    );
    const emprestadosPorSetor = montarDistribuicao(
      itensEmprestadosAtivos.map((item) => {
        const matricula = item.solicitanteMatricula ?? "";
        return funcionarioByMatricula.get(matricula)?.setor ?? "Nao informado";
      }),
      { limite: 3 },
    );

    const ultimaSolicitacao = solicitacoesFiltradas[0]
      ? formatarTimestamp(solicitacoesFiltradas[0].timestamp).completo
      : "--";
    const ultimaDevolucao = devolucoesFiltradas[0]
      ? formatarTimestamp(devolucoesFiltradas[0].timestamp).completo
      : "--";

    const saldoPeriodo = solicitacoesFiltradas.length - devolucoesFiltradas.length;
    const taxaRetorno = solicitacoesFiltradas.length
      ? Math.round((devolucoesFiltradas.length / solicitacoesFiltradas.length) * 100)
      : 0;
    const tamanhosComDisponiveis = new Set(
      itensDisponiveisAtivos.map((item) => normalizarLabel(item.tamanho, "Sem tamanho")),
    ).size;
    const taxaDisponiveis = itensAtivos.length
      ? Math.round((itensDisponiveisAtivos.length / itensAtivos.length) * 100)
      : 0;

    const itemEmprestadoMaisAntigo = itensEmprestadosAtivos.reduce<{ codigo: string; dias: number } | null>(
      (acc, item) => {
        const dias = calcularDiasDesde(item.dataEmprestimo);
        if (dias === null) {
          return acc;
        }
        if (!acc || dias > acc.dias) {
          return { codigo: item.codigo, dias };
        }
        return acc;
      },
      null,
    );

    return {
      emprestimos: {
        titulo: "Emprestimos",
        subtitulo: "Indicadores rapidos do periodo filtrado.",
        indicadores: [
          {
            rotulo: "Setor em destaque",
            valor: obterTop(emprestimosPorSetor, "Sem dados"),
          },
          {
            rotulo: "Tamanho mais pedido",
            valor: obterTop(emprestimosPorTamanho, "Sem dados"),
          },
          {
            rotulo: "Item mais solicitado",
            valor: obterTop(emprestimosPorItem, "Sem dados"),
          },
          {
            rotulo: "Ultimo registro",
            valor: ultimaSolicitacao,
          },
        ],
      },
      devolucoes: {
        titulo: "Devolucoes",
        subtitulo: "Indicadores de retorno no recorte atual.",
        indicadores: [
          {
            rotulo: "Setor com mais retornos",
            valor: obterTop(devolucoesPorSetor, "Sem dados"),
          },
          {
            rotulo: "Tamanho mais devolvido",
            valor: obterTop(devolucoesPorTamanho, "Sem dados"),
          },
          {
            rotulo: "Taxa de retorno",
            valor: `${taxaRetorno}%`,
            apoio: `${devolucoesFiltradas.length} de ${solicitacoesFiltradas.length} devolvidos`,
          },
          {
            rotulo: "Saldo do periodo",
            valor:
              saldoPeriodo === 0
                ? "Equilibrado"
                : saldoPeriodo > 0
                  ? `+${saldoPeriodo} em uso`
                  : `${saldoPeriodo} em uso`,
            apoio: `Ultimo retorno: ${ultimaDevolucao}`,
          },
        ],
      },
      disponiveis: {
        titulo: "Itens disponiveis",
        subtitulo: "Capacidade de atendimento imediata.",
        indicadores: [
          {
            rotulo: "Tamanho com maior estoque",
            valor: obterTop(disponiveisPorTamanho, "Sem dados"),
          },
          {
            rotulo: "Cobertura de tamanhos",
            valor: `${tamanhosComDisponiveis} ${pluralizar(tamanhosComDisponiveis, "tamanho", "tamanhos")}`,
          },
          {
            rotulo: "Disponiveis no estoque ativo",
            valor: `${taxaDisponiveis}%`,
            apoio: `${itensDisponiveisAtivos.length} de ${itensAtivos.length}`,
          },
          {
            rotulo: "Panorama atual",
            valor:
              panoramaEstoque.length > 0
                ? panoramaEstoque.map((item) => `${item.label}: ${item.valor}`).join(" | ")
                : "Sem dados",
          },
        ],
      },
      emprestados: {
        titulo: "Itens emprestados",
        subtitulo: "Uso ativo por equipe e tamanho.",
        indicadores: [
          {
            rotulo: "Setor com mais itens em uso",
            valor: obterTop(emprestadosPorSetor, "Sem dados"),
          },
          {
            rotulo: "Tamanho mais em uso",
            valor: obterTop(emprestadosPorTamanho, "Sem dados"),
          },
          {
            rotulo: "Emprestimo mais antigo",
            valor: itemEmprestadoMaisAntigo
              ? `${itemEmprestadoMaisAntigo.codigo} (${itemEmprestadoMaisAntigo.dias}d)`
              : "Sem data registrada",
          },
          {
            rotulo: "Total em uso agora",
            valor: `${itensEmprestadosAtivos.length} ${pluralizar(itensEmprestadosAtivos.length, "item", "itens")}`,
          },
        ],
      },
    };
  }, [
    devolucoesFiltradas,
    devolucoesPorSetorTodos,
    devolucoesPorTamanhoTodos,
    emprestimosPorSetorTodos,
    emprestimosPorTamanhoTodos,
    funcionarioByMatricula,
    itensAtivos,
    itensDisponiveisAtivos,
    itensEmprestadosAtivos,
    solicitacoesFiltradas,
  ]);

  const cardsKpi = data
    ? ([
        {
          chave: "emprestimos",
          label: "Emprestimos",
          valor: data.kpis.total_emprestimos,
          helper: "Total de solicitacoes registradas.",
          icon: Package,
          gradientClass: "from-primary/18 via-primary/8 to-transparent",
          iconClass: "text-primary",
        },
        {
          chave: "devolucoes",
          label: "Devolucoes",
          valor: data.kpis.total_devolucoes,
          helper: "Total de devolucoes processadas.",
          icon: Undo2,
          gradientClass:
            "from-[hsl(203_88%_52%_/_0.18)] via-[hsl(203_88%_52%_/_0.08)] to-transparent",
          iconClass: "text-[hsl(203_88%_46%)] dark:text-[hsl(203_92%_73%)]",
        },
        {
          chave: "disponiveis",
          label: "Itens disponiveis",
          valor: data.kpis.itens_disponiveis,
          helper: "Prontos para novo emprestimo.",
          icon: Boxes,
          gradientClass:
            "from-[hsl(197_92%_56%_/_0.2)] via-[hsl(197_92%_56%_/_0.08)] to-transparent",
          iconClass: "text-[hsl(197_88%_42%)] dark:text-[hsl(195_95%_72%)]",
        },
        {
          chave: "emprestados",
          label: "Itens emprestados",
          valor: data.kpis.itens_emprestados,
          helper: "Atualmente em uso pelos funcionarios.",
          icon: BarChart3,
          gradientClass:
            "from-[hsl(210_92%_56%_/_0.17)] via-[hsl(210_92%_56%_/_0.08)] to-transparent",
          iconClass: "text-[hsl(210_88%_47%)] dark:text-[hsl(210_95%_74%)]",
        },
      ] satisfies Array<{
        chave: KpiChave;
        label: string;
        valor: number;
        helper: string;
        icon: typeof Package;
        gradientClass: string;
        iconClass: string;
      }>)
    : [];

  const detalheSelecionado = kpiSelecionado ? detalhesKpi[kpiSelecionado] : null;
  const emprestimosSetoresCompactos = emprestimosPorSetorTodos.slice(0, LIMITE_LISTA_DISTRIBUICAO_POPOVER);
  const emprestimosTamanhosCompactos = emprestimosPorTamanhoTodos.slice(0, LIMITE_LISTA_DISTRIBUICAO_POPOVER);
  const podeExpandirEmprestimos =
    emprestimosPorSetorTodos.length > LIMITE_LISTA_DISTRIBUICAO_POPOVER ||
    emprestimosPorTamanhoTodos.length > LIMITE_LISTA_DISTRIBUICAO_POPOVER;
  const devolucoesSetoresCompactos = devolucoesPorSetorTodos.slice(0, LIMITE_LISTA_DISTRIBUICAO_POPOVER);
  const devolucoesTamanhosCompactos = devolucoesPorTamanhoTodos.slice(0, LIMITE_LISTA_DISTRIBUICAO_POPOVER);
  const podeExpandirDevolucoes =
    devolucoesPorSetorTodos.length > LIMITE_LISTA_DISTRIBUICAO_POPOVER ||
    devolucoesPorTamanhoTodos.length > LIMITE_LISTA_DISTRIBUICAO_POPOVER;
  const disponiveisTamanhosCompactos = disponiveisPorTamanhoTodos.slice(0, LIMITE_LISTA_DISTRIBUICAO_POPOVER);
  const emprestadosTamanhosCompactos = emprestadosPorTamanhoTodos.slice(0, LIMITE_LISTA_DISTRIBUICAO_POPOVER);

  useEffect(() => {
    if (!detalheSelecionado) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setKpiSelecionado(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detalheSelecionado]);

  useEffect(() => {
    if (kpiSelecionado !== "emprestimos") {
      setOpenEmprestimosModal(false);
    }
    if (kpiSelecionado !== "devolucoes") {
      setOpenDevolucoesModal(false);
    }
  }, [kpiSelecionado]);

  return (
    <div className="space-y-3">
      <Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-background via-accent/18 to-muted/45 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-gradient-to-br dark:from-background dark:via-muted/35 dark:to-accent/18">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 -top-14 h-32 w-32 rounded-full bg-primary/10 blur-3xl dark:bg-primary/18" />
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-accent/25 blur-3xl dark:bg-primary/14" />
        </div>

        <CardContent className="relative p-3 sm:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                <BarChart3 className="h-3.5 w-3.5" />
                Dashboard Privativos
              </p>
              <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                Panorama operacional em tempo real
              </h2>
              <p className="max-w-xl text-[11px] leading-snug text-muted-foreground">
                Visualize movimentacoes, acompanhe os indicadores principais e detalhe operacoes por periodo, setor e funcionario.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info" className="text-[10px]">
                Periodo: {periodoAtivo}
              </StatusPill>
              <StatusPill tone="neutral" className="text-[10px]">
                Gerado em: {data ? formatarTimestamp(data.gerado_em).completo : "--"}
              </StatusPill>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-visible border-border/75 bg-card/95 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-surface-2/70 via-transparent to-accent/22 dark:from-muted/22 dark:via-transparent dark:to-primary/12" />
        <CardContent className="relative space-y-2.5 p-2.5 sm:p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Refinar dados</p>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Filtros do dashboard
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border/80 bg-background/80 text-[11px] dark:border-border/90 dark:bg-background/55 dark:hover:bg-accent/35"
                onClick={limparFiltros}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
              <Button
                size="sm"
                className="h-8 bg-gradient-to-r from-primary to-primary/85 text-[11px] text-primary-foreground dark:from-primary dark:to-primary/80"
                onClick={exportar}
                loading={exporting}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar XLSX
              </Button>
            </div>
          </div>

          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="f-data-inicio" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Data inicio
              </Label>
              <Input
                id="f-data-inicio"
                type="date"
                value={filtros.data_inicio}
                className="h-9 rounded-xl border-border/80 bg-background/85 text-[11px] dark:border-border/90 dark:bg-background/70"
                onChange={(e) => setFiltros((prev) => ({ ...prev, data_inicio: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-data-fim" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Data fim
              </Label>
              <Input
                id="f-data-fim"
                type="date"
                value={filtros.data_fim}
                className="h-9 rounded-xl border-border/80 bg-background/85 text-[11px] dark:border-border/90 dark:bg-background/70"
                onChange={(e) => setFiltros((prev) => ({ ...prev, data_fim: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-unidade" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Unidade
              </Label>
              <Select
                value={filtros.unidade || "todos"}
                onValueChange={(value) => setFiltros((prev) => ({ ...prev, unidade: value === "todos" ? "" : value }))}
              >
                <SelectTrigger id="f-unidade" className="h-9 rounded-xl border-border/80 bg-background/85 text-[11px] dark:border-border/90 dark:bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {opcoes.unidades.map((unidade) => (
                    <SelectItem key={unidade} value={unidade}>
                      {unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-setor" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Setor
              </Label>
              <Select
                value={filtros.setor || "todos"}
                onValueChange={(value) => setFiltros((prev) => ({ ...prev, setor: value === "todos" ? "" : value }))}
              >
                <SelectTrigger id="f-setor" className="h-9 rounded-xl border-border/80 bg-background/85 text-[11px] dark:border-border/90 dark:bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {opcoes.setores.map((setor) => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-matricula" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Funcionario
              </Label>
              <div ref={containerBuscaFuncionarioRef} className="relative">
                <div className="flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-background/85 px-2 dark:border-border/90 dark:bg-background/70">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input
                    id="f-matricula"
                    value={buscaFuncionario}
                    placeholder="Buscar por nome ou matricula"
                    autoComplete="off"
                    className="h-full min-w-0 flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/80 outline-none"
                    onChange={(event) => {
                      const value = event.target.value;
                      setBuscaFuncionario(value);
                      setMostrarSugestoesFuncionario(value.trim().length >= 2);
                      if (filtros.matricula) {
                        setFiltros((prev) => ({ ...prev, matricula: "" }));
                      }
                    }}
                    onFocus={() => {
                      if (buscaFuncionario.trim().length >= 2) {
                        setMostrarSugestoesFuncionario(true);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setMostrarSugestoesFuncionario(false);
                        return;
                      }
                      if (event.key === "Enter" && sugestoesFuncionario.length > 0) {
                        event.preventDefault();
                        selecionarFuncionario(sugestoesFuncionario[0]);
                      }
                    }}
                  />
                  {loadingBuscaFuncionario ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  ) : buscaFuncionario.trim().length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={limparFiltroFuncionario}
                      aria-label="Limpar filtro de funcionario"
                      title="Limpar filtro"
                      className="h-5 w-5 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>

                {mostrarDropdownFuncionario && (
                  <div className="absolute inset-x-0 bottom-[calc(100%+6px)] z-[72] rounded-xl border border-border/80 bg-popover/98 p-1 shadow-[var(--shadow-soft)] dark:border-border/90 dark:bg-popover/95">
                    <div className="max-h-56 overflow-y-auto overflow-x-hidden">
                      {loadingBuscaFuncionario && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Buscando funcionarios...</p>
                      )}
                      {!loadingBuscaFuncionario && sugestoesFuncionario.map((funcionario, index) => (
                        <button
                          key={funcionario.matricula}
                          type="button"
                          className="w-full rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 hover:translate-x-0.5 hover:bg-accent/50"
                          style={{ animationDelay: `${index * 18}ms` }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selecionarFuncionario(funcionario)}
                        >
                          <div className="truncate text-[11px] font-semibold text-foreground">{funcionario.nome}</div>
                          <div className="text-[10px] text-muted-foreground">Matricula {funcionario.matricula}</div>
                        </button>
                      ))}
                      {!loadingBuscaFuncionario && sugestoesFuncionario.length === 0 && buscaFuncionarioDebounced.trim().length >= 2 && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          {filtros.setor || filtros.unidade
                            ? "Nenhum funcionario encontrado para os filtros de unidade/setor."
                            : "Nenhum funcionario encontrado."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cardsKpi.map((card, index) => {
              const Icon = card.icon;
              const selecionado = kpiSelecionado === card.chave;
              const resumoCard = detalhesKpi[card.chave];
              return (
                <div key={card.chave} className="relative">
                  {selecionado ? (
                    <div className="pointer-events-none absolute left-1/2 top-0 z-[70] w-52 -translate-x-1/2 -translate-y-[calc(100%+0.35rem)]">
                      <Card className="pointer-events-auto border-border/70 bg-card/96 shadow-[0_14px_28px_-20px_hsl(var(--primary)/0.58)] dark:border-border/85 dark:bg-card/95">
                        <CardContent className="space-y-1.5 p-2">
                          <p className="truncate text-[10px] font-semibold text-foreground">{resumoCard.titulo}</p>
                          {card.chave === "emprestimos" ? (
                            <div className="space-y-1.5">
                              <div>
                                <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground">Setores</p>
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {emprestimosSetoresCompactos.length > 0 ? (
                                    emprestimosSetoresCompactos.map((item) => (
                                      <span
                                        key={`setor-pop-${item.label}`}
                                        className="max-w-full truncate rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-foreground dark:bg-background/55"
                                      >
                                        {item.label} ({item.valor})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">Sem registros</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground">Tamanhos</p>
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {emprestimosTamanhosCompactos.length > 0 ? (
                                    emprestimosTamanhosCompactos.map((item) => (
                                      <span
                                        key={`tam-pop-${item.label}`}
                                        className="max-w-full truncate rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-foreground dark:bg-background/55"
                                      >
                                        {item.label} ({item.valor})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">Sem registros</span>
                                  )}
                                </div>
                              </div>
                              {podeExpandirEmprestimos ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-full text-[9px]"
                                  onClick={() => setOpenEmprestimosModal(true)}
                                >
                                  Ver lista completa
                                </Button>
                              ) : null}
                            </div>
                          ) : card.chave === "devolucoes" ? (
                            <div className="space-y-1.5">
                              <div>
                                <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground">Setores</p>
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {devolucoesSetoresCompactos.length > 0 ? (
                                    devolucoesSetoresCompactos.map((item) => (
                                      <span
                                        key={`setor-dev-pop-${item.label}`}
                                        className="max-w-full truncate rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-foreground dark:bg-background/55"
                                      >
                                        {item.label} ({item.valor})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">Sem registros</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground">Tamanhos</p>
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {devolucoesTamanhosCompactos.length > 0 ? (
                                    devolucoesTamanhosCompactos.map((item) => (
                                      <span
                                        key={`tam-dev-pop-${item.label}`}
                                        className="max-w-full truncate rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-foreground dark:bg-background/55"
                                      >
                                        {item.label} ({item.valor})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">Sem registros</span>
                                  )}
                                </div>
                              </div>
                              {podeExpandirDevolucoes ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-full text-[9px]"
                                  onClick={() => setOpenDevolucoesModal(true)}
                                >
                                  Ver lista completa
                                </Button>
                              ) : null}
                            </div>
                          ) : card.chave === "disponiveis" || card.chave === "emprestados" ? (
                            <div>
                              <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground">Tamanhos</p>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {(card.chave === "disponiveis" ? disponiveisTamanhosCompactos : emprestadosTamanhosCompactos).length > 0 ? (
                                  (card.chave === "disponiveis" ? disponiveisTamanhosCompactos : emprestadosTamanhosCompactos).map((item) => (
                                    <span
                                      key={`${card.chave}-tam-pop-${item.label}`}
                                      className="max-w-full truncate rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-foreground dark:bg-background/55"
                                    >
                                      {item.label} ({item.valor})
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-muted-foreground">Sem registros</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            resumoCard.indicadores.slice(0, 2).map((indicador) => (
                              <div key={`${resumoCard.titulo}-${indicador.rotulo}`} className="rounded-md bg-background/70 px-1.5 py-1 dark:bg-background/55">
                                <p className="truncate text-[8px] uppercase tracking-[0.06em] text-muted-foreground">{indicador.rotulo}</p>
                                <p className="truncate text-[10px] font-semibold text-foreground">{indicador.valor}</p>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                      <div className="mx-auto mt-1 h-2 w-2 rotate-45 border-b border-r border-border/70 bg-card/96 dark:border-border/85 dark:bg-card/95" />
                    </div>
                  ) : null}

                  <Card
                    className={cn(
                      "group relative overflow-hidden border-border/70 bg-card/92 shadow-[var(--shadow-soft)] animate-in fade-in-0 slide-in-from-bottom-2 dark:border-border/85 dark:bg-card/88",
                      selecionado
                        ? "border-primary/55 shadow-[0_0_0_1px_hsl(var(--primary)/0.25),var(--shadow-soft)] dark:border-primary/60"
                        : "hover:-translate-y-0.5 hover:border-primary/35",
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", card.gradientClass)} />
                    <button
                      type="button"
                      className="relative w-full cursor-pointer rounded-[inherit] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() =>
                        setKpiSelecionado((anterior) => (anterior === card.chave ? null : card.chave))
                      }
                      aria-pressed={selecionado}
                      aria-label={`Abrir resumo de ${card.label}`}
                    >
                      <CardContent className="relative p-2.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {card.label}
                            </p>
                            <p className="mt-1 text-xl font-bold leading-none text-foreground">{card.valor}</p>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-background/75 dark:border-border/80 dark:bg-background/60">
                            <Icon className={cn("h-3.5 w-3.5", card.iconClass)} />
                          </div>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{card.helper}</p>
                      </CardContent>
                    </button>
                  </Card>
                </div>
              );
            })}
          </div>

          <Modal
            open={openEmprestimosModal}
            onClose={() => setOpenEmprestimosModal(false)}
            title="Emprestimos por setor e tamanho"
            description="Distribuicao completa das solicitacoes no recorte atual."
            maxWidthClassName="max-w-2xl"
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/72 p-2.5 dark:border-border/85 dark:bg-background/55">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Setores ({emprestimosPorSetorTodos.length})
                </p>
                <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto pr-1">
                  {emprestimosPorSetorTodos.length > 0 ? (
                    emprestimosPorSetorTodos.map((item) => (
                      <div
                        key={`modal-setor-${item.label}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/65 bg-card/76 px-2 py-1 text-[11px] dark:border-border/80 dark:bg-card/65"
                      >
                        <span className="truncate text-foreground">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{item.valor}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sem setores neste periodo.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/72 p-2.5 dark:border-border/85 dark:bg-background/55">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tamanhos ({emprestimosPorTamanhoTodos.length})
                </p>
                <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto pr-1">
                  {emprestimosPorTamanhoTodos.length > 0 ? (
                    emprestimosPorTamanhoTodos.map((item) => (
                      <div
                        key={`modal-tamanho-${item.label}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/65 bg-card/76 px-2 py-1 text-[11px] dark:border-border/80 dark:bg-card/65"
                      >
                        <span className="truncate text-foreground">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{item.valor}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sem tamanhos neste periodo.</p>
                  )}
                </div>
              </div>
            </div>
          </Modal>

          <Modal
            open={openDevolucoesModal}
            onClose={() => setOpenDevolucoesModal(false)}
            title="Devolucoes por setor e tamanho"
            description="Distribuicao completa das devolucoes no recorte atual."
            maxWidthClassName="max-w-2xl"
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/72 p-2.5 dark:border-border/85 dark:bg-background/55">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Setores ({devolucoesPorSetorTodos.length})
                </p>
                <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto pr-1">
                  {devolucoesPorSetorTodos.length > 0 ? (
                    devolucoesPorSetorTodos.map((item) => (
                      <div
                        key={`modal-dev-setor-${item.label}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/65 bg-card/76 px-2 py-1 text-[11px] dark:border-border/80 dark:bg-card/65"
                      >
                        <span className="truncate text-foreground">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{item.valor}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sem setores neste periodo.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/72 p-2.5 dark:border-border/85 dark:bg-background/55">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tamanhos ({devolucoesPorTamanhoTodos.length})
                </p>
                <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto pr-1">
                  {devolucoesPorTamanhoTodos.length > 0 ? (
                    devolucoesPorTamanhoTodos.map((item) => (
                      <div
                        key={`modal-dev-tamanho-${item.label}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/65 bg-card/76 px-2 py-1 text-[11px] dark:border-border/80 dark:bg-card/65"
                      >
                        <span className="truncate text-foreground">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{item.valor}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sem tamanhos neste periodo.</p>
                  )}
                </div>
              </div>
            </div>
          </Modal>

          <div className="grid gap-4 2xl:grid-cols-2">
            <SectionCard
              title={<span className="text-sm font-semibold">Solicitacoes</span>}
              icon={Package}
              actions={<StatusPill tone="info" className="text-[10px]">{solicitacoesFiltradas.length} registros</StatusPill>}
              className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
              headerClassName="pb-1.5"
              contentClassName="pt-0"
            >
              <div className="h-[198px] overflow-y-auto">
                <DataTable
                  columns={COLUNAS_MOVIMENTACAO}
                  rows={solicitacoesPaginadas}
                  getRowKey={(row) => row.id}
                  onRowClick={(row) => {
                    void openKit(row.item_codigo);
                  }}
                  loading={loading}
                  emptyMessage="Sem solicitacoes para os filtros atuais."
                  minWidthClassName="min-w-0"
                  containerClassName="overflow-x-hidden border-border/65 bg-background/70 dark:border-border/85 dark:bg-background/55"
                  emptyCellClassName="py-3"
                  renderRow={(row) => {
                    const dataHora = formatarTimestamp(row.timestamp);
                    return (
                      <>
                        <td className="max-w-0" title={dataHora.completo}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs leading-tight">{dataHora.data}</span>
                            <span className="text-[10px] leading-tight text-muted-foreground">{dataHora.hora}</span>
                          </div>
                        </td>
                        <td className="max-w-0 truncate" title={row.matricula}>
                          <button
                            type="button"
                            data-row-ignore-click="true"
                            className="font-mono text-primary underline-offset-2 hover:underline"
                            onClick={() => {
                              void openFuncionario(row.matricula);
                            }}
                          >
                            {row.matricula}
                          </button>
                        </td>
                        <td className="max-w-0 truncate" title={row.nome_funcionario}>{row.nome_funcionario}</td>
                        <td className="max-w-0 truncate" title={row.unidade ?? "-"}>{row.unidade ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.setor ?? "-"}>{row.setor ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.item_codigo}>
                          <button
                            type="button"
                            data-row-ignore-click="true"
                            className="font-mono text-primary underline-offset-2 hover:underline"
                            onClick={() => {
                              void openKit(row.item_codigo);
                            }}
                          >
                            {row.item_codigo}
                          </button>
                        </td>
                      </>
                    );
                  }}
                />
              </div>

              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {inicioSolicitacoes}-{fimSolicitacoes} de {solicitacoesFiltradas.length} | Pagina {paginaSolicitacoes} de {totalPaginasSolicitacoes}
                </p>
                <div className="flex min-w-[220px] justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
                    onClick={() => setPaginaSolicitacoes((paginaAtual) => Math.max(1, paginaAtual - 1))}
                    disabled={paginaSolicitacoes === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
                    onClick={() => setPaginaSolicitacoes((paginaAtual) => Math.min(totalPaginasSolicitacoes, paginaAtual + 1))}
                    disabled={paginaSolicitacoes === totalPaginasSolicitacoes}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={<span className="text-sm font-semibold">Devolucoes</span>}
              icon={Undo2}
              actions={<StatusPill tone="info" className="text-[10px]">{devolucoesFiltradas.length} registros</StatusPill>}
              className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
              headerClassName="pb-1.5"
              contentClassName="pt-0"
            >
              <div className="h-[198px] overflow-y-auto">
                <DataTable
                  columns={COLUNAS_MOVIMENTACAO}
                  rows={devolucoesPaginadas}
                  getRowKey={(row) => row.id}
                  onRowClick={(row) => {
                    void openKit(row.item_codigo);
                  }}
                  loading={loading}
                  emptyMessage="Sem devolucoes para os filtros atuais."
                  minWidthClassName="min-w-0"
                  containerClassName="overflow-x-hidden border-border/65 bg-background/70 dark:border-border/85 dark:bg-background/55"
                  emptyCellClassName="py-3"
                  renderRow={(row) => {
                    const dataHora = formatarTimestamp(row.timestamp);
                    return (
                      <>
                        <td className="max-w-0" title={dataHora.completo}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs leading-tight">{dataHora.data}</span>
                            <span className="text-[10px] leading-tight text-muted-foreground">{dataHora.hora}</span>
                          </div>
                        </td>
                        <td className="max-w-0 truncate" title={row.matricula}>
                          <button
                            type="button"
                            data-row-ignore-click="true"
                            className="font-mono text-primary underline-offset-2 hover:underline"
                            onClick={() => {
                              void openFuncionario(row.matricula);
                            }}
                          >
                            {row.matricula}
                          </button>
                        </td>
                        <td className="max-w-0 truncate" title={row.nome_funcionario}>{row.nome_funcionario}</td>
                        <td className="max-w-0 truncate" title={row.unidade ?? "-"}>{row.unidade ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.setor ?? "-"}>{row.setor ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.item_codigo}>
                          <button
                            type="button"
                            data-row-ignore-click="true"
                            className="font-mono text-primary underline-offset-2 hover:underline"
                            onClick={() => {
                              void openKit(row.item_codigo);
                            }}
                          >
                            {row.item_codigo}
                          </button>
                        </td>
                      </>
                    );
                  }}
                />
              </div>

              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {inicioDevolucoes}-{fimDevolucoes} de {devolucoesFiltradas.length} | Pagina {paginaDevolucoes} de {totalPaginasDevolucoes}
                </p>
                <div className="flex min-w-[220px] justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
                    onClick={() => setPaginaDevolucoes((paginaAtual) => Math.max(1, paginaAtual - 1))}
                    disabled={paginaDevolucoes === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
                    onClick={() => setPaginaDevolucoes((paginaAtual) => Math.min(totalPaginasDevolucoes, paginaAtual + 1))}
                    disabled={paginaDevolucoes === totalPaginasDevolucoes}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      ) : (
        <Card className="border-border/70 bg-card/90 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/88">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dados do dashboard</CardTitle>
            <CardDescription>
              {loading ? "Carregando indicadores..." : "Nao foi possivel carregar os dados. Verifique os filtros e tente novamente."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-2 rounded-full bg-muted/70 animate-pulse-slow" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
