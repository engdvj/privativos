/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Loader2,
  Save,
  User,
  Package,
  Clock,
  ArrowRightLeft,
  CalendarDays,
  UserCog,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ItemStatus } from "@/pages/admin/types";

const NOVO_TAMANHO_OPTION = "__novo_tamanho__";
const TAMANHOS_PADRAO = ["UNICO", "PP", "P", "M", "G", "GG", "XG"];

interface HistoricoEvento {
  timestamp: string;
  matricula: string;
  nome_funcionario: string;
  item_codigo: string;
  operador_nome: string;
}

interface BuscaKitResponse {
  tipo: "kit";
  consulta: string;
  kit: {
    codigo: string;
    descricao: string;
    tamanho: string;
    status: ItemStatus;
    status_ativo: boolean;
    solicitante_matricula: string | null;
    data_emprestimo: string | null;
  };
  historico: {
    solicitacoes: HistoricoEvento[];
    devolucoes: HistoricoEvento[];
  };
}

interface BuscaFuncionarioResponse {
  tipo: "funcionario";
  consulta: string;
  funcionario: {
    matricula: string;
    nome: string;
    unidade: string;
    unidades?: string[];
    setor: string;
    setores?: string[];
    funcao: string;
    funcoes?: string[];
    status_ativo: boolean;
  };
  itens_emprestados: Array<{
    codigo: string;
    descricao: string;
    tamanho: string;
    data_emprestimo: string | null;
  }>;
  historico: {
    solicitacoes: HistoricoEvento[];
    devolucoes: HistoricoEvento[];
  };
}

interface BuscaSugestoesResponse {
  tipo: "sugestoes_funcionario";
  consulta: string;
  sugestoes: Array<{
    matricula: string;
    nome: string;
    unidade: string;
    unidades?: string[];
    setor: string;
    setores?: string[];
    funcao: string;
    funcoes?: string[];
  }>;
}

interface BuscaNaoEncontradoResponse {
  tipo: "nao_encontrado";
  consulta: string;
}

type BuscaGlobalResponse =
  | BuscaKitResponse
  | BuscaFuncionarioResponse
  | BuscaSugestoesResponse
  | BuscaNaoEncontradoResponse;

interface CatalogoRow {
  id: number;
  nome: string;
  statusAtivo: boolean;
}

interface FuncionarioEditDraft {
  nome: string;
  unidades: string[];
  unidadePrincipal: string;
  setores: string[];
  setorPrincipal: string;
  funcoes: string[];
  funcaoPrincipal: string;
  status_ativo: boolean;
}

interface KitEditDraft {
  descricao: string;
  tamanho: string;
  status: ItemStatus;
  status_ativo: boolean;
}

interface HistoricoDetalhesResponse {
  pagina: number;
  limite: number;
  total: number;
  ciclos: HistoricoCiclo[];
}

interface HistoricoCiclo {
  matricula: string;
  nome_funcionario: string;
  item_codigo: string;
  saida_em: string | null;
  saida_operador: string | null;
  entrada_em: string | null;
  entrada_operador: string | null;
  duracao_horas: number | null;
  em_aberto: boolean;
}

interface GlobalDetailContextValue {
  openByQuery: (query: string) => Promise<void>;
  openFuncionario: (matricula: string) => Promise<void>;
  openKit: (codigo: string) => Promise<void>;
}

const GlobalDetailContext = createContext<GlobalDetailContextValue | null>(null);

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function statusKitLabel(status: ItemStatus) {
  if (status === "disponivel") return "Disponivel";
  if (status === "emprestado") return "Emprestado";
  return "Inativo";
}

function statusKitTone(status: ItemStatus): "success" | "info" | "danger" {
  if (status === "disponivel") return "success";
  if (status === "emprestado") return "info";
  return "danger";
}

function formatDuracaoHoras(horas: number | null) {
  if (horas === null || Number.isNaN(horas)) return "-";
  const totalMinutos = Math.max(0, Math.round(horas * 60));
  const horasInteiras = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return `${horasInteiras}h ${minutos}m`;
}

function obterUsuarioAssociadoKit(
  kit: BuscaKitResponse["kit"],
  historico: BuscaKitResponse["historico"],
) {
  if (kit.status !== "emprestado" || !kit.solicitante_matricula) {
    return null;
  }

  const matricula = kit.solicitante_matricula.trim();
  if (!matricula) {
    return null;
  }

  const solicitacoes = historico.solicitacoes
    .filter((evento) => evento.matricula === matricula)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const nome = solicitacoes[0]?.nome_funcionario?.trim();
  return nome ? `${nome} (${matricula})` : matricula;
}

function normalizarSetoresFuncionario(setores?: string[] | null, setorPrincipal?: string | null) {
  const principal = (setorPrincipal ?? "").trim();
  const principalEhLabelComposto = principal.includes(",") && (setores?.length ?? 0) > 0;
  const candidatos = principalEhLabelComposto ? [...(setores ?? [])] : [principal, ...(setores ?? [])];
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const setor of candidatos) {
    const nome = setor.trim();
    if (!nome || vistos.has(nome)) {
      continue;
    }
    vistos.add(nome);
    resultado.push(nome);
  }

  return resultado;
}

function formatarSetoresFuncionario(setores: string[]) {
  return setores.join(", ") || "-";
}

function normalizarUnidadesFuncionario(unidades?: string[] | null, unidadePrincipal?: string | null) {
  const candidatos = [unidadePrincipal ?? "", ...(unidades ?? [])];
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const unidade of candidatos) {
    const nome = unidade.trim();
    if (!nome || vistos.has(nome)) {
      continue;
    }
    vistos.add(nome);
    resultado.push(nome);
  }

  return resultado;
}

function formatarUnidadesFuncionario(unidades: string[]) {
  return unidades.join(", ") || "-";
}

function normalizarFuncoesFuncionario(funcoes?: string[] | null, funcaoPrincipal?: string | null) {
  const candidatos = [funcaoPrincipal ?? "", ...(funcoes ?? [])];
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const funcao of candidatos) {
    const nome = funcao.trim();
    if (!nome || vistos.has(nome)) {
      continue;
    }
    vistos.add(nome);
    resultado.push(nome);
  }

  return resultado;
}

function formatarFuncoesFuncionario(funcoes: string[]) {
  return funcoes.join(", ") || "-";
}

function canEditInModal() {
  const perfil = api.getPerfil();
  return perfil === "admin" || perfil === "superadmin";
}

function normalizarTamanho(valor: string) {
  return valor.trim().toUpperCase();
}

function montarOpcoesTamanho(tamanhosExistentes: string[]) {
  const extras = [...new Set(
    tamanhosExistentes
      .map(normalizarTamanho)
      .filter(Boolean),
  )]
    .filter((tamanho) => !TAMANHOS_PADRAO.includes(tamanho))
    .sort((a, b) => a.localeCompare(b));

  return [...TAMANHOS_PADRAO, ...extras];
}

export function GlobalDetailProvider({ children }: { children: ReactNode }) {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [resultado, setResultado] = useState<BuscaGlobalResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [unidades, setUnidades] = useState<CatalogoRow[]>([]);
  const [setores, setSetores] = useState<CatalogoRow[]>([]);
  const [funcoes, setFuncoes] = useState<CatalogoRow[]>([]);
  const [draftFuncionario, setDraftFuncionario] = useState<FuncionarioEditDraft>({
    nome: "",
    unidades: [],
    unidadePrincipal: "",
    setores: [],
    setorPrincipal: "",
    funcoes: [],
    funcaoPrincipal: "",
    status_ativo: true,
  });
  const [draftKit, setDraftKit] = useState<KitEditDraft>({
    descricao: "",
    tamanho: "UNICO",
    status: "disponivel",
    status_ativo: true,
  });
  const [opcoesTamanhoKit, setOpcoesTamanhoKit] = useState<string[]>(TAMANHOS_PADRAO);
  const [criandoNovoTamanhoKit, setCriandoNovoTamanhoKit] = useState(false);
  const [novoTamanhoKit, setNovoTamanhoKit] = useState("");
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoPagina, setHistoricoPagina] = useState(1);
  const [historicoLimite] = useState(20);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  const [historicoCiclos, setHistoricoCiclos] = useState<HistoricoCiclo[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const setoresFuncionarioResultado = useMemo(() => {
    if (!resultado || resultado.tipo !== "funcionario") {
      return [];
    }

    return normalizarSetoresFuncionario(
      resultado.funcionario.setores,
      resultado.funcionario.setor,
    );
  }, [resultado]);

  const unidadesFuncionarioResultado = useMemo(() => {
    if (!resultado || resultado.tipo !== "funcionario") {
      return [];
    }

    return normalizarUnidadesFuncionario(
      resultado.funcionario.unidades,
      resultado.funcionario.unidade,
    );
  }, [resultado]);

  const funcoesFuncionarioResultado = useMemo(() => {
    if (!resultado || resultado.tipo !== "funcionario") {
      return [];
    }

    return normalizarFuncoesFuncionario(
      resultado.funcionario.funcoes,
      resultado.funcionario.funcao,
    );
  }, [resultado]);

  const hydrateDraftFromResult = useCallback((data: BuscaGlobalResponse) => {
    if (data.tipo === "funcionario") {
      const unidades = normalizarUnidadesFuncionario(data.funcionario.unidades, data.funcionario.unidade);
      const setores = normalizarSetoresFuncionario(data.funcionario.setores, data.funcionario.setor);
      const funcoes = normalizarFuncoesFuncionario(data.funcionario.funcoes, data.funcionario.funcao);
      setDraftFuncionario({
        nome: data.funcionario.nome,
        unidades,
        unidadePrincipal: unidades[0] ?? "",
        setores,
        setorPrincipal: setores[0] ?? "",
        funcoes,
        funcaoPrincipal: funcoes[0] ?? "",
        status_ativo: data.funcionario.status_ativo,
      });
    }
    if (data.tipo === "kit") {
      setDraftKit({
        descricao: data.kit.descricao,
        tamanho: data.kit.tamanho || "UNICO",
        status: data.kit.status,
        status_ativo: data.kit.status_ativo,
      });
      setCriandoNovoTamanhoKit(false);
      setNovoTamanhoKit("");
    }
  }, []);

  const ensureCatalogos = useCallback(async () => {
    if (unidades.length > 0 && setores.length > 0 && funcoes.length > 0) return;
    const [unidadesData, setoresData, funcoesData] = await Promise.all([
      api.get<CatalogoRow[]>("/admin/unidades"),
      api.get<CatalogoRow[]>("/admin/setores"),
      api.get<CatalogoRow[]>("/admin/funcoes"),
    ]);
    setUnidades(unidadesData.filter((row) => row.statusAtivo));
    setSetores(setoresData.filter((row) => row.statusAtivo));
    setFuncoes(funcoesData.filter((row) => row.statusAtivo));
  }, [unidades.length, setores.length, funcoes.length]);

  const alternarUnidadeDraft = useCallback((nomeUnidade: string, checked: boolean) => {
    setDraftFuncionario((prev) => {
      if (checked) {
        if (prev.unidades.includes(nomeUnidade)) {
          return prev;
        }
        const unidades = [...prev.unidades, nomeUnidade];
        return {
          ...prev,
          unidades,
          unidadePrincipal: prev.unidadePrincipal || nomeUnidade,
        };
      }

      const unidades = prev.unidades.filter((unidade) => unidade !== nomeUnidade);
      return {
        ...prev,
        unidades,
        unidadePrincipal: prev.unidadePrincipal === nomeUnidade ? (unidades[0] ?? "") : prev.unidadePrincipal,
      };
    });
  }, []);

  const alternarSetorDraft = useCallback((nomeSetor: string, checked: boolean) => {
    setDraftFuncionario((prev) => {
      if (checked) {
        if (prev.setores.includes(nomeSetor)) {
          return prev;
        }
        const setores = [...prev.setores, nomeSetor];
        return {
          ...prev,
          setores,
          setorPrincipal: prev.setorPrincipal || nomeSetor,
        };
      }

      const setores = prev.setores.filter((setor) => setor !== nomeSetor);
      return {
        ...prev,
        setores,
        setorPrincipal: prev.setorPrincipal === nomeSetor ? (setores[0] ?? "") : prev.setorPrincipal,
      };
    });
  }, []);

  const alternarFuncaoDraft = useCallback((nomeFuncao: string, checked: boolean) => {
    setDraftFuncionario((prev) => {
      if (checked) {
        if (prev.funcoes.includes(nomeFuncao)) {
          return prev;
        }
        const funcoes = [...prev.funcoes, nomeFuncao];
        return {
          ...prev,
          funcoes,
          funcaoPrincipal: prev.funcaoPrincipal || nomeFuncao,
        };
      }

      const funcoes = prev.funcoes.filter((funcao) => funcao !== nomeFuncao);
      return {
        ...prev,
        funcoes,
        funcaoPrincipal: prev.funcaoPrincipal === nomeFuncao ? (funcoes[0] ?? "") : prev.funcaoPrincipal,
      };
    });
  }, []);

  const ensureTamanhosKit = useCallback(async () => {
    const itens = await api.get<Array<{ tamanho: string }>>("/admin/itens?include_inactive=true");
    setOpcoesTamanhoKit(montarOpcoesTamanho(itens.map((item) => item.tamanho)));
  }, []);

  const fetchByQuery = useCallback(
    async (query: string) => {
      const normalized = query.trim();
      if (!normalized) return;

      setOpen(true);
      setLoading(true);
      setErroBusca(null);
      setEditMode(false);
      setResultado(null);

      try {
        const data = await api.get<BuscaGlobalResponse>(
          `/ops/busca-global?q=${encodeURIComponent(normalized)}`,
        );
        setLastQuery(normalized);
        setResultado(data);
        hydrateDraftFromResult(data);
      } catch (err) {
        setErroBusca(err instanceof Error ? err.message : "Falha ao realizar a busca");
      } finally {
        setLoading(false);
      }
    },
    [hydrateDraftFromResult],
  );

  const openByQuery = useCallback(
    async (query: string) => {
      await fetchByQuery(query);
    },
    [fetchByQuery],
  );

  const openFuncionario = useCallback(
    async (matricula: string) => {
      await fetchByQuery(matricula);
    },
    [fetchByQuery],
  );

  const openKit = useCallback(
    async (codigo: string) => {
      await fetchByQuery(codigo);
    },
    [fetchByQuery],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditMode(false);
    setHistoricoModalOpen(false);
  }, []);

  const handleEnableEdit = useCallback(async () => {
    if (!resultado || !canEditInModal()) return;
    if (resultado.tipo === "funcionario") {
      try {
        await ensureCatalogos();
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar catalogos");
        return;
      }
    }
    if (resultado.tipo === "kit") {
      try {
        await ensureTamanhosKit();
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar tamanhos");
        return;
      }
      setCriandoNovoTamanhoKit(false);
      setNovoTamanhoKit("");
    }
    setEditMode(true);
  }, [resultado, ensureCatalogos, ensureTamanhosKit, error]);

  const refreshCurrent = useCallback(async () => {
    if (!lastQuery) return;
    await fetchByQuery(lastQuery);
  }, [fetchByQuery, lastQuery]);

  const handleSave = useCallback(async () => {
    if (!resultado || !editMode) return;

    setSaving(true);
    try {
      let entidadeAtualizada: "funcionario" | "kit" | null = null;
      if (resultado.tipo === "funcionario") {
        if (
          !draftFuncionario.nome.trim() ||
          draftFuncionario.unidades.length === 0 ||
          !draftFuncionario.unidadePrincipal ||
          draftFuncionario.setores.length === 0 ||
          !draftFuncionario.setorPrincipal ||
          draftFuncionario.funcoes.length === 0 ||
          !draftFuncionario.funcaoPrincipal
        ) {
          error("Preencha nome, unidade principal, setor principal e funcao principal");
          return;
        }
        if (!draftFuncionario.unidades.includes(draftFuncionario.unidadePrincipal)) {
          error("Unidade principal precisa estar na lista de unidades");
          return;
        }
        if (!draftFuncionario.setores.includes(draftFuncionario.setorPrincipal)) {
          error("Setor principal precisa estar na lista de setores");
          return;
        }
        if (!draftFuncionario.funcoes.includes(draftFuncionario.funcaoPrincipal)) {
          error("Funcao principal precisa estar na lista de funcoes");
          return;
        }
        const setoresOrdenados = [
          draftFuncionario.setorPrincipal,
          ...draftFuncionario.setores.filter((setor) => setor !== draftFuncionario.setorPrincipal),
        ];
        const unidadesOrdenadas = [
          draftFuncionario.unidadePrincipal,
          ...draftFuncionario.unidades.filter((unidade) => unidade !== draftFuncionario.unidadePrincipal),
        ];
        const funcoesOrdenadas = [
          draftFuncionario.funcaoPrincipal,
          ...draftFuncionario.funcoes.filter((funcao) => funcao !== draftFuncionario.funcaoPrincipal),
        ];
        await api.put(`/admin/funcionarios/${resultado.funcionario.matricula}`, {
          nome: draftFuncionario.nome.trim(),
          unidade_principal: draftFuncionario.unidadePrincipal,
          unidade: draftFuncionario.unidadePrincipal,
          unidades: unidadesOrdenadas,
          setor_principal: draftFuncionario.setorPrincipal,
          setores: setoresOrdenados,
          funcao_principal: draftFuncionario.funcaoPrincipal,
          funcao: draftFuncionario.funcaoPrincipal,
          funcoes: funcoesOrdenadas,
          status_ativo: draftFuncionario.status_ativo,
        });
        entidadeAtualizada = "funcionario";
        success("Funcionario atualizado");
      }

      if (resultado.tipo === "kit") {
        const tamanhoFinal = criandoNovoTamanhoKit
          ? normalizarTamanho(novoTamanhoKit)
          : normalizarTamanho(draftKit.tamanho);

        if (!draftKit.descricao.trim() || !tamanhoFinal) {
          error("Informe descricao e tamanho do item");
          return;
        }
        await api.put(`/admin/itens/${resultado.kit.codigo}`, {
          descricao: draftKit.descricao.trim(),
          tamanho: tamanhoFinal,
          status: draftKit.status,
          status_ativo: draftKit.status_ativo,
        });
        setDraftKit((prev) => ({ ...prev, tamanho: tamanhoFinal }));
        entidadeAtualizada = "kit";
        success("Item atualizado");
      }

      setEditMode(false);
      await refreshCurrent();
      if (entidadeAtualizada) {
        window.dispatchEvent(
          new CustomEvent("global-detail-updated", { detail: { entidade: entidadeAtualizada } }),
        );
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar alteracoes");
    } finally {
      setSaving(false);
    }
  }, [
    resultado,
    editMode,
    draftFuncionario,
    draftKit,
    criandoNovoTamanhoKit,
    novoTamanhoKit,
    error,
    success,
    refreshCurrent,
  ]);

  const historicoTarget = useMemo(() => {
    if (!resultado) return null;
    if (resultado.tipo === "funcionario") {
      return { entidade: "funcionario" as const, id: resultado.funcionario.matricula };
    }
    if (resultado.tipo === "kit") {
      return { entidade: "kit" as const, id: resultado.kit.codigo };
    }
    return null;
  }, [resultado]);

  const carregarHistoricoDetalhado = useCallback(
    async (pagina: number) => {
      if (!historicoTarget) return;
      setHistoricoLoading(true);
      try {
        const payload = await api.get<HistoricoDetalhesResponse>(
          `/ops/historico-detalhes?entidade=${historicoTarget.entidade}&id=${encodeURIComponent(historicoTarget.id)}&pagina=${pagina}&limite=${historicoLimite}`,
        );
        setHistoricoCiclos(payload.ciclos);
        setHistoricoTotal(payload.total);
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar historico detalhado");
      } finally {
        setHistoricoLoading(false);
      }
    },
    [historicoTarget, historicoLimite, error],
  );

  const abrirHistoricoDetalhado = useCallback(async () => {
    setHistoricoPagina(1);
    setHistoricoModalOpen(true);
  }, []);

  useEffect(() => {
    if (!historicoModalOpen) return;
    void carregarHistoricoDetalhado(historicoPagina);
  }, [historicoModalOpen, historicoPagina, carregarHistoricoDetalhado]);

  useEffect(() => {
    setHistoricoModalOpen(false);
    setHistoricoCiclos([]);
    setHistoricoTotal(0);
    setHistoricoPagina(1);
  }, [resultado]);

  const contextValue = useMemo<GlobalDetailContextValue>(
    () => ({
      openByQuery,
      openFuncionario,
      openKit,
    }),
    [openByQuery, openFuncionario, openKit],
  );

  // --- Modal title, description, icon based on result type ---
  const modalTitle = resultado?.tipo === "funcionario"
    ? resultado.funcionario.nome
    : resultado?.tipo === "kit"
      ? `Kit ${resultado.kit.codigo}`
      : "Detalhes";

  const modalDescription = resultado?.tipo === "funcionario"
    ? `Matricula ${resultado.funcionario.matricula}`
    : resultado?.tipo === "kit"
      ? `${resultado.kit.descricao} | Tam: ${resultado.kit.tamanho}`
      : undefined;

  const modalIcon = resultado?.tipo === "funcionario"
    ? User
    : resultado?.tipo === "kit"
      ? Package
      : undefined;
  const detailModalMaxWidth = resultado?.tipo === "funcionario" ? "max-w-3xl" : "max-w-2xl";
  const kitUsuarioAssociado = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit") {
      return null;
    }

    return obterUsuarioAssociadoKit(resultado.kit, resultado.historico);
  }, [resultado]);
  const kitEmprestado = resultado?.tipo === "kit" && resultado.kit.status === "emprestado";

  // --- Footer content for action buttons ---
  let footerContent: ReactNode = null;
  if (!loading && !erroBusca && resultado && (resultado.tipo === "funcionario" || resultado.tipo === "kit") && canEditInModal()) {
    if (!editMode) {
      footerContent = (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => void handleEnableEdit()}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      );
    } else {
      footerContent = (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      );
    }
  }

  return (
    <GlobalDetailContext.Provider value={contextValue}>
      {children}
      <Modal
        open={open}
        title={modalTitle}
        description={modalDescription}
        icon={modalIcon}
        maxWidthClassName={detailModalMaxWidth}
        onClose={handleClose}
        footer={footerContent}
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando informacoes...
          </div>
        )}

        {!loading && erroBusca && (
          <div className="rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroBusca}
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "nao_encontrado" && (
          <div className="rounded-lg bg-muted/30 py-3 text-center text-sm text-muted-foreground">
            Nenhum kit, usuario ou matricula encontrado para: <strong>{resultado.consulta}</strong>.
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "sugestoes_funcionario" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Foram encontrados varios usuarios para <strong>{resultado.consulta}</strong>. Selecione um:
            </p>
            <div className="space-y-1.5">
              {resultado.sugestoes.map((sugestao) => (
                <button
                  key={sugestao.matricula}
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-lg border border-border/50 bg-surface-1 px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:bg-accent/40"
                  onClick={() => {
                    void openFuncionario(sugestao.matricula);
                  }}
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{sugestao.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      Matricula {sugestao.matricula} | {formatarSetoresFuncionario(
                        normalizarSetoresFuncionario(sugestao.setores, sugestao.setor),
                      )} | {formatarUnidadesFuncionario(
                        normalizarUnidadesFuncionario(sugestao.unidades, sugestao.unidade),
                      )} | {formatarFuncoesFuncionario(
                        normalizarFuncoesFuncionario(sugestao.funcoes, sugestao.funcao),
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "kit" && (
          <div className="space-y-4">
            {!editMode ? (
              <div className="rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={statusKitTone(resultado.kit.status)}>
                    {statusKitLabel(resultado.kit.status)}
                  </StatusPill>
                  {!resultado.kit.status_ativo && (
                    <StatusPill tone="danger">Inativo no cadastro</StatusPill>
                  )}
                </div>
                <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <Package className="h-3.5 w-3.5 text-primary/70" />
                      Tamanho
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">{resultado.kit.tamanho}</p>
                  </div>
                  {kitEmprestado ? (
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <User className="h-3.5 w-3.5 text-primary/70" />
                        Usuario associado
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{kitUsuarioAssociado ?? "-"}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/55 p-3">
                      <p className="text-sm font-medium text-foreground">Item livre</p>
                      <p className="mt-1 text-xs text-muted-foreground">Sem usuario associado no momento.</p>
                    </div>
                  )}
                  {kitEmprestado && (
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                        Emprestimo
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatDateTime(resultado.kit.data_emprestimo)}
                      </p>
                    </div>
                  )}
                  {!kitEmprestado && resultado.kit.data_emprestimo && (
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                        Ultimo emprestimo registrado
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatDateTime(resultado.kit.data_emprestimo)}
                      </p>
                    </div>
                  )}
                  {!kitEmprestado && !resultado.kit.data_emprestimo && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/55 p-3 sm:col-span-2">
                      <p className="text-sm font-medium text-foreground">Disponivel para emprestimo</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ainda sem registro de emprestimo em aberto.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-descricao">Descricao</Label>
                  <Input
                    id="detalhe-kit-descricao"
                    value={draftKit.descricao}
                    onChange={(event) =>
                      setDraftKit((prev) => ({ ...prev, descricao: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-tamanho-select">Tamanho</Label>
                  <Select
                    value={criandoNovoTamanhoKit ? NOVO_TAMANHO_OPTION : draftKit.tamanho}
                    onValueChange={(value) => {
                      if (value === NOVO_TAMANHO_OPTION) {
                        setCriandoNovoTamanhoKit(true);
                        setNovoTamanhoKit("");
                        return;
                      }
                      setCriandoNovoTamanhoKit(false);
                      setDraftKit((prev) => ({ ...prev, tamanho: value }));
                    }}
                  >
                    <SelectTrigger id="detalhe-kit-tamanho-select">
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesTamanhoKit.map((tamanho) => (
                        <SelectItem key={tamanho} value={tamanho}>
                          {tamanho}
                        </SelectItem>
                      ))}
                      <SelectItem value={NOVO_TAMANHO_OPTION}>Criar novo tamanho...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {criandoNovoTamanhoKit && (
                  <div className="space-y-1">
                    <Label htmlFor="detalhe-kit-tamanho-novo">Novo tamanho</Label>
                    <Input
                      id="detalhe-kit-tamanho-novo"
                      value={novoTamanhoKit}
                      onChange={(event) => setNovoTamanhoKit(event.target.value.toUpperCase())}
                      maxLength={20}
                      placeholder="Ex.: EXG"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-status">Status</Label>
                  <Select
                    value={draftKit.status}
                    onValueChange={(value) =>
                      setDraftKit((prev) => ({ ...prev, status: value as ItemStatus }))
                    }
                  >
                    <SelectTrigger id="detalhe-kit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">disponivel</SelectItem>
                      <SelectItem value="emprestado">emprestado</SelectItem>
                      <SelectItem value="inativo">inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={draftKit.status_ativo}
                    onCheckedChange={(checked) =>
                      setDraftKit((prev) => ({ ...prev, status_ativo: Boolean(checked) }))
                    }
                  />
                  Ativo
                </label>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void abrirHistoricoDetalhado();
                }}
              >
                Ver historico completo
              </Button>
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "funcionario" && (
          <div className="space-y-4">
            {!editMode ? (
              <div className="rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={resultado.funcionario.status_ativo ? "success" : "danger"}>
                    {resultado.funcionario.status_ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </div>
                <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <User className="h-3.5 w-3.5 text-primary/70" />
                      Matricula
                    </div>
                    <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                      {resultado.funcionario.matricula}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary/70" />
                      Unidades
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatarUnidadesFuncionario(unidadesFuncionarioResultado)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <UserCog className="h-3.5 w-3.5 text-primary/70" />
                      Funcoes
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatarFuncoesFuncionario(funcoesFuncionarioResultado)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 sm:col-span-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary/70" />
                      Setores
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatarSetoresFuncionario(setoresFuncionarioResultado)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
                <div className="space-y-1">
                  <Label htmlFor="detalhe-func-nome">Nome</Label>
                  <Input
                    id="detalhe-func-nome"
                    value={draftFuncionario.nome}
                    onChange={(event) =>
                      setDraftFuncionario((prev) => ({ ...prev, nome: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Unidades</Label>
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background p-3">
                      {unidades.map((unidade) => (
                        <label key={unidade.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={draftFuncionario.unidades.includes(unidade.nome)}
                            onCheckedChange={(checked) =>
                              alternarUnidadeDraft(unidade.nome, Boolean(checked))
                            }
                          />
                          <span>{unidade.nome}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecionadas: {draftFuncionario.unidades.length}
                    </p>
                    <Select
                      value={draftFuncionario.unidadePrincipal}
                      onValueChange={(value) =>
                        setDraftFuncionario((prev) => ({ ...prev, unidadePrincipal: value }))
                      }
                      disabled={draftFuncionario.unidades.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftFuncionario.unidades.map((unidadeNome) => (
                          <SelectItem key={unidadeNome} value={unidadeNome}>
                            {unidadeNome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Setores</Label>
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background p-3">
                      {setores.map((setor) => (
                        <label key={setor.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={draftFuncionario.setores.includes(setor.nome)}
                            onCheckedChange={(checked) =>
                              alternarSetorDraft(setor.nome, Boolean(checked))
                            }
                          />
                          <span>{setor.nome}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecionados: {draftFuncionario.setores.length}
                    </p>
                    <Select
                      value={draftFuncionario.setorPrincipal}
                      onValueChange={(value) =>
                        setDraftFuncionario((prev) => ({ ...prev, setorPrincipal: value }))
                      }
                      disabled={draftFuncionario.setores.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftFuncionario.setores.map((setorNome) => (
                          <SelectItem key={setorNome} value={setorNome}>
                            {setorNome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Funcoes</Label>
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background p-3">
                      {funcoes.map((funcao) => (
                        <label key={funcao.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={draftFuncionario.funcoes.includes(funcao.nome)}
                            onCheckedChange={(checked) =>
                              alternarFuncaoDraft(funcao.nome, Boolean(checked))
                            }
                          />
                          <span>{funcao.nome}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecionadas: {draftFuncionario.funcoes.length}
                    </p>
                    <Select
                      value={draftFuncionario.funcaoPrincipal}
                      onValueChange={(value) =>
                        setDraftFuncionario((prev) => ({ ...prev, funcaoPrincipal: value }))
                      }
                      disabled={draftFuncionario.funcoes.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a funcao principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftFuncionario.funcoes.map((funcaoNome) => (
                          <SelectItem key={funcaoNome} value={funcaoNome}>
                            {funcaoNome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={draftFuncionario.status_ativo}
                    onCheckedChange={(checked) =>
                      setDraftFuncionario((prev) => ({ ...prev, status_ativo: Boolean(checked) }))
                    }
                  />
                  Ativo
                </label>
              </div>
            )}

            {/* Kits em uso */}
            <div className="space-y-2.5 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Package className="h-4 w-4 text-primary" />
                Kits em uso
                {resultado.itens_emprestados.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {resultado.itens_emprestados.length} ite{resultado.itens_emprestados.length === 1 ? "m" : "ns"}
                  </span>
                )}
              </div>
              {resultado.itens_emprestados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/55 py-3 text-center text-sm text-muted-foreground">
                  Nenhum kit emprestado no momento.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {resultado.itens_emprestados.map((item) => (
                    <button
                      key={item.codigo}
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/55 bg-background/70 px-3 py-2.5 text-left text-sm transition-all hover:border-primary/30 hover:bg-accent/40 hover:shadow-sm"
                      onClick={() => {
                        void openKit(item.codigo);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-semibold text-primary">{item.codigo}</div>
                        <div className="truncate text-foreground">{item.descricao}</div>
                        <div className="text-xs text-muted-foreground">Tamanho: {item.tamanho}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {formatDateTime(item.data_emprestimo)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void abrirHistoricoDetalhado();
                }}
              >
                Ver historico completo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Historico completo modal */}
      <Modal
        open={historicoModalOpen}
        title="Historico completo"
        description="Todos os ciclos de saida e entrada"
        icon={Clock}
        onClose={() => setHistoricoModalOpen(false)}
        footer={
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {historicoTotal === 0
                ? "0 ciclos"
                : `${(historicoPagina - 1) * historicoLimite + 1}-${Math.min(historicoPagina * historicoLimite, historicoTotal)} de ${historicoTotal}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoricoPagina((prev) => Math.max(1, prev - 1))}
                disabled={historicoPagina === 1 || historicoLoading}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setHistoricoPagina((prev) =>
                    prev * historicoLimite >= historicoTotal ? prev : prev + 1,
                  )
                }
                disabled={historicoPagina * historicoLimite >= historicoTotal || historicoLoading}
              >
                Proxima
              </Button>
            </div>
          </div>
        }
      >
        {historicoLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando historico...
          </div>
        ) : historicoCiclos.length === 0 ? (
          <p className="rounded-lg bg-muted/30 py-3 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado.
          </p>
        ) : (
          <HistoricoCiclosSection ciclos={historicoCiclos} />
        )}
      </Modal>
    </GlobalDetailContext.Provider>
  );
}

function HistoricoCiclosSection({ ciclos }: { ciclos: HistoricoCiclo[] }) {
  return (
    <div className="space-y-2">
      {ciclos.length === 0 ? (
        <p className="rounded-lg bg-muted/30 py-3 text-center text-sm text-muted-foreground">
          Nenhum registro.
        </p>
      ) : (
        <div className="space-y-2">
          {ciclos.map((ciclo, index) => (
            <div
              key={`ciclo-${ciclo.item_codigo}-${ciclo.matricula}-${ciclo.saida_em ?? "sem-saida"}-${index}`}
              className={cn(
                "rounded-lg border-l-[3px] bg-surface-1 px-3 py-2.5 text-sm",
                ciclo.em_aberto
                  ? "border-l-warning"
                  : "border-l-success",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-primary">{ciclo.item_codigo}</span>
                  <span className="text-foreground">{ciclo.nome_funcionario}</span>
                  <span className="text-muted-foreground">({ciclo.matricula})</span>
                </div>
                <StatusPill tone={ciclo.em_aberto ? "warning" : "success"}>
                  {ciclo.em_aberto ? "Em aberto" : "Concluido"}
                </StatusPill>
              </div>
              <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3 w-3 text-primary/60" />
                  Saida: {formatDateTime(ciclo.saida_em)}
                  <span className="text-muted-foreground/70">({ciclo.saida_operador ?? "-"})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3 w-3 rotate-180 text-primary/60" />
                  Entrada: {formatDateTime(ciclo.entrada_em)}
                  <span className="text-muted-foreground/70">({ciclo.entrada_operador ?? "-"})</span>
                </div>
                <div className="flex items-center gap-1.5 sm:col-span-2">
                  <Clock className="h-3 w-3 text-primary/60" />
                  Tempo com kit: <span className="font-medium text-foreground">{formatDuracaoHoras(ciclo.duracao_horas)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useGlobalDetail() {
  const context = useContext(GlobalDetailContext);
  if (!context) {
    throw new Error("useGlobalDetail must be used within GlobalDetailProvider");
  }
  return context;
}
