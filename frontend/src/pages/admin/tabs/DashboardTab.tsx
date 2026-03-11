import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
  sortDataTableRows,
} from "@/components/ui/data-table";
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
import type { CatalogoRow, DashboardDataResponse, DashboardFiltersResponse } from "../types";

const ITENS_POR_PAGINA = 5;
const DASHBOARD_AUTO_REFRESH_MS = 15000;

const FILTROS_INICIAIS = {
  data_inicio: "",
  data_fim: "",
  unidade: "",
  setor: "",
  origem: "",
  matricula: "",
};

type MovimentacaoRow = DashboardDataResponse["rows"]["solicitacoes"][number];
type OrigemMovimentacao = MovimentacaoRow["origem"];
type EventoTipo = "solicitacao" | "devolucao";
type EventoDashboardRow = MovimentacaoRow & {
  evento_tipo: EventoTipo;
  evento_chave: string;
};

const COLUNAS_EVENTOS: DataTableColumn<EventoDashboardRow>[] = [
  {
    key: "timestamp",
    title: "Data/Hora",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => new Date(row.timestamp).getTime(),
  },
  {
    key: "evento_tipo",
    title: "Evento",
    align: "center",
    sortValue: (row) => row.evento_tipo,
  },
  {
    key: "origem",
    title: "Origem",
    align: "center",
    sortValue: (row) => row.origem,
  },
  {
    key: "matricula",
    title: "Matrícula",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => row.matricula,
  },
  {
    key: "solicitante",
    title: "Solicitante",
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

const KPI_META: Record<
  KpiChave,
  {
    label: string;
    descricao: string;
    tone: "info" | "success" | "neutral";
  }
> = {
  emprestimos: {
    label: "Emprestimos",
    descricao: "Mostrando somente eventos de solicitação.",
    tone: "info",
  },
  devolucoes: {
    label: "Devolucoes",
    descricao: "Mostrando somente eventos de devolução.",
    tone: "success",
  },
  disponiveis: {
    label: "Itens disponíveis",
    descricao: "Mostrando os itens atualmente disponíveis.",
    tone: "neutral",
  },
  emprestados: {
    label: "Itens emprestados",
    descricao: "Mostrando os itens atualmente emprestados.",
    tone: "neutral",
  },
};

type ItemDashboardResumo = {
  codigo: string;
  descricao: string | null;
  tipo: string;
  tamanho: string;
  status: "disponivel" | "emprestado" | "inativo";
  solicitanteMatricula: string | null;
  setorSolicitante: string | null;
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

type ItemTabelaRow = ItemDashboardResumo & {
  solicitanteNome: string | null;
  unidadeLabel: string | null;
  setorLabel: string | null;
  origemAtual: OrigemMovimentacao | null;
};

const COLUNAS_ITENS: DataTableColumn<ItemTabelaRow>[] = [
  {
    key: "codigo",
    title: "Item",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => row.codigo,
  },
  {
    key: "tipo",
    title: "Tipo",
    align: "center",
    sortValue: (row) => row.tipo,
  },
  {
    key: "tamanho",
    title: "Tam",
    align: "center",
    sortValue: (row) => row.tamanho,
  },
  {
    key: "status",
    title: "Status",
    align: "center",
    sortValue: (row) => row.status,
  },
  {
    key: "origem",
    title: "Origem",
    align: "center",
    sortValue: (row) => row.origemAtual ?? "",
  },
  {
    key: "matricula",
    title: "Matrícula",
    align: "center",
    className: "font-mono tabular-nums",
    sortValue: (row) => row.solicitanteMatricula ?? "",
  },
  {
    key: "solicitante",
    title: "Solicitante",
    align: "center",
    sortValue: (row) => row.solicitanteNome ?? "",
  },
  {
    key: "unidade",
    title: "Unidade",
    align: "center",
    sortValue: (row) => row.unidadeLabel ?? "",
  },
  {
    key: "setor",
    title: "Setor",
    align: "center",
    sortValue: (row) => row.setorLabel ?? "",
  },
];

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

function descricaoItemResumo(descricao: string | null | undefined) {
  return (descricao ?? "").trim();
}

function statusItemLabel(status: ItemDashboardResumo["status"]) {
  if (status === "disponivel") return "Disponível";
  if (status === "emprestado") return "Emprestado";
  return "Inativo";
}

function statusItemTone(status: ItemDashboardResumo["status"]): "success" | "info" | "danger" {
  if (status === "disponivel") return "success";
  if (status === "emprestado") return "info";
  return "danger";
}

function origemMovimentacaoLabel(origem: OrigemMovimentacao) {
  return origem === "setor" ? "Setor" : "Colaborador";
}

function origemMovimentacaoTone(origem: OrigemMovimentacao): "info" | "neutral" {
  return origem === "setor" ? "info" : "neutral";
}

function eventoTipoLabel(tipo: EventoTipo) {
  return tipo === "solicitacao" ? "Solicitação" : "Devolução";
}

function eventoTipoTone(tipo: EventoTipo): "info" | "success" {
  return tipo === "solicitacao" ? "info" : "success";
}

function ordenarEventos(a: EventoDashboardRow, b: EventoDashboardRow) {
  return (
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() ||
    a.evento_chave.localeCompare(b.evento_chave)
  );
}

function filtroOrigemLabel(origem: string) {
  if (origem === "setor") return "Setor";
  if (origem === "colaborador") return "Colaborador";
  return "Todos";
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

function buscarFuncionarioExato(
  termo: string,
  funcionarios: DashboardFiltersResponse["funcionarios"],
) {
  const termoNormalizado = normalizarBuscaTexto(termo);
  if (!termoNormalizado) {
    return null;
  }

  const matchMatricula = funcionarios.find(
    (funcionario) => normalizarBuscaTexto(funcionario.matricula) === termoNormalizado,
  );
  if (matchMatricula) {
    return matchMatricula;
  }

  const matchesNome = funcionarios.filter(
    (funcionario) => normalizarBuscaTexto(funcionario.nome) === termoNormalizado,
  );
  if (matchesNome.length === 1) {
    return matchesNome[0];
  }

  return null;
}

function listaUnicaRotulos(valores: Array<string | null | undefined>) {
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const valor of valores) {
    const normalizado = (valor ?? "").trim();
    if (!normalizado || vistos.has(normalizado)) {
      continue;
    }
    vistos.add(normalizado);
    resultado.push(normalizado);
  }

  return resultado;
}

export function DashboardTab() {
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIAIS });
  const [opcoes, setOpcoes] = useState<DashboardFiltersResponse>({
    unidades: [],
    setores: [],
    funcionarios: [],
  });
  const [setoresCatalogo, setSetoresCatalogo] = useState<CatalogoRow[]>([]);
  const [data, setData] = useState<DashboardDataResponse | null>(null);
  const [itensResumo, setItensResumo] = useState<ItemDashboardResumo[]>([]);
  const [funcionariosResumo, setFuncionariosResumo] = useState<FuncionarioDashboardResumo[]>([]);
  const [kpiSelecionado, setKpiSelecionado] = useState<KpiChave | null>(null);
  const [openResumoSolicitacaoModal, setOpenResumoSolicitacaoModal] = useState(false);
  const [openResumoDevolucaoModal, setOpenResumoDevolucaoModal] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<MovimentacaoRow | null>(null);
  const [devolucaoSelecionada, setDevolucaoSelecionada] = useState<MovimentacaoRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paginaEventos, setPaginaEventos] = useState(1);
  const [sortEventosTabela, setSortEventosTabela] = useState<DataTableSortState>(null);
  const [sortItensTabela, setSortItensTabela] = useState<DataTableSortState>(null);
  const [buscaFuncionario, setBuscaFuncionario] = useState("");
  const [buscaFuncionarioDebounced, setBuscaFuncionarioDebounced] = useState("");
  const [mostrarSugestoesFuncionario, setMostrarSugestoesFuncionario] = useState(false);
  const [loadingBuscaFuncionario, setLoadingBuscaFuncionario] = useState(false);
  const { success, error } = useToast();
  const { openFuncionario, openKit } = useGlobalDetail();
  const containerBuscaFuncionarioRef = useRef<HTMLDivElement | null>(null);
  const atualizacaoSilenciosaRef = useRef(false);
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
  const funcionarioByMatricula = useMemo(
    () => new Map(funcionariosResumo.map((funcionario) => [funcionario.matricula, funcionario] as const)),
    [funcionariosResumo],
  );

  const carregarOpcoes = useCallback(async (options?: { silencioso?: boolean }) => {
    try {
      const [payload, setoresData] = await Promise.all([
        api.get<DashboardFiltersResponse>("/admin/dashboard/filtros"),
        api.get<CatalogoRow[]>("/admin/setores"),
      ]);
      setOpcoes(payload);
      setSetoresCatalogo(setoresData.filter((row) => row.statusAtivo));
    } catch (err) {
      if (!options?.silencioso) {
        error(err instanceof Error ? err.message : "Erro ao carregar filtros");
      }
    }
  }, [error]);

  const carregarDadosResumo = useCallback(async (options?: { silencioso?: boolean }) => {
    try {
      const [itens, funcionarios] = await Promise.all([
        api.get<ItemDashboardResumo[]>("/admin/itens?include_inactive=true"),
        api.get<FuncionarioDashboardResumo[]>("/admin/funcionarios?include_inactive=true"),
      ]);
      setItensResumo(itens);
      setFuncionariosResumo(funcionarios);
    } catch (err) {
      if (!options?.silencioso) {
        error(err instanceof Error ? err.message : "Erro ao carregar resumo dos cards");
      }
    }
  }, [error]);

  const carregarDashboard = useCallback(
    async (filtrosOverride?: typeof FILTROS_INICIAIS, options?: { silencioso?: boolean }) => {
      const filtrosAtuais = filtrosOverride ?? filtros;
      if (!options?.silencioso) {
        setLoading(true);
      }
      try {
        const payload = await api.post<DashboardDataResponse>("/admin/dashboard", {
          data_inicio: filtrosAtuais.data_inicio || undefined,
          data_fim: filtrosAtuais.data_fim || undefined,
          unidade: filtrosAtuais.unidade || undefined,
          setor: filtrosAtuais.setor || undefined,
          origem: filtrosAtuais.origem || undefined,
          matricula: filtrosAtuais.matricula || undefined,
        });
        setData(payload);
      } catch (err) {
        if (!options?.silencioso) {
          error(err instanceof Error ? err.message : "Erro ao carregar dashboard");
        }
      } finally {
        if (!options?.silencioso) {
          setLoading(false);
        }
      }
    },
    [error, filtros],
  );

  const atualizarSilenciosamente = useCallback(async () => {
    if (atualizacaoSilenciosaRef.current) {
      return;
    }
    atualizacaoSilenciosaRef.current = true;
    try {
      await Promise.all([
        carregarDashboard(undefined, { silencioso: true }),
        carregarDadosResumo({ silencioso: true }),
        carregarOpcoes({ silencioso: true }),
      ]);
    } finally {
      atualizacaoSilenciosaRef.current = false;
    }
  }, [carregarDashboard, carregarDadosResumo, carregarOpcoes]);

  async function exportar() {
    setExporting(true);
    try {
      const blob = await api.postBlob("/admin/export", {
        data_inicio: filtros.data_inicio || undefined,
        data_fim: filtros.data_fim || undefined,
        unidade: filtros.unidade || undefined,
        setor: filtros.setor || undefined,
        origem: filtros.origem || undefined,
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
      if (
        entidade === "kit" ||
        entidade === "funcionario" ||
        entidade === "setor" ||
        entidade === "unidade" ||
        entidade === "funcao"
      ) {
        void atualizarSilenciosamente();
      }
    };

    window.addEventListener("global-detail-updated", onUpdated);
    return () => window.removeEventListener("global-detail-updated", onUpdated);
  }, [atualizarSilenciosamente]);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void atualizarSilenciosamente();
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void atualizarSilenciosamente();
    }, DASHBOARD_AUTO_REFRESH_MS);

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [atualizarSilenciosamente]);

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

  useEffect(() => {
    if (filtros.origem !== "setor") {
      return;
    }
    if (!filtros.matricula && !buscaFuncionario) {
      return;
    }

    setFiltros((prev) => ({ ...prev, matricula: "" }));
    setBuscaFuncionario("");
    setBuscaFuncionarioDebounced("");
    setMostrarSugestoesFuncionario(false);
    setLoadingBuscaFuncionario(false);
  }, [filtros.matricula, filtros.origem, buscaFuncionario]);

  const setorByNome = useMemo(
    () => new Map(setoresCatalogo.map((setor) => [setor.nome, setor] as const)),
    [setoresCatalogo],
  );

  const setoresDisponiveisFiltro = useMemo(() => {
    if (!filtros.unidade) {
      return opcoes.setores;
    }

    return opcoes.setores.filter((setorNome) => {
      const setor = setorByNome.get(setorNome);
      if (!setor) {
        return true;
      }
      const unidadesSetor = setor.unidades?.filter(Boolean) ?? [];
      if (unidadesSetor.length === 0) {
        return true;
      }
      return unidadesSetor.includes(filtros.unidade);
    });
  }, [opcoes.setores, filtros.unidade, setorByNome]);

  const unidadesDisponiveisFiltro = useMemo(() => {
    if (!filtros.setor) {
      return opcoes.unidades;
    }

    const setor = setorByNome.get(filtros.setor);
    if (!setor) {
      return opcoes.unidades;
    }

    const unidadesSetor = setor.unidades?.filter(Boolean) ?? [];
    if (unidadesSetor.length === 0) {
      return opcoes.unidades;
    }

    return opcoes.unidades.filter((unidadeNome) => unidadesSetor.includes(unidadeNome));
  }, [opcoes.unidades, filtros.setor, setorByNome]);

  useEffect(() => {
    const setorInvalido = Boolean(filtros.setor) && !setoresDisponiveisFiltro.includes(filtros.setor);
    const unidadeInvalida = Boolean(filtros.unidade) && !unidadesDisponiveisFiltro.includes(filtros.unidade);

    if (!setorInvalido && !unidadeInvalida) {
      return;
    }

    setFiltros((prev) => ({
      ...prev,
      setor: setorInvalido ? "" : prev.setor,
      unidade: unidadeInvalida ? "" : prev.unidade,
    }));
  }, [filtros.setor, filtros.unidade, setoresDisponiveisFiltro, unidadesDisponiveisFiltro]);

  const solicitacoesFiltradas = useMemo(() => data?.rows.solicitacoes ?? [], [data]);
  const devolucoesFiltradas = useMemo(() => data?.rows.devolucoes ?? [], [data]);
  const eventosFiltrados = useMemo(() => {
    const eventosSolicitacao = solicitacoesFiltradas.map((row) => ({
      ...row,
      evento_tipo: "solicitacao" as const,
      evento_chave: `solicitacao-${row.id}`,
    }));
    const eventosDevolucao = devolucoesFiltradas.map((row) => ({
      ...row,
      evento_tipo: "devolucao" as const,
      evento_chave: `devolucao-${row.id}`,
    }));

    const eventosOrdenados = [...eventosSolicitacao, ...eventosDevolucao].sort(ordenarEventos);

    const matriculaFiltro = filtros.matricula.trim();
    if (matriculaFiltro) {
      return eventosOrdenados.filter((evento) => evento.matricula === matriculaFiltro);
    }

    return eventosOrdenados;
  }, [devolucoesFiltradas, filtros.matricula, solicitacoesFiltradas]);
  const filtrosDashboardAtivos = useMemo(
    () =>
      Boolean(
        filtros.data_inicio ||
        filtros.data_fim ||
        filtros.unidade ||
        filtros.setor ||
        filtros.origem ||
        filtros.matricula,
      ),
    [
      filtros.data_inicio,
      filtros.data_fim,
      filtros.matricula,
      filtros.origem,
      filtros.setor,
      filtros.unidade,
    ],
  );
  const filtroMatriculaAtivo = useMemo(() => Boolean(filtros.matricula.trim()), [filtros.matricula]);
  const codigosItensNoRecorte = useMemo(
    () => new Set(eventosFiltrados.map((evento) => evento.item_codigo)),
    [eventosFiltrados],
  );
  const itensAtivos = useMemo(
    () => itensResumo.filter((item) => item.statusAtivo),
    [itensResumo],
  );
  const itensAtivosNoRecorte = useMemo(
    () => itensAtivos.filter((item) => !filtrosDashboardAtivos || codigosItensNoRecorte.has(item.codigo)),
    [codigosItensNoRecorte, filtrosDashboardAtivos, itensAtivos],
  );
  const itensDisponiveisNoRecorte = useMemo(
    () => itensAtivos.filter((item) => item.status === "disponivel"),
    [itensAtivos],
  );
  const itensEmprestadosNoRecorte = useMemo(
    () => {
      let itensEmprestados = itensAtivosNoRecorte.filter((item) => item.status === "emprestado");

      if (filtros.origem === "colaborador") {
        itensEmprestados = itensEmprestados.filter((item) => !(item.setorSolicitante ?? "").trim());
      } else if (filtros.origem === "setor") {
        itensEmprestados = itensEmprestados.filter((item) => Boolean((item.setorSolicitante ?? "").trim()));
      }

      if (!filtroMatriculaAtivo) {
        return itensEmprestados;
      }
      const matriculaFiltro = filtros.matricula.trim();
      return itensEmprestados.filter((item) => item.solicitanteMatricula === matriculaFiltro);
    },
    [filtroMatriculaAtivo, filtros.matricula, filtros.origem, itensAtivosNoRecorte],
  );
  const eventosTabelaFiltrados = useMemo(() => {
    if (!kpiSelecionado) {
      return eventosFiltrados;
    }

    if (kpiSelecionado === "emprestimos") {
      return eventosFiltrados.filter((evento) => evento.evento_tipo === "solicitacao");
    }

    if (kpiSelecionado === "devolucoes") {
      return eventosFiltrados.filter((evento) => evento.evento_tipo === "devolucao");
    }

    return eventosFiltrados;
  }, [eventosFiltrados, kpiSelecionado]);
  const resumoMovimentacoesPorOrigem = useMemo(() => {
    const solicitacoesSetor = solicitacoesFiltradas.filter((row) => row.origem === "setor").length;
    const devolucoesSetor = devolucoesFiltradas.filter((row) => row.origem === "setor").length;
    return {
      solicitacoesSetor,
      solicitacoesColaborador: solicitacoesFiltradas.length - solicitacoesSetor,
      devolucoesSetor,
      devolucoesColaborador: devolucoesFiltradas.length - devolucoesSetor,
    };
  }, [devolucoesFiltradas, solicitacoesFiltradas]);

  const exibindoTabelaItens = kpiSelecionado === "disponiveis" || kpiSelecionado === "emprestados";
  const itensTabelaFiltrados = useMemo(() => {
    if (!exibindoTabelaItens) {
      return [] satisfies ItemTabelaRow[];
    }

    const itensBaseTabela = kpiSelecionado === "disponiveis"
      ? itensAtivos
      : itensEmprestadosNoRecorte;

    return itensBaseTabela
      .filter((item) => {
        if (kpiSelecionado === "disponiveis") {
          return item.status === "disponivel";
        }
        if (kpiSelecionado === "emprestados") {
          return item.status === "emprestado";
        }
        return false;
      })
      .map((item) => {
        const funcionario = item.solicitanteMatricula
          ? funcionarioByMatricula.get(item.solicitanteMatricula) ?? null
          : null;
        const setoresFuncionario = funcionario
          ? listaUnicaRotulos([...(funcionario.setores ?? []), funcionario.setor])
          : [];
        const unidadesFuncionario = funcionario
          ? listaUnicaRotulos([...(funcionario.unidades ?? []), funcionario.unidade])
          : [];
        const unidadeSetor = item.setorSolicitante
          ? listaUnicaRotulos(setorByNome.get(item.setorSolicitante)?.unidades ?? [])
          : [];
        const solicitanteNome = item.setorSolicitante ? `Setor ${item.setorSolicitante}` : funcionario?.nome ?? null;
        const origemAtual =
          item.status === "emprestado"
            ? (item.setorSolicitante ? "setor" : "colaborador")
            : null;

        return {
          ...item,
          solicitanteNome,
          unidadeLabel:
            item.setorSolicitante
              ? (unidadeSetor.join(", ") || null)
              : (unidadesFuncionario.join(", ") || null),
          setorLabel: item.setorSolicitante ?? (setoresFuncionario.join(", ") || null),
          origemAtual,
        } satisfies ItemTabelaRow;
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "base" }));
  }, [exibindoTabelaItens, funcionarioByMatricula, itensAtivos, itensEmprestadosNoRecorte, kpiSelecionado, setorByNome]);

  useEffect(() => {
    setPaginaEventos(1);
  }, [filtros.data_inicio, filtros.data_fim, filtros.unidade, filtros.setor, filtros.origem, filtros.matricula, data, kpiSelecionado]);

  const eventosTabelaOrdenados = useMemo(
    () => sortDataTableRows(eventosTabelaFiltrados, COLUNAS_EVENTOS, sortEventosTabela),
    [eventosTabelaFiltrados, sortEventosTabela],
  );
  const itensTabelaOrdenados = useMemo(
    () => sortDataTableRows(itensTabelaFiltrados, COLUNAS_ITENS, sortItensTabela),
    [itensTabelaFiltrados, sortItensTabela],
  );
  const totalPaginasEventos = Math.max(1, Math.ceil(eventosTabelaOrdenados.length / ITENS_POR_PAGINA));

  const eventosPaginados = useMemo(() => {
    const inicio = (paginaEventos - 1) * ITENS_POR_PAGINA;
    return eventosTabelaOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [eventosTabelaOrdenados, paginaEventos]);

  const totalPaginasItens = Math.max(1, Math.ceil(itensTabelaOrdenados.length / ITENS_POR_PAGINA));
  const itensPaginados = useMemo(() => {
    const inicio = (paginaEventos - 1) * ITENS_POR_PAGINA;
    return itensTabelaOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [itensTabelaOrdenados, paginaEventos]);
  const totalPaginasTabela = exibindoTabelaItens ? totalPaginasItens : totalPaginasEventos;
  const totalRegistrosTabela = exibindoTabelaItens
    ? itensTabelaOrdenados.length
    : eventosTabelaOrdenados.length;

  useEffect(() => {
    if (paginaEventos > totalPaginasTabela) setPaginaEventos(totalPaginasTabela);
  }, [paginaEventos, totalPaginasTabela]);

  const inicioEventos = totalRegistrosTabela === 0 ? 0 : (paginaEventos - 1) * ITENS_POR_PAGINA + 1;
  const fimEventos = Math.min(paginaEventos * ITENS_POR_PAGINA, totalRegistrosTabela);
  const filtroKpiAtivo = kpiSelecionado ? KPI_META[kpiSelecionado] : null;
  const emptyMessageEventos = useMemo(() => {
    if (kpiSelecionado === "disponiveis") {
      return "Sem itens disponíveis no momento.";
    }
    if (kpiSelecionado === "emprestados") {
      return "Sem itens emprestados no momento.";
    }
    return "Sem eventos para os filtros atuais.";
  }, [kpiSelecionado]);

  const periodoAtivo = filtros.data_inicio || filtros.data_fim
    ? `${formatarDataFiltro(filtros.data_inicio)} - ${formatarDataFiltro(filtros.data_fim)}`
    : "Período completo";
  const filtroSomenteSetor = filtros.origem === "setor";
  const sugestoesFuncionario = useMemo(() => {
    const termo = normalizarBuscaTexto(buscaFuncionarioDebounced);
    if (!mostrarSugestoesFuncionario || filtros.origem === "setor" || termo.length < 2) {
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
    filtros.origem,
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
  const itemSolicitacaoSelecionada = useMemo(
    () => (solicitacaoSelecionada ? itemByCodigo.get(solicitacaoSelecionada.item_codigo) ?? null : null),
    [solicitacaoSelecionada, itemByCodigo],
  );
  const itemDevolucaoSelecionada = useMemo(
    () => (devolucaoSelecionada ? itemByCodigo.get(devolucaoSelecionada.item_codigo) ?? null : null),
    [devolucaoSelecionada, itemByCodigo],
  );

  const resumoEmprestadosPorOrigem = useMemo(() => {
    const setor = itensEmprestadosNoRecorte.filter((item) => Boolean(item.setorSolicitante)).length;
    return {
      setor,
      colaborador: itensEmprestadosNoRecorte.length - setor,
    };
  }, [itensEmprestadosNoRecorte]);

  const cardsKpi = data
    ? ([
        {
          chave: "emprestimos",
          label: "Emprestimos",
          valor: solicitacoesFiltradas.length,
          detalhes: [
            { label: "Colaborador", valor: resumoMovimentacoesPorOrigem.solicitacoesColaborador },
            { label: "Setor", valor: resumoMovimentacoesPorOrigem.solicitacoesSetor },
          ],
          icon: Package,
          gradientClass: "from-primary/18 via-primary/8 to-transparent",
          iconClass: "text-primary",
        },
        {
          chave: "devolucoes",
          label: "Devoluções",
          valor: devolucoesFiltradas.length,
          detalhes: [
            { label: "Colaborador", valor: resumoMovimentacoesPorOrigem.devolucoesColaborador },
            { label: "Setor", valor: resumoMovimentacoesPorOrigem.devolucoesSetor },
          ],
          icon: Undo2,
          gradientClass:
            "from-[hsl(203_88%_52%_/_0.18)] via-[hsl(203_88%_52%_/_0.08)] to-transparent",
          iconClass: "text-[hsl(203_88%_46%)] dark:text-[hsl(203_92%_73%)]",
        },
        {
          chave: "disponiveis",
          label: "Itens disponíveis",
          valor: itensDisponiveisNoRecorte.length,
          detalhes: [{ label: "Status", valor: "Disponível" }],
          icon: Boxes,
          gradientClass:
            "from-[hsl(197_92%_56%_/_0.2)] via-[hsl(197_92%_56%_/_0.08)] to-transparent",
          iconClass: "text-[hsl(197_88%_42%)] dark:text-[hsl(195_95%_72%)]",
        },
        {
          chave: "emprestados",
          label: "Itens emprestados",
          valor: itensEmprestadosNoRecorte.length,
          detalhes: [
            { label: "Colaborador", valor: resumoEmprestadosPorOrigem.colaborador },
            { label: "Setor", valor: resumoEmprestadosPorOrigem.setor },
          ],
          icon: BarChart3,
          gradientClass:
            "from-[hsl(210_92%_56%_/_0.17)] via-[hsl(210_92%_56%_/_0.08)] to-transparent",
          iconClass: "text-[hsl(210_88%_47%)] dark:text-[hsl(210_95%_74%)]",
        },
      ] satisfies Array<{
        chave: KpiChave;
        label: string;
        valor: number;
        detalhes: Array<{ label: string; valor: string | number }>;
        icon: typeof Package;
        gradientClass: string;
        iconClass: string;
      }>)
    : [];

  useEffect(() => {
    if (!kpiSelecionado) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setKpiSelecionado(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [kpiSelecionado]);

  function abrirResumoSolicitacao(row: MovimentacaoRow) {
    setSolicitacaoSelecionada(row);
    setOpenResumoSolicitacaoModal(true);
  }

  function abrirResumoDevolucao(row: MovimentacaoRow) {
    setDevolucaoSelecionada(row);
    setOpenResumoDevolucaoModal(true);
  }

  function abrirResumoEvento(row: EventoDashboardRow) {
    if (row.evento_tipo === "solicitacao") {
      abrirResumoSolicitacao(row);
      return;
    }
    abrirResumoDevolucao(row);
  }

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
              <p className="max-w-2xl text-pretty text-[11px] leading-snug text-muted-foreground">
                Visualize movimentações, acompanhe os indicadores principais e detalhe operações por período, setor e funcionário.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info" className="text-[10px]">
                Período: {periodoAtivo}
              </StatusPill>
              <StatusPill tone="neutral" className="text-[10px]">
                Visão: {filtroOrigemLabel(filtros.origem)}
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

          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
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
                  {unidadesDisponiveisFiltro.map((unidade) => (
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
                  {setoresDisponiveisFiltro.map((setor) => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-origem" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Visão
              </Label>
              <Select
                value={filtros.origem || "todos"}
                onValueChange={(value) => setFiltros((prev) => ({ ...prev, origem: value === "todos" ? "" : value }))}
              >
                <SelectTrigger id="f-origem" className="h-9 rounded-xl border-border/80 bg-background/85 text-[11px] dark:border-border/90 dark:bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-matricula" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Funcionário
              </Label>
              <div ref={containerBuscaFuncionarioRef} className="relative">
                <div className="flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-background/85 px-2 dark:border-border/90 dark:bg-background/70">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input
                    id="f-matricula"
                    value={buscaFuncionario}
                    placeholder={filtroSomenteSetor ? "Disponível apenas para visão colaborador/todos" : "Buscar por nome ou matrícula"}
                    autoComplete="off"
                    disabled={filtroSomenteSetor}
                    className="h-full min-w-0 flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/80 outline-none"
                    onChange={(event) => {
                      if (filtroSomenteSetor) {
                        return;
                      }
                      const value = event.target.value;
                      setBuscaFuncionario(value);
                      setMostrarSugestoesFuncionario(value.trim().length >= 2);
                      if (filtros.matricula) {
                        setFiltros((prev) => ({ ...prev, matricula: "" }));
                      }
                    }}
                    onFocus={() => {
                      if (filtroSomenteSetor) {
                        return;
                      }
                      if (buscaFuncionario.trim().length >= 2) {
                        setMostrarSugestoesFuncionario(true);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setMostrarSugestoesFuncionario(false);
                        return;
                      }
                      if (event.key !== "Enter") {
                        return;
                      }

                      if (sugestoesFuncionario.length > 0) {
                        event.preventDefault();
                        selecionarFuncionario(sugestoesFuncionario[0]);
                        return;
                      }

                      const funcionarioExato = buscarFuncionarioExato(buscaFuncionario, opcoes.funcionarios);
                      if (funcionarioExato) {
                        event.preventDefault();
                        selecionarFuncionario(funcionarioExato);
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
                      aria-label="Limpar filtro de funcionário"
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
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Buscando funcionários...</p>
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
                          <div className="text-[10px] text-muted-foreground">Matrícula {funcionario.matricula}</div>
                        </button>
                      ))}
                      {!loadingBuscaFuncionario && sugestoesFuncionario.length === 0 && buscaFuncionarioDebounced.trim().length >= 2 && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          {filtros.setor || filtros.unidade
                            ? "Nenhum funcionário encontrado para os filtros de unidade/setor."
                            : "Nenhum funcionário encontrado."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {!filtroSomenteSetor && buscaFuncionario.trim().length >= 2 && !filtros.matricula ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Selecione um funcionário da lista para aplicar o filtro no dashboard.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {cardsKpi.map((card, index) => {
              const Icon = card.icon;
              const selecionado = kpiSelecionado === card.chave;
              return (
                <Card
                  key={card.chave}
                  className={cn(
                    "group relative min-h-[126px] overflow-hidden border-border/65 bg-card/95 shadow-[var(--shadow-soft)] transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-2 dark:border-border/85 dark:bg-card/90",
                    selecionado
                      ? "border-primary/55 bg-primary/[0.06] ring-1 ring-primary/30 shadow-[0_16px_28px_-24px_hsl(var(--primary)/0.95)] dark:border-primary/50 dark:bg-primary/[0.11]"
                      : "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_26px_-24px_hsl(var(--primary)/0.9)]",
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {selecionado ? (
                    <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-primary/65" />
                  ) : null}
                  <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", card.gradientClass)} />
                  <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-background/45 blur-2xl dark:bg-background/20" />
                  <button
                    type="button"
                    className="relative h-full w-full cursor-pointer rounded-[inherit] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() =>
                      setKpiSelecionado((anterior) => (anterior === card.chave ? null : card.chave))
                    }
                    aria-pressed={selecionado}
                    aria-label={`Filtrar eventos por ${card.label}`}
                  >
                    <CardContent className="relative flex h-full flex-col gap-3 p-3.5 sm:p-4">
                      <div className="flex items-start justify-between gap-2.5">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground sm:text-xs">
                              {card.label}
                            </p>
                            {selecionado ? (
                              <StatusPill tone="info" className="h-4 px-1.5 text-[9px]">
                                Filtro ativo
                              </StatusPill>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight text-foreground sm:text-[1.95rem]">
                            {card.valor}
                          </p>
                        </div>
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/80 shadow-sm dark:border-border/80 dark:bg-background/60",
                          selecionado && "border-primary/40 bg-primary/[0.08] dark:border-primary/40 dark:bg-primary/[0.16]",
                        )}>
                          <Icon className={cn("h-4 w-4", card.iconClass)} />
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-1.5">
                        {card.detalhes.map((detalhe) => (
                          <div
                            key={`${card.chave}-${detalhe.label}`}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/65 bg-background/65 px-2.5 py-1.5 text-[11px] leading-none dark:border-border/80 dark:bg-background/45"
                          >
                            <span className="truncate font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              {detalhe.label}
                            </span>
                            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/45" />
                            <span className="truncate font-semibold text-foreground">{detalhe.valor}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </button>
                </Card>
              );
            })}
          </div>

          <Modal
            open={openResumoSolicitacaoModal}
            onClose={() => setOpenResumoSolicitacaoModal(false)}
            title="Resumo da solicitação"
            description="Resumo da movimentacao selecionada na tabela de solicitacoes."
            maxWidthClassName="max-w-2xl"
          >
            {solicitacaoSelecionada ? (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-background/72 p-3 dark:border-border/85 dark:bg-background/55">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Evento</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatarTimestamp(solicitacaoSelecionada.timestamp).completo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Operador: {solicitacaoSelecionada.operador_nome}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/72 p-3 dark:border-border/85 dark:bg-background/55">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Solicitante</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {solicitacaoSelecionada.origem === "setor"
                        ? (solicitacaoSelecionada.setor_solicitante ?? solicitacaoSelecionada.nome_funcionario)
                        : solicitacaoSelecionada.nome_funcionario}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Origem: {origemMovimentacaoLabel(solicitacaoSelecionada.origem)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Matrícula: {solicitacaoSelecionada.origem === "setor" ? "--" : solicitacaoSelecionada.matricula}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {solicitacaoSelecionada.unidade ?? "-"} | {solicitacaoSelecionada.setor_solicitante ?? solicitacaoSelecionada.setor ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/72 p-3 dark:border-border/85 dark:bg-background/55">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Item</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="neutral" className="font-mono text-[10px]">{solicitacaoSelecionada.item_codigo}</StatusPill>
                    {itemSolicitacaoSelecionada ? (
                      <>
                        <StatusPill tone="neutral" className="text-[10px]">{itemSolicitacaoSelecionada.tipo}</StatusPill>
                        <StatusPill tone="neutral" className="text-[10px]">Tam: {itemSolicitacaoSelecionada.tamanho}</StatusPill>
                        <StatusPill tone={statusItemTone(itemSolicitacaoSelecionada.status)} className="text-[10px]">
                          {statusItemLabel(itemSolicitacaoSelecionada.status)}
                        </StatusPill>
                        <StatusPill tone={itemSolicitacaoSelecionada.statusAtivo ? "success" : "danger"} className="text-[10px]">
                          {itemSolicitacaoSelecionada.statusAtivo ? "Ativo" : "Inativo"}
                        </StatusPill>
                      </>
                    ) : null}
                  </div>
                  {itemSolicitacaoSelecionada && descricaoItemResumo(itemSolicitacaoSelecionada.descricao) ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Descrição: {descricaoItemResumo(itemSolicitacaoSelecionada.descricao)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {solicitacaoSelecionada.origem === "colaborador" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void openFuncionario(solicitacaoSelecionada.matricula);
                      }}
                    >
                      Ver funcionário
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void openKit(solicitacaoSelecionada.item_codigo);
                    }}
                  >
                    Ver item
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 py-3 text-center text-sm text-muted-foreground">
                Nenhuma solicitação selecionada.
              </p>
            )}
          </Modal>

          <Modal
            open={openResumoDevolucaoModal}
            onClose={() => setOpenResumoDevolucaoModal(false)}
            title="Resumo da devolução"
            description="Resumo da movimentacao selecionada na tabela de devolucoes."
            maxWidthClassName="max-w-2xl"
          >
            {devolucaoSelecionada ? (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-background/72 p-3 dark:border-border/85 dark:bg-background/55">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Evento</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatarTimestamp(devolucaoSelecionada.timestamp).completo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Operador: {devolucaoSelecionada.operador_nome}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/72 p-3 dark:border-border/85 dark:bg-background/55">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Solicitante</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {devolucaoSelecionada.origem === "setor"
                        ? (devolucaoSelecionada.setor_solicitante ?? devolucaoSelecionada.nome_funcionario)
                        : devolucaoSelecionada.nome_funcionario}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Origem: {origemMovimentacaoLabel(devolucaoSelecionada.origem)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Matrícula: {devolucaoSelecionada.origem === "setor" ? "--" : devolucaoSelecionada.matricula}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {devolucaoSelecionada.unidade ?? "-"} | {devolucaoSelecionada.setor_solicitante ?? devolucaoSelecionada.setor ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/72 p-3 dark:border-border/85 dark:bg-background/55">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Item</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="neutral" className="font-mono text-[10px]">{devolucaoSelecionada.item_codigo}</StatusPill>
                    {itemDevolucaoSelecionada ? (
                      <>
                        <StatusPill tone="neutral" className="text-[10px]">{itemDevolucaoSelecionada.tipo}</StatusPill>
                        <StatusPill tone="neutral" className="text-[10px]">Tam: {itemDevolucaoSelecionada.tamanho}</StatusPill>
                        <StatusPill tone={statusItemTone(itemDevolucaoSelecionada.status)} className="text-[10px]">
                          {statusItemLabel(itemDevolucaoSelecionada.status)}
                        </StatusPill>
                        <StatusPill tone={itemDevolucaoSelecionada.statusAtivo ? "success" : "danger"} className="text-[10px]">
                          {itemDevolucaoSelecionada.statusAtivo ? "Ativo" : "Inativo"}
                        </StatusPill>
                      </>
                    ) : null}
                  </div>
                  {itemDevolucaoSelecionada && descricaoItemResumo(itemDevolucaoSelecionada.descricao) ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Descrição: {descricaoItemResumo(itemDevolucaoSelecionada.descricao)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {devolucaoSelecionada.origem === "colaborador" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void openFuncionario(devolucaoSelecionada.matricula);
                      }}
                    >
                      Ver funcionário
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void openKit(devolucaoSelecionada.item_codigo);
                    }}
                  >
                    Ver item
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 py-3 text-center text-sm text-muted-foreground">
                Nenhuma devolução selecionada.
              </p>
            )}
          </Modal>

          <SectionCard
            title={<span className="text-sm font-semibold">{exibindoTabelaItens ? "Itens" : "Eventos"}</span>}
            icon={exibindoTabelaItens ? Boxes : BarChart3}
            actions={(
              <div className="flex items-center gap-1.5">
                {filtroKpiAtivo ? (
                  <StatusPill tone={filtroKpiAtivo.tone} className="text-[10px]">
                    Filtro: {filtroKpiAtivo.label}
                  </StatusPill>
                ) : null}
                <StatusPill tone="info" className="text-[10px]">{totalRegistrosTabela} registros</StatusPill>
              </div>
            )}
            className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
            headerClassName="pb-1.5"
            contentClassName="pt-0"
          >
            {filtroKpiAtivo ? (
              <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 px-2 py-1 dark:border-border/85 dark:bg-background/55">
                <p className="text-[10px] text-muted-foreground">{filtroKpiAtivo.descricao}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setKpiSelecionado(null)}
                >
                  Limpar filtro
                </Button>
              </div>
            ) : null}
            <div className="min-h-[198px]">
              {exibindoTabelaItens ? (
                <DataTable
                  columns={COLUNAS_ITENS}
                  rows={itensPaginados}
                  sortState={sortItensTabela}
                  onSortStateChange={setSortItensTabela}
                  getRowKey={(row) => row.codigo}
                  onRowClick={(row) => {
                    void openKit(row.codigo);
                  }}
                  loading={loading}
                  emptyMessage={emptyMessageEventos}
                  minWidthClassName="min-w-0"
                  containerClassName="overflow-x-hidden border-border/65 bg-background/70 dark:border-border/85 dark:bg-background/55"
                  emptyCellClassName="py-3"
                  renderRow={(row) => {
                    const descricao = descricaoItemResumo(row.descricao);
                    return (
                      <>
                        <td className="max-w-0 truncate font-mono" title={descricao ? `${row.codigo} | ${descricao}` : row.codigo}>
                          <button
                            type="button"
                            data-row-ignore-click="true"
                            className="font-mono text-primary underline-offset-2 hover:underline"
                            onClick={() => {
                              void openKit(row.codigo);
                            }}
                          >
                            {row.codigo}
                          </button>
                        </td>
                        <td className="max-w-0 truncate" title={row.tipo}>{row.tipo}</td>
                        <td className="max-w-0 truncate" title={row.tamanho}>{row.tamanho}</td>
                        <td className="max-w-0">
                          <StatusPill tone={statusItemTone(row.status)} className="text-[10px]">
                            {statusItemLabel(row.status)}
                          </StatusPill>
                        </td>
                        <td className="max-w-0">
                          {row.origemAtual ? (
                            <StatusPill tone={origemMovimentacaoTone(row.origemAtual)} className="text-[10px]">
                              {origemMovimentacaoLabel(row.origemAtual)}
                            </StatusPill>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td
                          className="max-w-0 truncate"
                          title={row.solicitanteMatricula ?? "--"}
                        >
                          {row.solicitanteMatricula ? (
                            <button
                              type="button"
                              data-row-ignore-click="true"
                              className="font-mono text-primary underline-offset-2 hover:underline"
                              onClick={() => {
                                const matricula = row.solicitanteMatricula;
                                if (!matricula) {
                                  return;
                                }
                                void openFuncionario(matricula);
                              }}
                            >
                              {row.solicitanteMatricula}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="max-w-0 truncate" title={row.solicitanteNome ?? "-"}>{row.solicitanteNome ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.unidadeLabel ?? "-"}>{row.unidadeLabel ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.setorLabel ?? "-"}>{row.setorLabel ?? "-"}</td>
                      </>
                    );
                  }}
                />
              ) : (
                <DataTable
                  columns={COLUNAS_EVENTOS}
                  rows={eventosPaginados}
                  sortState={sortEventosTabela}
                  onSortStateChange={setSortEventosTabela}
                  getRowKey={(row) => row.evento_chave}
                  onRowClick={abrirResumoEvento}
                  loading={loading}
                  emptyMessage={emptyMessageEventos}
                  minWidthClassName="min-w-0"
                  containerClassName="overflow-x-hidden border-border/65 bg-background/70 dark:border-border/85 dark:bg-background/55"
                  emptyCellClassName="py-3"
                  renderRow={(row) => {
                    const dataHora = formatarTimestamp(row.timestamp);
                    const solicitante = row.origem === "setor"
                      ? (row.setor_solicitante ?? row.nome_funcionario)
                      : row.nome_funcionario;
                    return (
                      <>
                        <td className="max-w-0" title={dataHora.completo}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs leading-tight">{dataHora.data}</span>
                            <span className="text-[10px] leading-tight text-muted-foreground">{dataHora.hora}</span>
                          </div>
                        </td>
                        <td className="max-w-0">
                          <StatusPill tone={eventoTipoTone(row.evento_tipo)} className="text-[10px]">
                            {eventoTipoLabel(row.evento_tipo)}
                          </StatusPill>
                        </td>
                        <td className="max-w-0">
                          <StatusPill tone={origemMovimentacaoTone(row.origem)} className="text-[10px]">
                            {origemMovimentacaoLabel(row.origem)}
                          </StatusPill>
                        </td>
                        <td className="max-w-0 truncate" title={row.origem === "colaborador" ? row.matricula : "--"}>
                          {row.origem === "colaborador" ? (
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
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="max-w-0 truncate" title={solicitante}>{solicitante}</td>
                        <td className="max-w-0 truncate" title={row.unidade ?? "-"}>{row.unidade ?? "-"}</td>
                        <td className="max-w-0 truncate" title={row.setor_solicitante ?? row.setor ?? "-"}>
                          {row.setor_solicitante ?? row.setor ?? "-"}
                        </td>
                        <td className="max-w-0 truncate font-mono" title={row.item_codigo}>{row.item_codigo}</td>
                      </>
                    );
                  }}
                />
              )}
            </div>

            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] text-muted-foreground">
                {inicioEventos}-{fimEventos} de {totalRegistrosTabela} | Página {paginaEventos} de {totalPaginasTabela}
              </p>
              <div className="flex min-w-[220px] justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
                  onClick={() => setPaginaEventos((paginaAtual) => Math.max(1, paginaAtual - 1))}
                  disabled={paginaEventos === 1}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
                  onClick={() => setPaginaEventos((paginaAtual) => Math.min(totalPaginasTabela, paginaAtual + 1))}
                  disabled={paginaEventos === totalPaginasTabela}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </SectionCard>
        </>
      ) : (
        <Card className="border-border/70 bg-card/90 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/88">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dados do dashboard</CardTitle>
            <CardDescription>
              {loading ? "Carregando indicadores..." : "Não foi possível carregar os dados. Verifique os filtros e tente novamente."}
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
