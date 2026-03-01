/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Loader2,
  Save,
  User,
  Package,
  Clock,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  Building2,
  UserCog,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Pencil,
  X,
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
const NOVO_TIPO_OPTION = "__novo_tipo__";
const TAMANHOS_PADRAO = ["UNICO", "PP", "P", "M", "G", "GG", "XG"];
const TIPOS_PADRAO = ["Kit roupa", "Lencol", "Sem tipo"];
const CATALOGO_ITENS_POR_PAGINA = 5;

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
    descricao: string | null;
    tipo: string;
    tamanho: string;
    status: ItemStatus;
    status_ativo: boolean;
    solicitante_matricula: string | null;
    setor_solicitante: string | null;
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
    descricao: string | null;
    tipo: string;
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

interface ResultadoGlobalFuncionario {
  matricula: string;
  nome: string;
  unidade: string;
  unidades?: string[];
  setor: string;
  setores?: string[];
  funcao: string;
  funcoes?: string[];
  status_ativo: boolean;
}

interface ResultadoGlobalKit {
  codigo: string;
  descricao: string | null;
  tipo: string;
  tamanho: string;
  status: ItemStatus;
  status_ativo: boolean;
  solicitante_matricula: string | null;
  setor_solicitante: string | null;
}

interface ResultadoGlobalSetor {
  id: number;
  nome: string;
  status_ativo: boolean;
  total_unidades: number;
  total_funcionarios: number;
}

interface ResultadoGlobalUnidade {
  id: number;
  nome: string;
  status_ativo: boolean;
  total_setores: number;
  total_funcionarios: number;
}

interface ResultadoGlobalFuncao {
  id: number;
  nome: string;
  status_ativo: boolean;
  total_funcionarios: number;
}

interface BuscaResultadosGlobaisResponse {
  tipo: "resultados_globais";
  consulta: string;
  resultados: {
    funcionarios: ResultadoGlobalFuncionario[];
    kits: ResultadoGlobalKit[];
    setores: ResultadoGlobalSetor[];
    unidades: ResultadoGlobalUnidade[];
    funcoes: ResultadoGlobalFuncao[];
  };
}

interface BuscaSetorResponse {
  tipo: "setor";
  consulta: string;
  setor: ResultadoGlobalSetor;
  funcionarios_relacionados: ResultadoGlobalFuncionario[];
}

interface BuscaUnidadeResponse {
  tipo: "unidade";
  consulta: string;
  unidade: ResultadoGlobalUnidade;
  funcionarios_relacionados: ResultadoGlobalFuncionario[];
}

interface BuscaFuncaoResponse {
  tipo: "funcao";
  consulta: string;
  funcao: ResultadoGlobalFuncao;
  funcionarios_relacionados: ResultadoGlobalFuncionario[];
}

type BuscaGlobalResponse =
  | BuscaKitResponse
  | BuscaFuncionarioResponse
  | BuscaSugestoesResponse
  | BuscaResultadosGlobaisResponse
  | BuscaSetorResponse
  | BuscaUnidadeResponse
  | BuscaFuncaoResponse
  | BuscaNaoEncontradoResponse;

interface CatalogoRow {
  id: number;
  nome: string;
  statusAtivo: boolean;
  unidades?: string[];
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
  codigo: string;
  descricao: string;
  tipo: string;
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
  openSetor: (nome: string) => Promise<void>;
  openUnidade: (nome: string) => Promise<void>;
  openFuncao: (nome: string) => Promise<void>;
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

function descricaoItemLabel(descricao: string | null | undefined) {
  const normalized = (descricao ?? "").trim();
  return normalized;
}

function formatDuracaoHoras(horas: number | null) {
  if (horas === null || Number.isNaN(horas)) return "-";
  const totalMinutos = Math.max(0, Math.round(horas * 60));
  const minutosPorDia = 24 * 60;
  const dias = Math.floor(totalMinutos / minutosPorDia);
  const horasInteiras = Math.floor((totalMinutos % minutosPorDia) / 60);
  const minutos = totalMinutos % 60;

  if (dias > 0) return `${dias}d ${horasInteiras}h ${minutos}m`;
  if (horasInteiras > 0) return `${horasInteiras}h ${minutos}m`;
  return `${minutos}m`;
}

function normalizarTipo(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
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

function formatarUsuarioHistorico(evento: HistoricoEvento | null | undefined) {
  if (!evento) return null;
  const matricula = evento.matricula.trim();
  const nome = evento.nome_funcionario.trim();
  if (nome && matricula) return `${nome} (${matricula})`;
  if (nome) return nome;
  if (matricula) return matricula;
  return null;
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

function setorCompativelComUnidadesCatalogo(setor: CatalogoRow, unidadesSelecionadas: string[]) {
  if (unidadesSelecionadas.length === 0) {
    return true;
  }
  const unidadesSetor = setor.unidades?.filter(Boolean) ?? [];
  if (unidadesSetor.length === 0) {
    return true;
  }
  return unidadesSelecionadas.some((unidade) => unidadesSetor.includes(unidade));
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

function normalizarChaveBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function filtrarFuncionariosRelacionadosPorSetor(
  funcionarios: ResultadoGlobalFuncionario[],
  setorNome: string,
) {
  const alvo = normalizarChaveBusca(setorNome);
  return funcionarios.filter((funcionario) => {
    const setoresFuncionario = normalizarSetoresFuncionario(funcionario.setores, funcionario.setor);
    return setoresFuncionario.some((setor) => normalizarChaveBusca(setor) === alvo);
  });
}

function filtrarFuncionariosRelacionadosPorUnidade(
  funcionarios: ResultadoGlobalFuncionario[],
  unidadeNome: string,
) {
  const alvo = normalizarChaveBusca(unidadeNome);
  return funcionarios.filter((funcionario) => {
    const unidadesFuncionario = normalizarUnidadesFuncionario(funcionario.unidades, funcionario.unidade);
    return unidadesFuncionario.some((unidade) => normalizarChaveBusca(unidade) === alvo);
  });
}

function filtrarFuncionariosRelacionadosPorFuncao(
  funcionarios: ResultadoGlobalFuncionario[],
  funcaoNome: string,
) {
  const alvo = normalizarChaveBusca(funcaoNome);
  return funcionarios.filter((funcionario) => {
    const funcoesFuncionario = normalizarFuncoesFuncionario(funcionario.funcoes, funcionario.funcao);
    return funcoesFuncionario.some((funcao) => normalizarChaveBusca(funcao) === alvo);
  });
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

function montarOpcoesTipo(tiposExistentes: string[]) {
  const extras = [...new Set(
    tiposExistentes
      .map(normalizarTipo)
      .filter(Boolean),
  )]
    .filter((tipo) => !TIPOS_PADRAO.includes(tipo))
    .sort((a, b) => a.localeCompare(b));

  return [...TIPOS_PADRAO, ...extras];
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
    codigo: "",
    descricao: "",
    tipo: TIPOS_PADRAO[0],
    tamanho: "UNICO",
    status: "disponivel",
    status_ativo: true,
  });
  const [opcoesTipoKit, setOpcoesTipoKit] = useState<string[]>(TIPOS_PADRAO);
  const [opcoesTamanhoKit, setOpcoesTamanhoKit] = useState<string[]>(TAMANHOS_PADRAO);
  const [criandoNovoTipoKit, setCriandoNovoTipoKit] = useState(false);
  const [novoTipoKit, setNovoTipoKit] = useState("");
  const [tipoKitEditando, setTipoKitEditando] = useState<string | null>(null);
  const [criandoNovoTamanhoKit, setCriandoNovoTamanhoKit] = useState(false);
  const [novoTamanhoKit, setNovoTamanhoKit] = useState("");
  const [ordemUnidadesCatalogo, setOrdemUnidadesCatalogo] = useState<"asc" | "desc">("asc");
  const [ordemSetoresCatalogo, setOrdemSetoresCatalogo] = useState<"asc" | "desc">("asc");
  const [ordemFuncoesCatalogo, setOrdemFuncoesCatalogo] = useState<"asc" | "desc">("asc");
  const [paginaUnidadesCatalogo, setPaginaUnidadesCatalogo] = useState(1);
  const [paginaSetoresCatalogo, setPaginaSetoresCatalogo] = useState(1);
  const [paginaFuncoesCatalogo, setPaginaFuncoesCatalogo] = useState(1);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoPagina, setHistoricoPagina] = useState(1);
  const [historicoLimite] = useState(3);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  const [historicoCiclos, setHistoricoCiclos] = useState<HistoricoCiclo[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const setorByNome = useMemo(
    () => new Map(setores.map((setor) => [setor.nome, setor] as const)),
    [setores],
  );
  const setoresDisponiveisDraft = useMemo(() => {
    if (draftFuncionario.unidades.length === 0) {
      return setores;
    }
    return setores.filter((setor) =>
      setorCompativelComUnidadesCatalogo(setor, draftFuncionario.unidades),
    );
  }, [setores, draftFuncionario.unidades]);

  const setorCompativelPorNomeDraft = useCallback((nomeSetor: string, unidadesSelecionadas: string[]) => {
    const setor = setorByNome.get(nomeSetor);
    if (!setor) {
      return false;
    }
    return setorCompativelComUnidadesCatalogo(setor, unidadesSelecionadas);
  }, [setorByNome]);
  const unidadesCatalogoOrdenadas = useMemo(() => {
    const lista = [...unidades].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
    return ordemUnidadesCatalogo === "asc" ? lista : lista.reverse();
  }, [ordemUnidadesCatalogo, unidades]);
  const setoresCatalogoOrdenados = useMemo(() => {
    const lista = [...setores].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
    return ordemSetoresCatalogo === "asc" ? lista : lista.reverse();
  }, [ordemSetoresCatalogo, setores]);
  const funcoesCatalogoOrdenadas = useMemo(() => {
    const lista = [...funcoes].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
    return ordemFuncoesCatalogo === "asc" ? lista : lista.reverse();
  }, [funcoes, ordemFuncoesCatalogo]);
  const totalPaginasUnidadesCatalogo = Math.max(
    1,
    Math.ceil(unidadesCatalogoOrdenadas.length / CATALOGO_ITENS_POR_PAGINA),
  );
  const totalPaginasSetoresCatalogo = Math.max(
    1,
    Math.ceil(setoresCatalogoOrdenados.length / CATALOGO_ITENS_POR_PAGINA),
  );
  const totalPaginasFuncoesCatalogo = Math.max(
    1,
    Math.ceil(funcoesCatalogoOrdenadas.length / CATALOGO_ITENS_POR_PAGINA),
  );
  const unidadesCatalogoPaginadas = useMemo(() => {
    const inicio = (paginaUnidadesCatalogo - 1) * CATALOGO_ITENS_POR_PAGINA;
    return unidadesCatalogoOrdenadas.slice(inicio, inicio + CATALOGO_ITENS_POR_PAGINA);
  }, [paginaUnidadesCatalogo, unidadesCatalogoOrdenadas]);
  const setoresCatalogoPaginados = useMemo(() => {
    const inicio = (paginaSetoresCatalogo - 1) * CATALOGO_ITENS_POR_PAGINA;
    return setoresCatalogoOrdenados.slice(inicio, inicio + CATALOGO_ITENS_POR_PAGINA);
  }, [paginaSetoresCatalogo, setoresCatalogoOrdenados]);
  const funcoesCatalogoPaginadas = useMemo(() => {
    const inicio = (paginaFuncoesCatalogo - 1) * CATALOGO_ITENS_POR_PAGINA;
    return funcoesCatalogoOrdenadas.slice(inicio, inicio + CATALOGO_ITENS_POR_PAGINA);
  }, [funcoesCatalogoOrdenadas, paginaFuncoesCatalogo]);

  useEffect(() => {
    if (paginaUnidadesCatalogo > totalPaginasUnidadesCatalogo) {
      setPaginaUnidadesCatalogo(totalPaginasUnidadesCatalogo);
    }
  }, [paginaUnidadesCatalogo, totalPaginasUnidadesCatalogo]);

  useEffect(() => {
    if (paginaSetoresCatalogo > totalPaginasSetoresCatalogo) {
      setPaginaSetoresCatalogo(totalPaginasSetoresCatalogo);
    }
  }, [paginaSetoresCatalogo, totalPaginasSetoresCatalogo]);

  useEffect(() => {
    if (paginaFuncoesCatalogo > totalPaginasFuncoesCatalogo) {
      setPaginaFuncoesCatalogo(totalPaginasFuncoesCatalogo);
    }
  }, [paginaFuncoesCatalogo, totalPaginasFuncoesCatalogo]);

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
        codigo: data.kit.codigo,
        descricao: data.kit.descricao ?? "",
        tipo: data.kit.tipo || TIPOS_PADRAO[0],
        tamanho: data.kit.tamanho || "UNICO",
        status: data.kit.status,
        status_ativo: data.kit.status_ativo,
      });
      setCriandoNovoTipoKit(false);
      setNovoTipoKit("");
      setTipoKitEditando(null);
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
        if (!setorCompativelPorNomeDraft(nomeSetor, prev.unidades)) {
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
  }, [setorCompativelPorNomeDraft]);

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

  useEffect(() => {
    if (!editMode || setores.length === 0) {
      return;
    }

    const setoresDisponiveis = new Set(setoresDisponiveisDraft.map((setor) => setor.nome));
    setDraftFuncionario((prev) => {
      const setoresCompativeis = prev.setores.filter((setorNome) => setoresDisponiveis.has(setorNome));
      const setorPrincipalCompativel = setoresCompativeis.includes(prev.setorPrincipal)
        ? prev.setorPrincipal
        : (setoresCompativeis[0] ?? "");

      if (
        setoresCompativeis.length === prev.setores.length &&
        setorPrincipalCompativel === prev.setorPrincipal
      ) {
        return prev;
      }

      return {
        ...prev,
        setores: setoresCompativeis,
        setorPrincipal: setorPrincipalCompativel,
      };
    });
  }, [editMode, setores.length, setoresDisponiveisDraft]);

  const ensureTamanhosKit = useCallback(async () => {
    const itens = await api.get<Array<{ tipo: string; tamanho: string }>>("/admin/itens?include_inactive=true");
    setOpcoesTipoKit(montarOpcoesTipo(itens.map((item) => item.tipo)));
    setOpcoesTamanhoKit(montarOpcoesTamanho(itens.map((item) => item.tamanho)));
  }, []);

  const resolverResultadoFocado = useCallback(
    (
      data: BuscaGlobalResponse,
      foco: "setor" | "unidade" | "funcao",
      termoBusca: string,
    ): BuscaGlobalResponse => {
      if (data.tipo !== "resultados_globais") {
        return data;
      }

      const termoNormalizado = normalizarChaveBusca(termoBusca);

      if (foco === "setor") {
        const setor =
          data.resultados.setores.find((item) => normalizarChaveBusca(item.nome) === termoNormalizado) ??
          data.resultados.setores[0];

        if (!setor) {
          return data;
        }

        return {
          tipo: "setor",
          consulta: setor.nome,
          setor,
          funcionarios_relacionados: filtrarFuncionariosRelacionadosPorSetor(
            data.resultados.funcionarios,
            setor.nome,
          ),
        };
      }

      if (foco === "unidade") {
        const unidade =
          data.resultados.unidades.find((item) => normalizarChaveBusca(item.nome) === termoNormalizado) ??
          data.resultados.unidades[0];

        if (!unidade) {
          return data;
        }

        return {
          tipo: "unidade",
          consulta: unidade.nome,
          unidade,
          funcionarios_relacionados: filtrarFuncionariosRelacionadosPorUnidade(
            data.resultados.funcionarios,
            unidade.nome,
          ),
        };
      }

      const funcao =
        data.resultados.funcoes.find((item) => normalizarChaveBusca(item.nome) === termoNormalizado) ??
        data.resultados.funcoes[0];

      if (!funcao) {
        return data;
      }

      return {
        tipo: "funcao",
        consulta: funcao.nome,
        funcao,
        funcionarios_relacionados: filtrarFuncionariosRelacionadosPorFuncao(
          data.resultados.funcionarios,
          funcao.nome,
        ),
      };
    },
    [],
  );

  const fetchByQuery = useCallback(
    async (
      query: string,
      options?: {
        foco?: "setor" | "unidade" | "funcao";
      },
    ) => {
      const normalized = query.trim();
      if (!normalized) return;

      setOpen(true);
      setLoading(true);
      setErroBusca(null);
      setEditMode(false);
      setResultado(null);

      try {
        const data = await api.get<BuscaGlobalResponse>(
          `/ops/busca-global?q=${encodeURIComponent(normalized)}&modo=global`,
        );
        const dataFinal = options?.foco
          ? resolverResultadoFocado(data, options.foco, normalized)
          : data;
        setLastQuery(normalized);
        setResultado(dataFinal);
        hydrateDraftFromResult(dataFinal);
      } catch (err) {
        setErroBusca(err instanceof Error ? err.message : "Falha ao realizar a busca");
      } finally {
        setLoading(false);
      }
    },
    [hydrateDraftFromResult, resolverResultadoFocado],
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

  const openSetor = useCallback(
    async (nome: string) => {
      await fetchByQuery(nome, { foco: "setor" });
    },
    [fetchByQuery],
  );

  const openUnidade = useCallback(
    async (nome: string) => {
      await fetchByQuery(nome, { foco: "unidade" });
    },
    [fetchByQuery],
  );

  const openFuncao = useCallback(
    async (nome: string) => {
      await fetchByQuery(nome, { foco: "funcao" });
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
      setPaginaUnidadesCatalogo(1);
      setPaginaSetoresCatalogo(1);
      setPaginaFuncoesCatalogo(1);
    }
    if (resultado.tipo === "kit") {
      try {
        await ensureTamanhosKit();
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar tamanhos");
        return;
      }
      setCriandoNovoTipoKit(false);
      setNovoTipoKit("");
      setTipoKitEditando(null);
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
        const setoresIncompativeis = draftFuncionario.setores.filter(
          (setor) => !setorCompativelPorNomeDraft(setor, draftFuncionario.unidades),
        );
        if (setoresIncompativeis.length > 0) {
          error(`Setores sem vinculo com as unidades selecionadas: ${setoresIncompativeis.join(", ")}`);
          return;
        }
        if (!setorCompativelPorNomeDraft(draftFuncionario.setorPrincipal, [draftFuncionario.unidadePrincipal])) {
          error("Setor principal precisa estar vinculado a unidade principal");
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
        const codigoFinal = draftKit.codigo.trim();
        const tipoFinal = criandoNovoTipoKit
          ? normalizarTipo(novoTipoKit)
          : normalizarTipo(draftKit.tipo);
        const tipoEditandoNormalizado = tipoKitEditando ? normalizarTipo(tipoKitEditando) : null;
        const tamanhoFinal = criandoNovoTamanhoKit
          ? normalizarTamanho(novoTamanhoKit)
          : normalizarTamanho(draftKit.tamanho);
        const descricaoFinal = draftKit.descricao.trim() || null;

        if (!codigoFinal || !tipoFinal || !tamanhoFinal) {
          error("Informe codigo, tipo e tamanho do item");
          return;
        }
        await api.put(`/admin/itens/${encodeURIComponent(resultado.kit.codigo)}`, {
          codigo: codigoFinal,
          descricao: descricaoFinal,
          tipo: tipoFinal,
          tamanho: tamanhoFinal,
          status: draftKit.status,
          status_ativo: draftKit.status_ativo,
        });
        setOpcoesTipoKit((prev) => {
          const semTipoEditando = tipoEditandoNormalizado
            ? prev.filter(
              (tipo) =>
                normalizarTipo(tipo).toLowerCase() !== tipoEditandoNormalizado.toLowerCase(),
            )
            : prev;
          return montarOpcoesTipo([...semTipoEditando, tipoFinal]);
        });
        setCriandoNovoTipoKit(false);
        setNovoTipoKit("");
        setTipoKitEditando(null);
        setDraftKit((prev) => ({ ...prev, codigo: codigoFinal, tipo: tipoFinal, tamanho: tamanhoFinal }));
        entidadeAtualizada = "kit";
        success("Item atualizado");
      }

      setEditMode(false);
      if (resultado.tipo === "kit") {
        const codigoFinal = draftKit.codigo.trim();
        if (codigoFinal && codigoFinal !== resultado.kit.codigo) {
          await fetchByQuery(codigoFinal);
        } else {
          await refreshCurrent();
        }
      } else {
        await refreshCurrent();
      }
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
    criandoNovoTipoKit,
    novoTipoKit,
    tipoKitEditando,
    criandoNovoTamanhoKit,
    novoTamanhoKit,
    error,
    success,
    refreshCurrent,
    fetchByQuery,
    setorCompativelPorNomeDraft,
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
      openSetor,
      openUnidade,
      openFuncao,
    }),
    [openByQuery, openFuncionario, openKit, openSetor, openUnidade, openFuncao],
  );

  const totalResultadosGlobais = useMemo(() => {
    if (!resultado || resultado.tipo !== "resultados_globais") {
      return 0;
    }

    return (
      resultado.resultados.funcionarios.length +
      resultado.resultados.kits.length +
      resultado.resultados.setores.length +
      resultado.resultados.unidades.length +
      resultado.resultados.funcoes.length
    );
  }, [resultado]);

  // --- Modal title, description, icon based on result type ---
  const modalTitle = resultado?.tipo === "funcionario"
    ? resultado.funcionario.nome
    : resultado?.tipo === "kit"
      ? `Kit ${resultado.kit.codigo}`
      : resultado?.tipo === "setor"
        ? `Setor ${resultado.setor.nome}`
        : resultado?.tipo === "unidade"
          ? `Unidade ${resultado.unidade.nome}`
          : resultado?.tipo === "funcao"
            ? `Funcao ${resultado.funcao.nome}`
      : resultado?.tipo === "resultados_globais"
        ? "Resultados globais"
      : "Detalhes";

  const modalDescription = resultado?.tipo === "funcionario"
    ? `Matricula ${resultado.funcionario.matricula}`
    : resultado?.tipo === "kit"
      ? [
        resultado.kit.tipo,
        descricaoItemLabel(resultado.kit.descricao),
        `Tam: ${resultado.kit.tamanho}`,
      ].filter(Boolean).join(" | ")
      : resultado?.tipo === "setor"
        ? `${resultado.setor.total_unidades} unidades | ${resultado.setor.total_funcionarios} funcionarios`
        : resultado?.tipo === "unidade"
          ? `${resultado.unidade.total_setores} setores | ${resultado.unidade.total_funcionarios} funcionarios`
          : resultado?.tipo === "funcao"
            ? `${resultado.funcao.total_funcionarios} funcionarios`
      : resultado?.tipo === "resultados_globais"
        ? `${totalResultadosGlobais} resultados para "${resultado.consulta}"`
      : undefined;

  const modalIcon = resultado?.tipo === "funcionario"
    ? User
    : resultado?.tipo === "kit"
      ? Package
      : resultado?.tipo === "setor" || resultado?.tipo === "unidade"
        ? Building2
        : resultado?.tipo === "funcao"
          ? UserCog
      : resultado?.tipo === "resultados_globais"
        ? Building2
      : undefined;
  const detailModalMaxWidth = resultado?.tipo === "resultados_globais"
    ? "max-w-4xl"
    : resultado?.tipo === "funcionario" ||
        resultado?.tipo === "setor" ||
        resultado?.tipo === "unidade" ||
        resultado?.tipo === "funcao"
      ? "max-w-3xl"
      : "max-w-2xl";
  const kitUsuarioAssociado = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit") {
      return null;
    }

    return obterUsuarioAssociadoKit(resultado.kit, resultado.historico);
  }, [resultado]);
  const kitSetorAssociado = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit") {
      return null;
    }
    const setor = (resultado.kit.setor_solicitante ?? "").trim();
    return setor || null;
  }, [resultado]);
  const kitEmprestado = resultado?.tipo === "kit" && resultado.kit.status === "emprestado";
  const kitTemHistorico = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit") {
      return false;
    }
    return resultado.historico.solicitacoes.length > 0 || resultado.historico.devolucoes.length > 0;
  }, [resultado]);
  const kitUltimoEmprestimoEvento = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit") {
      return null;
    }
    return resultado.historico.solicitacoes[0] ?? null;
  }, [resultado]);
  const kitUltimaDevolucaoEvento = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit") {
      return null;
    }
    return resultado.historico.devolucoes[0] ?? null;
  }, [resultado]);
  const kitUltimoUsuarioHistorico = useMemo(() => {
    return (
      formatarUsuarioHistorico(kitUltimaDevolucaoEvento) ??
      formatarUsuarioHistorico(kitUltimoEmprestimoEvento)
    );
  }, [kitUltimaDevolucaoEvento, kitUltimoEmprestimoEvento]);
  const kitTituloVinculo = useMemo(() => {
    if (kitEmprestado) {
      if (kitUsuarioAssociado) return "Usuario atual";
      if (kitSetorAssociado) return "Setor atual";
      return "Vinculo atual";
    }
    if (kitUltimoUsuarioHistorico) return "Ultimo usuario";
    if (kitSetorAssociado) return "Ultimo setor";
    return "Ultimo vinculo";
  }, [kitEmprestado, kitSetorAssociado, kitUltimoUsuarioHistorico, kitUsuarioAssociado]);
  const tipoKitSelecionadoEhCustom = useMemo(() => {
    if (!resultado || resultado.tipo !== "kit" || criandoNovoTipoKit) {
      return false;
    }
    const tipoAtual = normalizarTipo(draftKit.tipo);
    if (!tipoAtual) {
      return false;
    }
    return !TIPOS_PADRAO.some(
      (tipoPadrao) => normalizarTipo(tipoPadrao).toLowerCase() === tipoAtual.toLowerCase(),
    );
  }, [criandoNovoTipoKit, draftKit.tipo, resultado]);
  const iniciarEdicaoTipoCustom = useCallback(() => {
    if (!tipoKitSelecionadoEhCustom) return;
    const tipoAtual = normalizarTipo(draftKit.tipo);
    if (!tipoAtual) return;
    setTipoKitEditando(tipoAtual);
    setCriandoNovoTipoKit(true);
    setNovoTipoKit(tipoAtual);
  }, [draftKit.tipo, tipoKitSelecionadoEhCustom]);
  const removerTipoCustom = useCallback(() => {
    if (!tipoKitSelecionadoEhCustom) return;
    const tipoAtual = normalizarTipo(draftKit.tipo);
    if (!tipoAtual) return;

    const confirmou = window.confirm(`Remover "${tipoAtual}" da lista de tipos?`);
    if (!confirmou) return;

    setOpcoesTipoKit((prev) =>
      prev.filter(
        (tipo) => normalizarTipo(tipo).toLowerCase() !== tipoAtual.toLowerCase(),
      ),
    );
    setDraftKit((prev) => ({ ...prev, tipo: TIPOS_PADRAO[0] }));
    setCriandoNovoTipoKit(false);
    setNovoTipoKit("");
    setTipoKitEditando(null);
  }, [draftKit.tipo, tipoKitSelecionadoEhCustom]);

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
            Nenhum resultado encontrado para: <strong>{resultado.consulta}</strong>.
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
                      Matricula {sugestao.matricula} | {formatarUnidadesFuncionario(
                        normalizarUnidadesFuncionario(sugestao.unidades, sugestao.unidade),
                      )} | {formatarSetoresFuncionario(
                        normalizarSetoresFuncionario(sugestao.setores, sugestao.setor),
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

        {!loading && !erroBusca && resultado?.tipo === "resultados_globais" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Busca global para <strong>{resultado.consulta}</strong>. Refine o termo para reduzir a lista.
            </p>

            <div className="grid gap-3 lg:grid-cols-2">
              {resultado.resultados.funcionarios.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-border/60 bg-surface-1/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Funcionarios ({resultado.resultados.funcionarios.length})
                  </p>
                  <div className="space-y-1.5">
                    {resultado.resultados.funcionarios.map((funcionario) => (
                      <button
                        key={`func-${funcionario.matricula}`}
                        type="button"
                        className="flex w-full items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-left transition-all hover:border-primary/30 hover:bg-accent/35"
                        onClick={() => {
                          void openFuncionario(funcionario.matricula);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{funcionario.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Matricula {funcionario.matricula} | {funcionario.unidade} | {funcionario.setor} | {funcionario.funcao}
                          </p>
                        </div>
                        <StatusPill tone={funcionario.status_ativo ? "success" : "danger"}>
                          {funcionario.status_ativo ? "Ativo" : "Inativo"}
                        </StatusPill>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resultado.resultados.kits.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-border/60 bg-surface-1/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Kits ({resultado.resultados.kits.length})
                  </p>
                  <div className="space-y-1.5">
                    {resultado.resultados.kits.map((kit) => (
                      <button
                        key={`kit-${kit.codigo}`}
                        type="button"
                        className="flex w-full items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-left transition-all hover:border-primary/30 hover:bg-accent/35"
                        onClick={() => {
                          void openKit(kit.codigo);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm font-semibold text-primary">{kit.codigo}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {kit.tipo} | {descricaoItemLabel(kit.descricao)} | Tam: {kit.tamanho}
                          </p>
                          {(kit.solicitante_matricula || kit.setor_solicitante) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {kit.solicitante_matricula ? `Matricula: ${kit.solicitante_matricula}` : ""}
                              {kit.solicitante_matricula && kit.setor_solicitante ? " | " : ""}
                              {kit.setor_solicitante ? `Setor: ${kit.setor_solicitante}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusPill tone={statusKitTone(kit.status)}>{statusKitLabel(kit.status)}</StatusPill>
                          {!kit.status_ativo && <StatusPill tone="danger">Inativo</StatusPill>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resultado.resultados.setores.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-border/60 bg-surface-1/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Setores ({resultado.resultados.setores.length})
                  </p>
                  <div className="space-y-1.5">
                    {resultado.resultados.setores.map((setor) => (
                      <button
                        key={`setor-${setor.id}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-left transition-all hover:border-primary/30 hover:bg-accent/35"
                        onClick={() => {
                          void openSetor(setor.nome);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{setor.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {setor.total_unidades} unidades | {setor.total_funcionarios} funcionarios
                          </p>
                        </div>
                        <StatusPill tone={setor.status_ativo ? "success" : "danger"}>
                          {setor.status_ativo ? "Ativo" : "Inativo"}
                        </StatusPill>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resultado.resultados.unidades.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-border/60 bg-surface-1/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Unidades ({resultado.resultados.unidades.length})
                  </p>
                  <div className="space-y-1.5">
                    {resultado.resultados.unidades.map((unidade) => (
                      <button
                        key={`unidade-${unidade.id}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-left transition-all hover:border-primary/30 hover:bg-accent/35"
                        onClick={() => {
                          void openUnidade(unidade.nome);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{unidade.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {unidade.total_setores} setores | {unidade.total_funcionarios} funcionarios
                          </p>
                        </div>
                        <StatusPill tone={unidade.status_ativo ? "success" : "danger"}>
                          {unidade.status_ativo ? "Ativa" : "Inativa"}
                        </StatusPill>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resultado.resultados.funcoes.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-border/60 bg-surface-1/80 p-3 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Funcoes ({resultado.resultados.funcoes.length})
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {resultado.resultados.funcoes.map((funcao) => (
                      <button
                        key={`funcao-${funcao.id}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-left transition-all hover:border-primary/30 hover:bg-accent/35"
                        onClick={() => {
                          void openFuncao(funcao.nome);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{funcao.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {funcao.total_funcionarios} funcionarios
                          </p>
                        </div>
                        <StatusPill tone={funcao.status_ativo ? "success" : "danger"}>
                          {funcao.status_ativo ? "Ativa" : "Inativa"}
                        </StatusPill>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "setor" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={resultado.setor.status_ativo ? "success" : "danger"}>
                  {resultado.setor.status_ativo ? "Ativo" : "Inativo"}
                </StatusPill>
              </div>
              <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Nome
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.setor.nome}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Unidades vinculadas
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.setor.total_unidades}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Funcionarios vinculados
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.setor.total_funcionarios}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" />
                Funcionarios relacionados
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {resultado.funcionarios_relacionados.length}{" "}
                  {resultado.funcionarios_relacionados.length === 1 ? "item" : "itens"}
                </span>
              </div>
              {resultado.funcionarios_relacionados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/55 py-3 text-center text-sm text-muted-foreground">
                  Nenhum funcionario relacionado encontrado neste recorte.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {resultado.funcionarios_relacionados.map((funcionario) => (
                    <button
                      key={`setor-func-${funcionario.matricula}`}
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/55 bg-background/70 px-3 py-2.5 text-left text-sm transition-all hover:border-primary/30 hover:bg-accent/40"
                      onClick={() => {
                        void openFuncionario(funcionario.matricula);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-foreground">{funcionario.nome}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Matricula {funcionario.matricula} | {funcionario.unidade} | {funcionario.funcao}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "unidade" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={resultado.unidade.status_ativo ? "success" : "danger"}>
                  {resultado.unidade.status_ativo ? "Ativa" : "Inativa"}
                </StatusPill>
              </div>
              <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Nome
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.unidade.nome}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Setores vinculados
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.unidade.total_setores}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Funcionarios vinculados
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.unidade.total_funcionarios}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" />
                Funcionarios relacionados
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {resultado.funcionarios_relacionados.length}{" "}
                  {resultado.funcionarios_relacionados.length === 1 ? "item" : "itens"}
                </span>
              </div>
              {resultado.funcionarios_relacionados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/55 py-3 text-center text-sm text-muted-foreground">
                  Nenhum funcionario relacionado encontrado neste recorte.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {resultado.funcionarios_relacionados.map((funcionario) => (
                    <button
                      key={`unidade-func-${funcionario.matricula}`}
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/55 bg-background/70 px-3 py-2.5 text-left text-sm transition-all hover:border-primary/30 hover:bg-accent/40"
                      onClick={() => {
                        void openFuncionario(funcionario.matricula);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-foreground">{funcionario.nome}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Matricula {funcionario.matricula} | {funcionario.setor} | {funcionario.funcao}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "funcao" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={resultado.funcao.status_ativo ? "success" : "danger"}>
                  {resultado.funcao.status_ativo ? "Ativa" : "Inativa"}
                </StatusPill>
              </div>
              <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Nome
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.funcao.nome}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Funcionarios vinculados
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{resultado.funcao.total_funcionarios}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" />
                Funcionarios relacionados
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {resultado.funcionarios_relacionados.length}{" "}
                  {resultado.funcionarios_relacionados.length === 1 ? "item" : "itens"}
                </span>
              </div>
              {resultado.funcionarios_relacionados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/55 py-3 text-center text-sm text-muted-foreground">
                  Nenhum funcionario relacionado encontrado neste recorte.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {resultado.funcionarios_relacionados.map((funcionario) => (
                    <button
                      key={`funcao-func-${funcionario.matricula}`}
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/55 bg-background/70 px-3 py-2.5 text-left text-sm transition-all hover:border-primary/30 hover:bg-accent/40"
                      onClick={() => {
                        void openFuncionario(funcionario.matricula);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-foreground">{funcionario.nome}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Matricula {funcionario.matricula} | {funcionario.unidade} | {funcionario.setor}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )}
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
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <Package className="h-3.5 w-3.5 text-primary/70" />
                      Tipo
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">{resultado.kit.tipo}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 sm:col-span-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <Package className="h-3.5 w-3.5 text-primary/70" />
                      Descricao
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {descricaoItemLabel(resultado.kit.descricao)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {((kitEmprestado && !kitUsuarioAssociado && kitSetorAssociado) || (!kitEmprestado && !kitUltimoUsuarioHistorico && kitSetorAssociado)) ? (
                        <Building2 className="h-3.5 w-3.5 text-primary/70" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-primary/70" />
                      )}
                      {kitTituloVinculo}
                    </div>
                    {kitEmprestado ? (
                      kitUsuarioAssociado ? (
                        <>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {kitUsuarioAssociado}
                          </p>
                          {kitSetorAssociado ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Setor: {kitSetorAssociado}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Item em emprestimo ativo.
                          </p>
                        </>
                      ) : kitSetorAssociado ? (
                        <>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {kitSetorAssociado}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Item em emprestimo ativo para este setor.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-semibold text-foreground">Sem vinculo identificado</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Este item esta emprestado, mas sem usuario/setor informado.
                          </p>
                        </>
                      )
                    ) : (
                      kitUltimoUsuarioHistorico ? (
                        <>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {kitUltimoUsuarioHistorico}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Usuario do ultimo ciclo registrado deste item.
                          </p>
                        </>
                      ) : kitSetorAssociado ? (
                        <>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {kitSetorAssociado}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ultimo setor associado ao item.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-semibold text-foreground">Sem vinculo no historico</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Este item ainda nao teve usuario ou setor vinculado.
                          </p>
                        </>
                      )
                    )}
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                      {kitEmprestado ? "Ultimo emprestimo" : "Ultima devolucao"}
                    </div>
                    {kitEmprestado ? (
                      <>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatDateTime(resultado.kit.data_emprestimo ?? kitUltimoEmprestimoEvento?.timestamp ?? null)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Inicio do emprestimo atual.
                        </p>
                      </>
                    ) : kitUltimaDevolucaoEvento ? (
                      <>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatDateTime(kitUltimaDevolucaoEvento.timestamp)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Data da ultima devolucao registrada.
                        </p>
                      </>
                    ) : kitTemHistorico ? (
                      <>
                        <p className="mt-1 text-sm font-semibold text-foreground">Sem devolucao registrada</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Existe historico de emprestimo, mas sem devolucao registrada.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm font-semibold text-foreground">Sem historico de devolucao</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Este item ainda nao teve devolucao registrada.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-1/85 p-4 sm:p-5">
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-codigo">Codigo</Label>
                  <Input
                    id="detalhe-kit-codigo"
                    value={draftKit.codigo}
                    onChange={(event) =>
                      setDraftKit((prev) => ({ ...prev, codigo: event.target.value }))
                    }
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-descricao">Descricao (opcional)</Label>
                  <Input
                    id="detalhe-kit-descricao"
                    value={draftKit.descricao}
                    onChange={(event) =>
                      setDraftKit((prev) => ({ ...prev, descricao: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-tipo-select">Tipo</Label>
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={criandoNovoTipoKit ? NOVO_TIPO_OPTION : draftKit.tipo}
                        onValueChange={(value) => {
                          if (value === NOVO_TIPO_OPTION) {
                            setCriandoNovoTipoKit(true);
                            setNovoTipoKit("");
                            setTipoKitEditando(null);
                            return;
                          }
                          setCriandoNovoTipoKit(false);
                          setTipoKitEditando(null);
                          setDraftKit((prev) => ({ ...prev, tipo: value }));
                        }}
                      >
                        <SelectTrigger id="detalhe-kit-tipo-select">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {opcoesTipoKit.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                          <SelectItem value={NOVO_TIPO_OPTION}>Criar novo tipo...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                      onClick={() => iniciarEdicaoTipoCustom()}
                      title={tipoKitSelecionadoEhCustom ? "Editar tipo" : "Selecione um tipo custom para editar"}
                      aria-label="Editar tipo"
                      disabled={!tipoKitSelecionadoEhCustom}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/70 hover:text-destructive disabled:pointer-events-none disabled:opacity-35"
                      onClick={() => removerTipoCustom()}
                      title={tipoKitSelecionadoEhCustom ? "Remover tipo da lista" : "Selecione um tipo custom para remover"}
                      aria-label="Remover tipo da lista"
                      disabled={!tipoKitSelecionadoEhCustom}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {criandoNovoTipoKit && (
                  <div className="space-y-1">
                    <Label htmlFor="detalhe-kit-tipo-novo">
                      {tipoKitEditando ? "Editar tipo" : "Novo tipo"}
                    </Label>
                    <Input
                      id="detalhe-kit-tipo-novo"
                      value={novoTipoKit}
                      onChange={(event) => setNovoTipoKit(event.target.value)}
                      maxLength={100}
                      placeholder="Ex.: Kit roupa cirurgico"
                    />
                  </div>
                )}
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
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-foreground">Unidades</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() =>
                            setOrdemUnidadesCatalogo((prev) => (prev === "asc" ? "desc" : "asc"))
                          }
                          title="Ordenar unidades"
                          aria-label="Ordenar unidades"
                        >
                          {ordemUnidadesCatalogo === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() => setPaginaUnidadesCatalogo((prev) => Math.max(1, prev - 1))}
                          disabled={paginaUnidadesCatalogo === 1}
                          aria-label="Pagina anterior de unidades"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
                          {paginaUnidadesCatalogo}/{totalPaginasUnidadesCatalogo}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() =>
                            setPaginaUnidadesCatalogo((prev) =>
                              Math.min(totalPaginasUnidadesCatalogo, prev + 1),
                            )
                          }
                          disabled={paginaUnidadesCatalogo >= totalPaginasUnidadesCatalogo}
                          aria-label="Proxima pagina de unidades"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="min-h-[10.75rem] space-y-2 rounded-lg border border-border/70 bg-background p-3">
                      {unidadesCatalogoPaginadas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma unidade ativa.</p>
                      ) : (
                        unidadesCatalogoPaginadas.map((unidade) => (
                          <label key={unidade.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draftFuncionario.unidades.includes(unidade.nome)}
                              onCheckedChange={(checked) =>
                                alternarUnidadeDraft(unidade.nome, Boolean(checked))
                              }
                            />
                            <span>{unidade.nome}</span>
                          </label>
                        ))
                      )}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-foreground">Setores</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() =>
                            setOrdemSetoresCatalogo((prev) => (prev === "asc" ? "desc" : "asc"))
                          }
                          title="Ordenar setores"
                          aria-label="Ordenar setores"
                        >
                          {ordemSetoresCatalogo === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() => setPaginaSetoresCatalogo((prev) => Math.max(1, prev - 1))}
                          disabled={paginaSetoresCatalogo === 1}
                          aria-label="Pagina anterior de setores"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
                          {paginaSetoresCatalogo}/{totalPaginasSetoresCatalogo}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() =>
                            setPaginaSetoresCatalogo((prev) =>
                              Math.min(totalPaginasSetoresCatalogo, prev + 1),
                            )
                          }
                          disabled={paginaSetoresCatalogo >= totalPaginasSetoresCatalogo}
                          aria-label="Proxima pagina de setores"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="min-h-[10.75rem] space-y-2 rounded-lg border border-border/70 bg-background p-3">
                      {setoresCatalogoPaginados.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum setor ativo.</p>
                      ) : (
                        setoresCatalogoPaginados.map((setor) => (
                          <label
                            key={setor.id}
                            className={cn(
                              "flex items-center gap-2 text-sm",
                              draftFuncionario.unidades.length > 0 &&
                                !setorCompativelComUnidadesCatalogo(setor, draftFuncionario.unidades)
                                ? "cursor-not-allowed opacity-55"
                                : "",
                            )}
                          >
                            <Checkbox
                              checked={draftFuncionario.setores.includes(setor.nome)}
                              disabled={
                                draftFuncionario.unidades.length > 0 &&
                                !setorCompativelComUnidadesCatalogo(setor, draftFuncionario.unidades)
                              }
                              onCheckedChange={(checked) =>
                                alternarSetorDraft(setor.nome, Boolean(checked))
                              }
                            />
                            <span>{setor.nome}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecionados: {draftFuncionario.setores.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Disponiveis para as unidades selecionadas: {setoresDisponiveisDraft.length}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-foreground">Funcoes</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() =>
                            setOrdemFuncoesCatalogo((prev) => (prev === "asc" ? "desc" : "asc"))
                          }
                          title="Ordenar funcoes"
                          aria-label="Ordenar funcoes"
                        >
                          {ordemFuncoesCatalogo === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() => setPaginaFuncoesCatalogo((prev) => Math.max(1, prev - 1))}
                          disabled={paginaFuncoesCatalogo === 1}
                          aria-label="Pagina anterior de funcoes"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
                          {paginaFuncoesCatalogo}/{totalPaginasFuncoesCatalogo}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground"
                          onClick={() =>
                            setPaginaFuncoesCatalogo((prev) =>
                              Math.min(totalPaginasFuncoesCatalogo, prev + 1),
                            )
                          }
                          disabled={paginaFuncoesCatalogo >= totalPaginasFuncoesCatalogo}
                          aria-label="Proxima pagina de funcoes"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="min-h-[10.75rem] space-y-2 rounded-lg border border-border/70 bg-background p-3">
                      {funcoesCatalogoPaginadas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma funcao ativa.</p>
                      ) : (
                        funcoesCatalogoPaginadas.map((funcao) => (
                          <label key={funcao.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draftFuncionario.funcoes.includes(funcao.nome)}
                              onCheckedChange={(checked) =>
                                alternarFuncaoDraft(funcao.nome, Boolean(checked))
                              }
                            />
                            <span>{funcao.nome}</span>
                          </label>
                        ))
                      )}
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
                        <div className="truncate text-foreground">{descricaoItemLabel(item.descricao)}</div>
                        <div className="text-xs text-muted-foreground">Tipo: {item.tipo}</div>
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
        description="Todos os ciclos de emprestimo e devolucao"
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
    <div className="space-y-2.5">
      {ciclos.length === 0 ? (
        <p className="rounded-lg bg-muted/30 py-3 text-center text-sm text-muted-foreground">
          Nenhum registro.
        </p>
      ) : (
        <div className="space-y-2.5">
          {ciclos.map((ciclo, index) => (
            <div
              key={`ciclo-${ciclo.item_codigo}-${ciclo.matricula}-${ciclo.saida_em ?? "sem-saida"}-${index}`}
              className={cn(
                "rounded-xl border bg-surface-1 px-3.5 py-3 text-sm shadow-sm",
                ciclo.em_aberto ? "border-warning/45" : "border-success/40",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-foreground">{ciclo.nome_funcionario}</span>
                    <span className="text-muted-foreground">({ciclo.matricula})</span>
                  </div>
                  <span className="font-mono font-semibold text-primary">{ciclo.item_codigo}</span>
                </div>
                <StatusPill tone={ciclo.em_aberto ? "warning" : "success"}>
                  {ciclo.em_aberto ? "Em aberto" : "Concluido"}
                </StatusPill>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/65 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5 text-primary/70" />
                    Emprestimo
                  </div>
                  <div className="text-sm font-medium text-foreground">{formatDateTime(ciclo.saida_em)}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Operador: {ciclo.saida_operador ?? "-"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/65 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ArrowDownLeft className="h-3.5 w-3.5 text-primary/70" />
                    Devolucao
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {ciclo.em_aberto ? "Aguardando devolucao" : formatDateTime(ciclo.entrada_em)}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Operador: {ciclo.entrada_operador ?? "-"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary/60" />
                Intervalo com item:{" "}
                <span className="font-medium text-foreground">{formatDuracaoHoras(ciclo.duracao_horas)}</span>
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
