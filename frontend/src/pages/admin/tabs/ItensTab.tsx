import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
  sortDataTableRows,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TableActions } from "@/components/ui/table-actions";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import type { ItemRow, ItemStatus } from "../types";

const NOVO_TAMANHO_OPTION = "__novo_tamanho__";
const NOVO_TIPO_OPTION = "__novo_tipo__";
const TAMANHOS_PADRAO = ["UNICO", "PP", "P", "M", "G", "GG", "XG"];
const TIPOS_PADRAO = ["Kit roupa", "Lencol", "Sem tipo"];
const TIPO_FALLBACK_PADRAO = "Sem tipo";
const CODIGO_BASE_PADRAO = "KIT-";
const CASAS_CODIGO_PADRAO = 3;
const MAX_ITENS_LOTE_MISTO_OPERACAO = 1000;
const MAX_ITENS_LOTE_MISTO_TOTAL = 2000;
const ITENS_POR_PAGINA = 10;
const FILTRO_INPUT_CLASS =
  "h-8 rounded-xl border-border/80 bg-background/85 text-xs dark:border-border/90 dark:bg-background/70";
const FILTRO_SELECT_CLASS =
  "h-8 rounded-xl border-border/80 bg-background/85 text-xs dark:border-border/90 dark:bg-background/70";
const TABELA_CONTAINER_CLASS =
  "overflow-hidden border-border/65 bg-background/72 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-background/58";
const TABELA_DENSE_CLASS = `${TABELA_CONTAINER_CLASS} [--table-inline-gap:0.95rem]`;
const FILTRO_BAR_CLASS = "gap-1.5 md:flex-nowrap md:items-end";
const SECTION_HEADER_CLASS = "gap-2 px-3 pb-2 pt-3 sm:px-4 sm:pb-2 sm:pt-4";
const SECTION_CONTENT_CLASS = "space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4";

function notificarAtualizacaoGlobal(entidade: "kit" | "funcionario" | "setor" | "unidade" | "funcao") {
  window.dispatchEvent(new CustomEvent("global-detail-updated", { detail: { entidade } }));
}

function normalizarTamanho(valor: string) {
  return valor.trim().toUpperCase();
}

function normalizarTipo(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

function normalizarTipoChave(valor: string) {
  return normalizarTipo(valor).toLowerCase();
}

function deduplicarTiposMantendoOrdem(tipos: string[]) {
  const seen = new Set<string>();
  const tiposUnicos: string[] = [];

  for (const tipo of tipos) {
    const tipoNormalizado = normalizarTipo(tipo);
    if (!tipoNormalizado) {
      continue;
    }
    const chave = normalizarTipoChave(tipoNormalizado);
    if (seen.has(chave)) {
      continue;
    }
    seen.add(chave);
    tiposUnicos.push(tipoNormalizado);
  }

  return tiposUnicos;
}

function descricaoItemLabel(descricao: string | null | undefined) {
  const normalized = (descricao ?? "").trim();
  return normalized;
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

function montarOpcoesTipo(tiposExistentes: string[], tiposBase: string[]) {
  const base = deduplicarTiposMantendoOrdem(tiposBase);
  const baseChaves = new Set(base.map((tipo) => normalizarTipoChave(tipo)));

  const extras = deduplicarTiposMantendoOrdem(tiposExistentes)
    .filter((tipo) => !baseChaves.has(normalizarTipoChave(tipo)))
    .sort((a, b) => a.localeCompare(b));

  return [...base, ...extras];
}

type ModoCriacaoItem = "unitario" | "lote";
type AcaoLote = "adicionar" | "remover";

type OperacaoLote = {
  id: string;
  acao: AcaoLote;
  tipo: string;
  tamanho: string;
  quantidade: number;
  descricao: string;
  status: ItemStatus;
};

function gerarIdOperacaoLote() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarDescricaoOpcional(valor: string) {
  const normalizado = valor.trim();
  return normalizado.length > 0 ? normalizado : null;
}

function chaveEstoque(tipo: string, tamanho: string) {
  return `${normalizarTipoChave(tipo)}::${normalizarTamanho(tamanho)}`;
}

type SugestaoCodigo = {
  base: string;
  proximoNumero: number;
  casasNumero: number;
};

function gerarCodigoSequencial(base: string, numero: number, casasNumero: number) {
  return `${base}${String(numero).padStart(casasNumero, "0")}`;
}

function sugerirSequenciaCodigo(rows: ItemRow[]): SugestaoCodigo {
  let maiorNumero = -1;
  let melhorBase = CODIGO_BASE_PADRAO;
  let melhorCasas = CASAS_CODIGO_PADRAO;

  for (const row of rows) {
    const codigo = row.codigo.trim();
    const match = codigo.match(/^(.*?)(\d+)$/);
    if (!match) {
      continue;
    }

    const numero = Number.parseInt(match[2], 10);
    if (!Number.isFinite(numero) || numero < maiorNumero) {
      continue;
    }

    maiorNumero = numero;
    melhorBase = match[1] || CODIGO_BASE_PADRAO;
    melhorCasas = Math.max(1, match[2].length);
  }

  return {
    base: melhorBase,
    proximoNumero: maiorNumero >= 0 ? maiorNumero + 1 : 1,
    casasNumero: melhorCasas,
  };
}

function gerarCodigosLote(params: {
  base: string;
  numeroInicial: number;
  quantidade: number;
  casasNumero: number;
}) {
  return Array.from({ length: params.quantidade }, (_, index) =>
    gerarCodigoSequencial(params.base, params.numeroInicial + index, params.casasNumero),
  );
}

function extrairNumeroCodigo(codigo: string, base: string) {
  const codigoNormalizado = codigo.trim();
  const baseNormalizada = base.trim();
  if (!codigoNormalizado || !baseNormalizada) {
    return null;
  }

  if (!codigoNormalizado.toLowerCase().startsWith(baseNormalizada.toLowerCase())) {
    return null;
  }

  const sufixo = codigoNormalizado.slice(baseNormalizada.length);
  if (!/^\d+$/.test(sufixo)) {
    return null;
  }

  const numero = Number.parseInt(sufixo, 10);
  return Number.isFinite(numero) ? numero : null;
}

function resumirCodigos(codigos: string[], limite = 6) {
  if (codigos.length <= limite) {
    return codigos.join(", ");
  }
  const primeiros = codigos.slice(0, limite).join(", ");
  return `${primeiros} ... (+${codigos.length - limite})`;
}

interface ItensTabProps {
  endpointBase?: string;
}

export function ItensTab({ endpointBase = "/admin/itens" }: ItensTabProps) {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatusItem, setFiltroStatusItem] = useState<"todos" | ItemStatus>("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroTamanho, setFiltroTamanho] = useState("todos");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativo" | "inativo">("todos");
  const [paginaItens, setPaginaItens] = useState(1);
  const [sortItens, setSortItens] = useState<DataTableSortState>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemRow | null>(null);
  const [codigosSelecionados, setCodigosSelecionados] = useState<string[]>([]);
  const [excluirSelecionadosAberto, setExcluirSelecionadosAberto] = useState(false);
  const [selecionarLoteAberto, setSelecionarLoteAberto] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const { success, error } = useToast();
  const { openKit } = useGlobalDetail();

  const [novo, setNovo] = useState({
    codigo: "",
    descricao: "",
    status: "disponivel" as ItemStatus,
  });
  const [tiposBase, setTiposBase] = useState<string[]>(TIPOS_PADRAO);
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_PADRAO[0]);
  const [dropdownTipoAberto, setDropdownTipoAberto] = useState(false);
  const [novoTipo, setNovoTipo] = useState("");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("UNICO");
  const [novoTamanho, setNovoTamanho] = useState("");
  const [gerenciandoTipo, setGerenciandoTipo] = useState(false);
  const [modoCriacao, setModoCriacao] = useState<ModoCriacaoItem>("unitario");
  const [acaoLote, setAcaoLote] = useState<AcaoLote>("adicionar");
  const [lote, setLote] = useState({
    codigoBase: CODIGO_BASE_PADRAO,
    numeroInicial: "1",
    casasNumero: String(CASAS_CODIGO_PADRAO),
  });
  const [operacaoLoteMisto, setOperacaoLoteMisto] = useState({
    tipo: TIPOS_PADRAO[0],
    tamanho: "UNICO",
    quantidade: "1",
    descricao: "",
    status: "disponivel" as ItemStatus,
  });
  const [carrinhoLoteMisto, setCarrinhoLoteMisto] = useState<OperacaoLote[]>([]);
  const [loteSelecao, setLoteSelecao] = useState({
    tipo: "todos",
    codigoBase: CODIGO_BASE_PADRAO,
    numeroInicial: "1",
    numeroFinal: "10",
    substituirSelecao: true,
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ItemRow[]>(`${endpointBase}?include_inactive=true`);
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  }, [endpointBase, error]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ entidade?: string }>).detail;
      if (detail?.entidade === "kit") {
        void carregar();
      }
    };

    window.addEventListener("global-detail-updated", onUpdated);
    return () => window.removeEventListener("global-detail-updated", onUpdated);
  }, [carregar]);

  const opcoesTamanho = useMemo(() => montarOpcoesTamanho(rows.map((row) => row.tamanho)), [rows]);
  const opcoesTipo = useMemo(() => montarOpcoesTipo(rows.map((row) => row.tipo), tiposBase), [rows, tiposBase]);

  useEffect(() => {
    if (tipoSelecionado === NOVO_TIPO_OPTION || opcoesTipo.length === 0) {
      return;
    }
    const selecionadoExiste = opcoesTipo.some(
      (tipo) => normalizarTipoChave(tipo) === normalizarTipoChave(tipoSelecionado),
    );
    if (!selecionadoExiste) {
      setTipoSelecionado(opcoesTipo[0]);
    }
  }, [opcoesTipo, tipoSelecionado]);

  useEffect(() => {
    setCarrinhoLoteMisto([]);
    setOperacaoLoteMisto((prev) => ({
      ...prev,
      quantidade: "1",
      descricao: "",
      status: "disponivel",
    }));
  }, [acaoLote]);

  const resumoCarrinhoLoteMisto = useMemo(() => {
    const adicionados = carrinhoLoteMisto
      .filter((item) => item.acao === "adicionar")
      .reduce((acc, item) => acc + item.quantidade, 0);
    const removidos = carrinhoLoteMisto
      .filter((item) => item.acao === "remover")
      .reduce((acc, item) => acc + item.quantidade, 0);

    return { adicionados, removidos };
  }, [carrinhoLoteMisto]);

  const estoqueDisponivelPorTipoTamanho = useMemo(() => {
    const mapa = new Map<string, { tipo: string; tamanho: string; disponiveis: number }>();
    for (const item of rows) {
      if (!item.statusAtivo || item.status !== "disponivel") {
        continue;
      }
      const tipo = normalizarTipo(item.tipo);
      const tamanho = normalizarTamanho(item.tamanho);
      const chave = chaveEstoque(tipo, tamanho);
      const atual = mapa.get(chave);
      if (atual) {
        atual.disponiveis += 1;
      } else {
        mapa.set(chave, { tipo, tamanho, disponiveis: 1 });
      }
    }
    return mapa;
  }, [rows]);

  const opcoesRemocaoDisponiveis = useMemo(
    () => Array.from(estoqueDisponivelPorTipoTamanho.values())
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.tamanho.localeCompare(b.tamanho)),
    [estoqueDisponivelPorTipoTamanho],
  );
  const tiposDisponiveisRemocao = useMemo(
    () => [...new Set(opcoesRemocaoDisponiveis.map((item) => item.tipo))],
    [opcoesRemocaoDisponiveis],
  );
  const tamanhosDisponiveisRemocao = useMemo(
    () => opcoesRemocaoDisponiveis
      .filter((item) => normalizarTipoChave(item.tipo) === normalizarTipoChave(operacaoLoteMisto.tipo))
      .map((item) => item.tamanho),
    [opcoesRemocaoDisponiveis, operacaoLoteMisto.tipo],
  );

  useEffect(() => {
    if (acaoLote !== "remover" || opcoesRemocaoDisponiveis.length === 0) {
      return;
    }
    const existeSelecao = opcoesRemocaoDisponiveis.some(
      (item) =>
        normalizarTipoChave(item.tipo) === normalizarTipoChave(operacaoLoteMisto.tipo)
        && normalizarTamanho(item.tamanho) === normalizarTamanho(operacaoLoteMisto.tamanho),
    );
    if (!existeSelecao) {
      const primeira = opcoesRemocaoDisponiveis[0];
      setOperacaoLoteMisto((prev) => ({
        ...prev,
        tipo: primeira.tipo,
        tamanho: primeira.tamanho,
      }));
    }
  }, [acaoLote, opcoesRemocaoDisponiveis, operacaoLoteMisto.tipo, operacaoLoteMisto.tamanho]);

  const disponiveisSelecionados = useMemo(() => {
    const chave = chaveEstoque(operacaoLoteMisto.tipo, operacaoLoteMisto.tamanho);
    return estoqueDisponivelPorTipoTamanho.get(chave)?.disponiveis ?? 0;
  }, [estoqueDisponivelPorTipoTamanho, operacaoLoteMisto.tipo, operacaoLoteMisto.tamanho]);

  const quantidadePendenteRemocaoSelecionada = useMemo(
    () => carrinhoLoteMisto
      .filter((item) =>
        item.acao === "remover"
        && normalizarTipoChave(item.tipo) === normalizarTipoChave(operacaoLoteMisto.tipo)
        && normalizarTamanho(item.tamanho) === normalizarTamanho(operacaoLoteMisto.tamanho),
      )
      .reduce((acc, item) => acc + item.quantidade, 0),
    [carrinhoLoteMisto, operacaoLoteMisto.tipo, operacaoLoteMisto.tamanho],
  );

  const codigosLotePreview = useMemo(() => {
    if (modoCriacao !== "lote" || acaoLote !== "adicionar" || resumoCarrinhoLoteMisto.adicionados <= 0) {
      return [];
    }

    const base = lote.codigoBase.trim();
    const numeroInicial = Number.parseInt(lote.numeroInicial, 10);
    const casasNumero = Number.parseInt(lote.casasNumero, 10);
    if (!base || !Number.isInteger(numeroInicial) || !Number.isInteger(casasNumero)) {
      return [];
    }

    if (numeroInicial < 0 || casasNumero <= 0) {
      return [];
    }

    const quantidadePreview = Math.min(resumoCarrinhoLoteMisto.adicionados, 20);
    return gerarCodigosLote({
      base,
      numeroInicial,
      quantidade: quantidadePreview,
      casasNumero,
    });
  }, [acaoLote, modoCriacao, resumoCarrinhoLoteMisto.adicionados, lote]);

  function resetarFormularioCriacao() {
    const sugestao = sugerirSequenciaCodigo(rows);
    const tipoInicial = opcoesTipo[0] ?? TIPOS_PADRAO[0];

    setNovo({
      codigo: gerarCodigoSequencial(sugestao.base, sugestao.proximoNumero, sugestao.casasNumero),
      descricao: "",
      status: "disponivel",
    });
    setTipoSelecionado(tipoInicial);
    setDropdownTipoAberto(false);
    setNovoTipo("");
    setTamanhoSelecionado("UNICO");
    setNovoTamanho("");
    setModoCriacao("unitario");
    setAcaoLote("adicionar");
    setLote({
      codigoBase: sugestao.base,
      numeroInicial: String(sugestao.proximoNumero),
      casasNumero: String(sugestao.casasNumero),
    });
    setOperacaoLoteMisto({
      tipo: tipoInicial,
      tamanho: "UNICO",
      quantidade: "1",
      descricao: "",
      status: "disponivel",
    });
    setCarrinhoLoteMisto([]);
  }

  function abrirModalCriacao() {
    resetarFormularioCriacao();
    setOpenCreateModal(true);
  }

  function abrirModalSelecaoLote() {
    const sugestao = sugerirSequenciaCodigo(rows);
    const tipoInicial = opcoesTipo[0] ?? "todos";
    setLoteSelecao({
      tipo: tipoInicial,
      codigoBase: sugestao.base,
      numeroInicial: "1",
      numeroFinal: String(Math.max(10, sugestao.proximoNumero)),
      substituirSelecao: true,
    });
    setSelecionarLoteAberto(true);
  }

  function adicionarOperacaoLoteMisto() {
    const tipo = normalizarTipo(operacaoLoteMisto.tipo);
    const tamanho = normalizarTamanho(operacaoLoteMisto.tamanho);
    const quantidade = Number.parseInt(operacaoLoteMisto.quantidade, 10);
    const descricaoNormalizada = operacaoLoteMisto.descricao.trim();

    if (!tipo || !tamanho || !Number.isInteger(quantidade) || quantidade <= 0) {
      error("Preencha tipo, tamanho e quantidade validos");
      return;
    }

    if (quantidade > MAX_ITENS_LOTE_MISTO_OPERACAO) {
      error(`Quantidade maxima por operacao: ${MAX_ITENS_LOTE_MISTO_OPERACAO}`);
      return;
    }

    if (acaoLote === "remover") {
      const disponiveis = estoqueDisponivelPorTipoTamanho.get(chaveEstoque(tipo, tamanho))?.disponiveis ?? 0;
      const pendente = carrinhoLoteMisto
        .filter((item) =>
          item.acao === "remover"
          && normalizarTipoChave(item.tipo) === normalizarTipoChave(tipo)
          && normalizarTamanho(item.tamanho) === tamanho,
        )
        .reduce((acc, item) => acc + item.quantidade, 0);
      if (disponiveis <= 0) {
        error("Nao ha itens disponiveis para esse tipo e tamanho");
        return;
      }
      if (quantidade + pendente > disponiveis) {
        error(`Quantidade indisponivel: restam ${Math.max(disponiveis - pendente, 0)} para remover`);
        return;
      }
    }

    setCarrinhoLoteMisto((prev) => {
      const indiceExistente = prev.findIndex((item) => {
        if (item.acao !== acaoLote) return false;
        if (normalizarTipoChave(item.tipo) !== normalizarTipoChave(tipo)) return false;
        if (normalizarTamanho(item.tamanho) !== tamanho) return false;
        if (item.acao === "remover") return true;
        const descricaoItem = item.descricao.trim();
        return item.status === operacaoLoteMisto.status && descricaoItem === descricaoNormalizada;
      });

      if (indiceExistente >= 0) {
        return prev.map((item, index) =>
          index === indiceExistente
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item,
        );
      }

      return [
        ...prev,
        {
          id: gerarIdOperacaoLote(),
          acao: acaoLote,
          tipo,
          tamanho,
          quantidade,
          descricao: acaoLote === "adicionar" ? descricaoNormalizada : "",
          status: operacaoLoteMisto.status,
        },
      ];
    });

    setOperacaoLoteMisto((prev) => ({
      ...prev,
      quantidade: "1",
      descricao: "",
    }));
  }

  function removerOperacaoLoteMisto(id: string) {
    setCarrinhoLoteMisto((prev) => prev.filter((item) => item.id !== id));
  }

  function limparCarrinhoLoteMisto() {
    setCarrinhoLoteMisto([]);
  }

  async function criar() {
    const isUnitario = modoCriacao === "unitario";
    const isLote = modoCriacao === "lote";
    const baseLote = lote.codigoBase.trim();
    const numeroInicialLote = Number.parseInt(lote.numeroInicial, 10);
    const casasNumeroLote = Number.parseInt(lote.casasNumero, 10);

    if (isUnitario) {
      const tipoFinal = tipoSelecionado === NOVO_TIPO_OPTION
        ? normalizarTipo(novoTipo)
        : normalizarTipo(tipoSelecionado);
      const tamanhoFinal = tamanhoSelecionado === NOVO_TAMANHO_OPTION
        ? normalizarTamanho(novoTamanho)
        : normalizarTamanho(tamanhoSelecionado);
      const descricaoFinal = normalizarDescricaoOpcional(novo.descricao);

      if (!tipoFinal || !tamanhoFinal || !novo.codigo.trim()) {
        error("Preencha codigo, tipo e tamanho para criar item");
        return;
      }

      setCreating(true);
      try {
        await api.post(endpointBase, {
          codigo: novo.codigo.trim(),
          descricao: descricaoFinal,
          tipo: tipoFinal,
          tamanho: tamanhoFinal,
          status: novo.status,
        });
        success("Item criado com sucesso");
        resetarFormularioCriacao();
        setOpenCreateModal(false);
        await carregar();
        notificarAtualizacaoGlobal("kit");
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao criar item");
        await carregar();
      } finally {
        setCreating(false);
      }
      return;
    }

    if (!isLote) {
      return;
    }

    if (carrinhoLoteMisto.length === 0) {
      error("Adicione ao menos um item no lote");
      return;
    }

    if (acaoLote === "adicionar") {
      const loteNumericoValido = Number.isInteger(numeroInicialLote) && Number.isInteger(casasNumeroLote);
      if (!baseLote || !loteNumericoValido) {
        error("Preencha codigo base, numero inicial e casas do codigo");
        return;
      }
      if (numeroInicialLote < 0 || casasNumeroLote <= 0) {
        error("Numero inicial deve ser maior ou igual a zero e casas do codigo maior que zero");
        return;
      }
    }

    const totalAdicoes = carrinhoLoteMisto
      .filter((item) => item.acao === "adicionar")
      .reduce((acc, item) => acc + item.quantidade, 0);
    const totalRemocoes = carrinhoLoteMisto
      .filter((item) => item.acao === "remover")
      .reduce((acc, item) => acc + item.quantidade, 0);

    if (acaoLote === "adicionar") {
      if (totalAdicoes <= 0) {
        error("Nao ha itens para adicionar");
        return;
      }
      if (totalAdicoes > MAX_ITENS_LOTE_MISTO_TOTAL) {
        error(`Limite excedido: maximo de ${MAX_ITENS_LOTE_MISTO_TOTAL} itens por lote`);
        return;
      }
    } else {
      if (totalRemocoes <= 0) {
        error("Nao ha itens para remover");
        return;
      }
      if (totalRemocoes > MAX_ITENS_LOTE_MISTO_TOTAL) {
        error(`Limite excedido: maximo de ${MAX_ITENS_LOTE_MISTO_TOTAL} itens por lote`);
        return;
      }
    }

    const operacoesPayload = carrinhoLoteMisto.map((item) => ({
      acao: item.acao,
      tipo: normalizarTipo(item.tipo),
      tamanho: normalizarTamanho(item.tamanho),
      quantidade: item.quantidade,
      descricao: item.acao === "adicionar" ? normalizarDescricaoOpcional(item.descricao) : undefined,
      status: item.acao === "adicionar" ? item.status : undefined,
    }));

    setCreating(true);
    try {
      const response = await api.post<{
        resumo?: {
          adicionados?: number;
          removidos?: number;
          proximo_numero?: number;
        };
      }>(`${endpointBase}/lote-misto`, {
        codigo_base: acaoLote === "adicionar" ? baseLote : CODIGO_BASE_PADRAO,
        numero_inicial: acaoLote === "adicionar" ? numeroInicialLote : 0,
        casas_codigo: acaoLote === "adicionar" ? casasNumeroLote : CASAS_CODIGO_PADRAO,
        operacoes: operacoesPayload,
      });

      const adicionados = response?.resumo?.adicionados ?? 0;
      const removidos = response?.resumo?.removidos ?? 0;
      const proximoNumero = response?.resumo?.proximo_numero;
      if (acaoLote === "adicionar" && Number.isInteger(proximoNumero)) {
        setLote((prev) => ({ ...prev, numeroInicial: String(proximoNumero) }));
      }

      success(
        acaoLote === "adicionar"
          ? `${adicionados} item(ns) adicionados ao lote`
          : `${removidos} item(ns) removidos por quantidade`,
      );
      resetarFormularioCriacao();
      setOpenCreateModal(false);
      await carregar();
      notificarAtualizacaoGlobal("kit");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao processar lote");
      await carregar();
    } finally {
      setCreating(false);
    }
  }

  async function atualizarTipoEmMassa(tipoOrigem: string, tipoDestino: string) {
    const origemNormalizada = normalizarTipo(tipoOrigem);
    const destinoNormalizado = normalizarTipo(tipoDestino);

    if (!origemNormalizada || !destinoNormalizado) {
      error("Tipo inválido");
      return;
    }

    if (origemNormalizada.toLowerCase() === destinoNormalizado.toLowerCase()) {
      return;
    }

    const itensAlvo = rows.filter(
      (item) =>
        normalizarTipo(item.tipo).toLowerCase() === origemNormalizada.toLowerCase(),
    );

    if (itensAlvo.length === 0) {
      error("Nenhum item encontrado para esse tipo");
      return;
    }

    setGerenciandoTipo(true);
    try {
      for (const item of itensAlvo) {
        await api.put(`${endpointBase}/${encodeURIComponent(item.codigo)}`, {
          descricao: item.descricao ?? null,
          tipo: destinoNormalizado,
          tamanho: item.tamanho,
          status: item.status,
          status_ativo: item.statusAtivo,
        });
      }

      if (normalizarTipo(tipoSelecionado).toLowerCase() === origemNormalizada.toLowerCase()) {
        setTipoSelecionado(destinoNormalizado);
      }

      success(`Tipo atualizado em ${itensAlvo.length} item(ns)`);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar tipo");
      await carregar();
    } finally {
      setGerenciandoTipo(false);
    }
  }

  function atualizarCatalogoTipo(tipoOrigem: string, tipoDestino: string) {
    const origemChave = normalizarTipoChave(tipoOrigem);
    const destinoNormalizado = normalizarTipo(tipoDestino);
    if (!origemChave || !destinoNormalizado) {
      return;
    }

    setTiposBase((tiposAtuais) => {
      const tiposMapeados = tiposAtuais.map((tipo) =>
        normalizarTipoChave(tipo) === origemChave ? destinoNormalizado : normalizarTipo(tipo),
      );
      if (!tiposMapeados.some((tipo) => normalizarTipoChave(tipo) === normalizarTipoChave(destinoNormalizado))) {
        tiposMapeados.push(destinoNormalizado);
      }
      return deduplicarTiposMantendoOrdem(tiposMapeados);
    });
  }

  function removerTipoDoCatalogo(tipoRemovido: string) {
    const removidoChave = normalizarTipoChave(tipoRemovido);
    if (!removidoChave) {
      return;
    }

    setTiposBase((tiposAtuais) => {
      const filtrados = tiposAtuais.filter((tipo) => normalizarTipoChave(tipo) !== removidoChave);
      return filtrados.length > 0 ? deduplicarTiposMantendoOrdem(filtrados) : tiposAtuais;
    });
  }

  async function editarTipoEspecifico(tipoAlvo: string) {
    if (gerenciandoTipo || creating) {
      return;
    }

    const tipoAtual = normalizarTipo(tipoAlvo);
    const novoNomePrompt = window.prompt("Novo nome do tipo", tipoAtual);
    if (novoNomePrompt == null) {
      return;
    }
    const novoNome = normalizarTipo(novoNomePrompt);
    if (!novoNome) {
      error("Informe um nome valido para o tipo");
      return;
    }

    const conflito = opcoesTipo.some(
      (tipo) =>
        normalizarTipo(tipo).toLowerCase() === novoNome.toLowerCase() &&
        normalizarTipo(tipo).toLowerCase() !== tipoAtual.toLowerCase(),
    );
    if (conflito) {
      error("Já existe um tipo com esse nome");
      return;
    }

    const possuiItens = rows.some(
      (item) => normalizarTipoChave(item.tipo) === normalizarTipoChave(tipoAtual),
    );

    if (possuiItens) {
      await atualizarTipoEmMassa(tipoAtual, novoNome);
    } else {
      success(`Tipo "${tipoAtual}" atualizado para "${novoNome}"`);
    }

    atualizarCatalogoTipo(tipoAtual, novoNome);
    if (normalizarTipoChave(tipoSelecionado) === normalizarTipoChave(tipoAtual)) {
      setTipoSelecionado(novoNome);
    }
  }

  async function removerTipoEspecifico(tipoAlvo: string) {
    if (gerenciandoTipo || creating) {
      return;
    }

    const tipoAtual = normalizarTipo(tipoAlvo);
    const tipoAtualChave = normalizarTipoChave(tipoAtual);
    const candidatosFallback = opcoesTipo.filter((tipo) => normalizarTipoChave(tipo) !== tipoAtualChave);
    const tipoFallback =
      candidatosFallback.find((tipo) => normalizarTipoChave(tipo) === normalizarTipoChave(TIPO_FALLBACK_PADRAO))
      ?? candidatosFallback[0]
      ?? "";
    const possuiItens = rows.some((item) => normalizarTipoChave(item.tipo) === tipoAtualChave);

    if (possuiItens && !tipoFallback) {
      error("Não existe outro tipo para converter os itens desse grupo");
      return;
    }

    const confirmou = window.confirm(
      possuiItens
        ? `Remover o tipo "${tipoAtual}" da lista? Os itens desse tipo serao convertidos para "${tipoFallback}".`
        : `Remover o tipo "${tipoAtual}" da lista?`,
    );
    if (!confirmou) {
      return;
    }

    if (possuiItens) {
      await atualizarTipoEmMassa(tipoAtual, tipoFallback);
    } else {
      success(`Tipo "${tipoAtual}" removido da lista`);
    }

    removerTipoDoCatalogo(tipoAtual);
    if (normalizarTipoChave(tipoSelecionado) === tipoAtualChave) {
      setTipoSelecionado(tipoFallback || NOVO_TIPO_OPTION);
    }
  }

  async function apagar(row: ItemRow) {
    try {
      await api.del(`${endpointBase}/${encodeURIComponent(row.codigo)}`);
      success(`Item ${row.codigo} apagado`);
      await carregar();
      notificarAtualizacaoGlobal("kit");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar item");
    }
  }

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      const descricao = descricaoItemLabel(row.descricao);
      const matchTexto =
        !termo || [row.codigo, row.tipo, descricao, row.tamanho, row.status, row.statusAtivo ? "ativo" : "inativo"].join(" ").toLowerCase().includes(termo);
      const matchStatus = filtroStatusItem === "todos" || row.status === filtroStatusItem;
      const matchTipo = filtroTipo === "todos" || row.tipo === filtroTipo;
      const matchTamanho = filtroTamanho === "todos" || row.tamanho === filtroTamanho;
      const matchAtivo = filtroAtivo === "todos" || (filtroAtivo === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchStatus && matchTipo && matchTamanho && matchAtivo;
    });
  }, [rows, busca, filtroStatusItem, filtroTipo, filtroTamanho, filtroAtivo]);
  const colunasOrdenacaoItens = useMemo<DataTableColumn<ItemRow>[]>(() => [
    { key: "selecionar", title: "Selecionar", sortable: false },
    { key: "codigo", title: "Código", sortValue: (row) => row.codigo },
    { key: "tipo", title: "Tipo", sortValue: (row) => row.tipo },
    { key: "descricao", title: "Descrição", sortValue: (row) => descricaoItemLabel(row.descricao) },
    { key: "tamanho", title: "Tamanho", sortValue: (row) => row.tamanho },
    { key: "status", title: "Status", sortValue: (row) => row.status },
    { key: "ativo", title: "Ativo", sortValue: (row) => row.statusAtivo },
    { key: "acoes", title: "Acoes", sortable: false },
  ], []);
  const rowsOrdenadas = useMemo(
    () => sortDataTableRows(rowsFiltradas, colunasOrdenacaoItens, sortItens),
    [rowsFiltradas, colunasOrdenacaoItens, sortItens],
  );

  useEffect(() => {
    setPaginaItens(1);
  }, [busca, filtroStatusItem, filtroTipo, filtroTamanho, filtroAtivo]);

  const totalPaginasItens = Math.max(1, Math.ceil(rowsOrdenadas.length / ITENS_POR_PAGINA));
  const rowsPaginadas = useMemo(() => {
    const inicio = (paginaItens - 1) * ITENS_POR_PAGINA;
    return rowsOrdenadas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [rowsOrdenadas, paginaItens]);
  const codigosSelecionadosSet = useMemo(() => new Set(codigosSelecionados), [codigosSelecionados]);
  const codigosFiltradosSet = useMemo(() => new Set(rowsFiltradas.map((row) => row.codigo)), [rowsFiltradas]);
  const codigosSelecionadosFiltrados = useMemo(
    () => codigosSelecionados.filter((codigo) => codigosFiltradosSet.has(codigo)),
    [codigosSelecionados, codigosFiltradosSet],
  );
  const codigosPaginaAtual = useMemo(() => rowsPaginadas.map((row) => row.codigo), [rowsPaginadas]);
  const codigosLoteSelecaoPreview = useMemo(() => {
    const base = loteSelecao.codigoBase.trim();
    const numeroInicial = Number.parseInt(loteSelecao.numeroInicial, 10);
    const numeroFinal = Number.parseInt(loteSelecao.numeroFinal, 10);
    const tipoFiltro = loteSelecao.tipo;

    if (!base || !Number.isInteger(numeroInicial) || !Number.isInteger(numeroFinal) || numeroInicial < 0 || numeroFinal < numeroInicial) {
      return [] as string[];
    }

    return rowsFiltradas
      .filter((row) => {
        if (tipoFiltro !== "todos" && normalizarTipoChave(row.tipo) !== normalizarTipoChave(tipoFiltro)) {
          return false;
        }
        const numero = extrairNumeroCodigo(row.codigo, base);
        return numero !== null && numero >= numeroInicial && numero <= numeroFinal;
      })
      .map((row) => row.codigo);
  }, [rowsFiltradas, loteSelecao]);
  const todosSelecionadosNaPagina =
    codigosPaginaAtual.length > 0 && codigosPaginaAtual.every((codigo) => codigosSelecionadosSet.has(codigo));
  const algunsSelecionadosNaPagina = codigosPaginaAtual.some((codigo) => codigosSelecionadosSet.has(codigo));

  useEffect(() => {
    if (paginaItens > totalPaginasItens) {
      setPaginaItens(totalPaginasItens);
    }
  }, [paginaItens, totalPaginasItens]);

  useEffect(() => {
    const codigosDisponiveis = new Set(rows.map((row) => row.codigo));
    setCodigosSelecionados((prev) => prev.filter((codigo) => codigosDisponiveis.has(codigo)));
  }, [rows]);

  const inicioPaginaItens = rowsOrdenadas.length === 0 ? 0 : (paginaItens - 1) * ITENS_POR_PAGINA + 1;
  const fimPaginaItens = Math.min(paginaItens * ITENS_POR_PAGINA, rowsOrdenadas.length);

  const resumoStatus = useMemo(() => {
    return rowsFiltradas.reduce(
      (acc, row) => {
        if (row.status === "disponivel") acc.disponivel += 1;
        if (row.status === "emprestado") acc.emprestado += 1;
        if (row.status === "inativo") acc.inativo += 1;
        return acc;
      },
      { disponivel: 0, emprestado: 0, inativo: 0 },
    );
  }, [rowsFiltradas]);

  function alternarSelecao(codigo: string, checked: boolean) {
    setCodigosSelecionados((prev) => {
      if (checked) {
        if (prev.includes(codigo)) {
          return prev;
        }
        return [...prev, codigo];
      }
      return prev.filter((itemCodigo) => itemCodigo !== codigo);
    });
  }

  function alternarSelecaoPagina(checked: boolean) {
    setCodigosSelecionados((prev) => {
      if (checked) {
        const next = new Set(prev);
        for (const codigo of codigosPaginaAtual) {
          next.add(codigo);
        }
        return Array.from(next);
      }
      return prev.filter((codigo) => !codigosPaginaAtual.includes(codigo));
    });
  }

  async function apagarSelecionados(codigos: string[]) {
    if (codigos.length === 0) {
      error("Selecione ao menos um item para apagar");
      return;
    }

    setDeletingBulk(true);
    const codigosComSucesso: string[] = [];
    const codigosComFalha: string[] = [];

    try {
      for (const codigo of codigos) {
        try {
          await api.del(`${endpointBase}/${encodeURIComponent(codigo)}`);
          codigosComSucesso.push(codigo);
        } catch (_err) {
          codigosComFalha.push(codigo);
        }
      }

      if (codigosComSucesso.length > 0) {
        success(`${codigosComSucesso.length} item(ns) apagado(s)`);
      }
      if (codigosComFalha.length > 0) {
        error(`Falha ao apagar ${codigosComFalha.length} item(ns): ${resumirCodigos(codigosComFalha, 4)}`);
      }

      const codigosSucessoSet = new Set(codigosComSucesso);
      setCodigosSelecionados((prev) => prev.filter((codigo) => !codigosSucessoSet.has(codigo)));
      await carregar();
      if (codigosComSucesso.length > 0) {
        notificarAtualizacaoGlobal("kit");
      }
    } finally {
      setDeletingBulk(false);
    }
  }

  function selecionarLote() {
    const base = loteSelecao.codigoBase.trim();
    const numeroInicial = Number.parseInt(loteSelecao.numeroInicial, 10);
    const numeroFinal = Number.parseInt(loteSelecao.numeroFinal, 10);

    if (!base) {
      error("Informe o código base para selecionar o lote");
      return;
    }

    if (!Number.isInteger(numeroInicial) || !Number.isInteger(numeroFinal) || numeroInicial < 0 || numeroFinal < numeroInicial) {
      error("Informe uma faixa de numeração válida");
      return;
    }

    const selecionados = codigosLoteSelecaoPreview;
    if (selecionados.length === 0) {
      error("Nenhum item encontrado para os criterios informados");
      return;
    }

    setCodigosSelecionados((prev) => {
      if (loteSelecao.substituirSelecao) {
        return [...selecionados];
      }
      return Array.from(new Set([...prev, ...selecionados]));
    });

    success(`${selecionados.length} item(ns) selecionado(s) por lote`);
    setSelecionarLoteAberto(false);
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Itens</span>}
        icon={Package}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Disponíveis: {resumoStatus.disponivel}</span>
            <span>Emprestados: {resumoStatus.emprestado}</span>
            <span>Inativos: {resumoStatus.inativo}</span>
          </div>
        }
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={
          <FilterBar className={FILTRO_BAR_CLASS}>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar código, tipo, descrição ou tamanho"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-64`}
            />
            <Select value={filtroStatusItem} onValueChange={(value) => setFiltroStatusItem(value as "todos" | ItemStatus)}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Status do item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="disponivel">disponível</SelectItem>
                <SelectItem value="emprestado">emprestado</SelectItem>
                <SelectItem value="inativo">inativo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-44`}>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                {opcoesTipo.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroTamanho} onValueChange={setFiltroTamanho}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-36`}>
                <SelectValue placeholder="Tamanho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tamanhos</SelectItem>
                {opcoesTamanho.map((tamanho) => (
                  <SelectItem key={tamanho} value={tamanho}>
                    {tamanho}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroAtivo} onValueChange={(value) => setFiltroAtivo(value as "todos" | "ativo" | "inativo")}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-36`}>
                <SelectValue placeholder="Ativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="h-8 whitespace-nowrap rounded-lg border-border/70 px-2.5 text-[11px]"
              onClick={() => alternarSelecaoPagina(!todosSelecionadosNaPagina)}
              disabled={rowsPaginadas.length === 0}
            >
              {todosSelecionadosNaPagina ? "Desmarcar página" : "Selecionar página"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 whitespace-nowrap rounded-lg border-border/70 px-2.5 text-[11px]"
              onClick={abrirModalSelecaoLote}
              disabled={rowsFiltradas.length === 0}
            >
              Selecionar lote
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 whitespace-nowrap rounded-lg border-border/70 px-2.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setExcluirSelecionadosAberto(true)}
              disabled={codigosSelecionadosFiltrados.length === 0 || deletingBulk}
            >
              Apagar selecionados ({codigosSelecionadosFiltrados.length})
            </Button>
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg border-0 bg-primary text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-sky-500 hover:animate-pulse"
              onClick={abrirModalCriacao}
              aria-label="Novo item"
              title="Novo item"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <div className="hidden md:block">
          <DataTable
            columns={[
              {
                key: "selecionar",
                title: (
                  <div className="flex justify-center">
                    <Checkbox
                      checked={todosSelecionadosNaPagina || (algunsSelecionadosNaPagina && "indeterminate")}
                      onCheckedChange={(checked) => alternarSelecaoPagina(Boolean(checked))}
                      aria-label="Selecionar itens da página"
                    />
                  </div>
                ),
                align: "center",
                width: "6%",
                sortable: false,
              },
              {
                key: "codigo",
                title: "Código",
                width: "12%",
                className: "font-mono font-semibold",
                sortValue: (row) => row.codigo,
              },
              { key: "tipo", title: "Tipo", width: "15%", sortValue: (row) => row.tipo },
              { key: "descricao", title: "Descrição", width: "24%", sortValue: (row) => descricaoItemLabel(row.descricao) },
              { key: "tamanho", title: "Tamanho", align: "center", width: "11%", sortValue: (row) => row.tamanho },
              { key: "status", title: "Status", align: "center", width: "11%", sortValue: (row) => row.status },
              { key: "ativo", title: "Ativo", align: "center", width: "9%", sortValue: (row) => row.statusAtivo },
              { key: "acoes", title: "Acoes", align: "center", width: "12%" },
            ]}
            rows={rowsPaginadas}
            sortState={sortItens}
            onSortStateChange={setSortItens}
            getRowKey={(row) => row.codigo}
            onRowClick={(row) => {
              void openKit(row.codigo);
            }}
            loading={loading}
            emptyMessage="Nenhum item encontrado."
            minWidthClassName="min-w-[1040px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => (
              <>
                <td>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={codigosSelecionadosSet.has(row.codigo)}
                      onCheckedChange={(checked) => alternarSelecao(row.codigo, Boolean(checked))}
                      aria-label={`Selecionar item ${row.codigo}`}
                    />
                  </div>
                </td>
                <td>{row.codigo}</td>
                <td>{row.tipo}</td>
                <td className="max-w-0 truncate" title={descricaoItemLabel(row.descricao)}>{descricaoItemLabel(row.descricao)}</td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone="neutral" className="text-[10px]">{row.tamanho}</StatusPill>
                  </div>
                </td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone="info" className="text-[10px]">{row.status}</StatusPill>
                  </div>
                </td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                      {row.statusAtivo ? "ativo" : "inativo"}
                    </StatusPill>
                  </div>
                </td>
                <td>
                  <TableActions className="justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => {
                        void openKit(row.codigo);
                      }}
                      aria-label={`Editar item ${row.codigo}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setItemParaExcluir(row)}
                      aria-label={`Apagar item ${row.codigo}`}
                      title="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableActions>
                </td>
              </>
            )}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`item-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : rowsFiltradas.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhum item encontrado." />
            </div>
          ) : (
            rowsPaginadas.map((row) => (
              <article
                key={row.codigo}
                className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={codigosSelecionadosSet.has(row.codigo)}
                      onCheckedChange={(checked) => alternarSelecao(row.codigo, Boolean(checked))}
                      aria-label={`Selecionar item ${row.codigo}`}
                    />
                    <button
                      type="button"
                      className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        void openKit(row.codigo);
                      }}
                    >
                      {row.codigo}
                    </button>
                  </div>
                  <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                    {row.statusAtivo ? "ativo" : "inativo"}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{descricaoItemLabel(row.descricao)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusPill tone="neutral" className="text-[10px]">{row.tipo}</StatusPill>
                  <StatusPill tone="neutral" className="text-[10px]">{row.tamanho}</StatusPill>
                  <StatusPill tone="info" className="text-[10px]">{row.status}</StatusPill>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => {
                      void openKit(row.codigo);
                    }}
                    aria-label={`Editar item ${row.codigo}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                    onClick={() => setItemParaExcluir(row)}
                    aria-label={`Apagar item ${row.codigo}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[10px] text-muted-foreground">
            <p>{inicioPaginaItens}-{fimPaginaItens} de {rowsFiltradas.length} | Página {paginaItens} de {totalPaginasItens}</p>
            <p>Selecionados nos filtros: {codigosSelecionadosFiltrados.length}</p>
          </div>
          <div className="flex min-w-[220px] justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaItens((paginaAtual) => Math.max(1, paginaAtual - 1))}
              disabled={paginaItens === 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaItens((paginaAtual) => Math.min(totalPaginasItens, paginaAtual + 1))}
              disabled={paginaItens === totalPaginasItens}
            >
              Próxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={selecionarLoteAberto}
        onClose={() => setSelecionarLoteAberto(false)}
        title="Selecionar Itens por Lote"
        description="Escolha tipo, código base e faixa de numeração para marcar itens automaticamente."
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Tipo" htmlFor="selecionar-lote-tipo">
              <Select
                value={loteSelecao.tipo}
                onValueChange={(value) => setLoteSelecao((prev) => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger id="selecionar-lote-tipo" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  {opcoesTipo.map((tipo) => (
                    <SelectItem key={`lote-selecao-${tipo}`} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Código base" htmlFor="selecionar-lote-base">
              <Input
                id="selecionar-lote-base"
                value={loteSelecao.codigoBase}
                onChange={(event) => setLoteSelecao((prev) => ({ ...prev, codigoBase: event.target.value }))}
                placeholder="Ex.: KIT-"
                className="h-9 text-xs"
              />
            </FormField>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Numero inicial" htmlFor="selecionar-lote-inicial">
              <Input
                id="selecionar-lote-inicial"
                type="number"
                min={0}
                value={loteSelecao.numeroInicial}
                onChange={(event) => setLoteSelecao((prev) => ({ ...prev, numeroInicial: event.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Numero final" htmlFor="selecionar-lote-final">
              <Input
                id="selecionar-lote-final"
                type="number"
                min={0}
                value={loteSelecao.numeroFinal}
                onChange={(event) => setLoteSelecao((prev) => ({ ...prev, numeroFinal: event.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={loteSelecao.substituirSelecao}
              onCheckedChange={(checked) => {
                setLoteSelecao((prev) => ({ ...prev, substituirSelecao: Boolean(checked) }));
              }}
            />
            Substituir selecao atual
          </label>

          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
            <p>Encontrados: {codigosLoteSelecaoPreview.length} item(ns)</p>
            {codigosLoteSelecaoPreview.length > 0 ? (
              <p>
                Prévia: <span className="font-mono text-foreground">{resumirCodigos(codigosLoteSelecaoPreview, 8)}</span>
              </p>
            ) : (
              <p>Ajuste os criterios para gerar uma previa.</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setSelecionarLoteAberto(false)}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={selecionarLote}>
              Selecionar lote
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title={
          modoCriacao === "lote"
            ? acaoLote === "adicionar"
              ? "Criar lote de itens"
              : "Remover itens por quantidade"
            : "Novo item"
        }
        description={
          modoCriacao === "lote"
            ? acaoLote === "adicionar"
              ? "Adicione varias linhas no lote e crie tudo de uma vez."
              : "Selecione tipo, tamanho e quantidade para baixa automatica."
            : "Cadastre um item individual."
        }
        maxWidthClassName="max-w-5xl"
      >
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-2/45 p-3 sm:p-4">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <FormField label="Modo de criacao" htmlFor="novo-item-modo-select">
                <Select value={modoCriacao} onValueChange={(value) => setModoCriacao(value as ModoCriacaoItem)}>
                  <SelectTrigger id="novo-item-modo-select" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unitario">Item unico</SelectItem>
                    <SelectItem value="lote">Lote</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {modoCriacao === "lote" && (
                <FormField label="Acao do lote" htmlFor="novo-item-lote-acao">
                  <Select value={acaoLote} onValueChange={(value) => setAcaoLote(value as AcaoLote)}>
                    <SelectTrigger id="novo-item-lote-acao" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adicionar">Adicionar varios itens</SelectItem>
                      <SelectItem value="remover">Remover por quantidade</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </div>

            {modoCriacao === "lote" && acaoLote === "adicionar" && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Padrao de codigo</p>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-12">
                  <FormField label="Codigo base" htmlFor="novo-item-lote-base" className="xl:col-span-4">
                    <Input
                      id="novo-item-lote-base"
                      value={lote.codigoBase}
                      onChange={(e) => setLote((prev) => ({ ...prev, codigoBase: e.target.value }))}
                      placeholder="Ex.: KIT-"
                      className="h-9 text-xs"
                    />
                  </FormField>
                  <FormField label="Numero inicial" htmlFor="novo-item-lote-inicial" className="xl:col-span-4">
                    <Input
                      id="novo-item-lote-inicial"
                      type="number"
                      min={0}
                      value={lote.numeroInicial}
                      onChange={(e) => setLote((prev) => ({ ...prev, numeroInicial: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </FormField>
                  <FormField label="Casas do codigo" htmlFor="novo-item-lote-casas" className="xl:col-span-4">
                    <Input
                      id="novo-item-lote-casas"
                      type="number"
                      min={1}
                      max={10}
                      value={lote.casasNumero}
                      onChange={(e) => setLote((prev) => ({ ...prev, casasNumero: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </FormField>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
                  {codigosLotePreview.length > 0 ? (
                    <p>
                      Previa dos codigos: <span className="font-mono text-foreground">{resumirCodigos(codigosLotePreview)}</span>
                      {resumoCarrinhoLoteMisto.adicionados > codigosLotePreview.length ? " ..." : ""}
                    </p>
                  ) : (
                    <p>Monte o carrinho de adicao para visualizar os codigos que serao gerados.</p>
                  )}
                </div>
              </div>
            )}

            {modoCriacao === "lote" && acaoLote === "remover" && (
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
                <p>Estoque disponivel carregado automaticamente: {opcoesRemocaoDisponiveis.length} combinacao(oes) tipo+tamanho.</p>
                {opcoesRemocaoDisponiveis.length === 0 ? (
                  <p className="mt-0.5">Nao ha itens disponiveis para remocao por quantidade.</p>
                ) : (
                  <p className="mt-0.5">
                    Exemplo: {opcoesRemocaoDisponiveis.slice(0, 6).map((item) => `${item.tipo}/${item.tamanho} (${item.disponiveis})`).join(", ")}
                    {opcoesRemocaoDisponiveis.length > 6 ? " ..." : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          {modoCriacao === "lote" ? (
            <>
              <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-2/45 p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {acaoLote === "adicionar" ? "Adicionar linha no lote" : "Remocao por quantidade"}
                </p>

                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-12">
                  <FormField label="Tipo" htmlFor="lote-tipo" className="xl:col-span-4">
                    <Select
                      value={operacaoLoteMisto.tipo}
                      onValueChange={(value) => setOperacaoLoteMisto((prev) => ({ ...prev, tipo: value }))}
                    >
                      <SelectTrigger id="lote-tipo" className="h-9 text-xs">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(acaoLote === "remover" ? tiposDisponiveisRemocao : opcoesTipo).map((tipo) => (
                          <SelectItem key={`lote-tipo-${tipo}`} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Tamanho" htmlFor="lote-tamanho" className="xl:col-span-3">
                    <Select
                      value={operacaoLoteMisto.tamanho}
                      onValueChange={(value) => setOperacaoLoteMisto((prev) => ({ ...prev, tamanho: value }))}
                    >
                      <SelectTrigger id="lote-tamanho" className="h-9 text-xs">
                        <SelectValue placeholder="Tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        {(acaoLote === "remover" ? tamanhosDisponiveisRemocao : opcoesTamanho).map((tamanho) => (
                          <SelectItem key={`lote-tamanho-${tamanho}`} value={tamanho}>
                            {tamanho}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Quantidade" htmlFor="lote-quantidade" className="xl:col-span-3">
                    <Input
                      id="lote-quantidade"
                      type="number"
                      min={1}
                      max={acaoLote === "adicionar" ? MAX_ITENS_LOTE_MISTO_OPERACAO : Math.max(disponiveisSelecionados - quantidadePendenteRemocaoSelecionada, 1)}
                      value={operacaoLoteMisto.quantidade}
                      onChange={(e) => setOperacaoLoteMisto((prev) => ({ ...prev, quantidade: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </FormField>

                  <div className="hidden xl:block xl:col-span-2" />

                  {acaoLote === "adicionar" ? (
                    <>
                      <FormField label="Descricao (opcional)" htmlFor="lote-descricao" className="sm:col-span-2 xl:col-span-8">
                        <Input
                          id="lote-descricao"
                          value={operacaoLoteMisto.descricao}
                          onChange={(e) => setOperacaoLoteMisto((prev) => ({ ...prev, descricao: e.target.value }))}
                          placeholder="Descricao"
                          className="h-9 text-xs"
                        />
                      </FormField>
                      <FormField label="Status" htmlFor="lote-status" className="xl:col-span-4">
                        <Select
                          value={operacaoLoteMisto.status}
                          onValueChange={(value) => setOperacaoLoteMisto((prev) => ({ ...prev, status: value as ItemStatus }))}
                        >
                          <SelectTrigger id="lote-status" className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponivel">disponivel</SelectItem>
                            <SelectItem value="emprestado">emprestado</SelectItem>
                            <SelectItem value="inativo">inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>
                    </>
                  ) : (
                    <div className="sm:col-span-2 xl:col-span-12 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                      Disponiveis para esse filtro: {disponiveisSelecionados} | Ja no carrinho para remover: {quantidadePendenteRemocaoSelecionada}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => {
                      setOperacaoLoteMisto((prev) => ({
                        ...prev,
                        quantidade: "1",
                        descricao: "",
                        status: "disponivel",
                      }));
                    }}
                    disabled={creating}
                  >
                    Limpar formulario
                  </Button>
                  <Button
                    type="button"
                    className="h-9 text-xs"
                    onClick={adicionarOperacaoLoteMisto}
                    disabled={creating || (acaoLote === "remover" && opcoesRemocaoDisponiveis.length === 0)}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar no lote
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-2/45 p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Itens no lote</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={limparCarrinhoLoteMisto}
                    disabled={carrinhoLoteMisto.length === 0 || creating}
                  >
                    Limpar lote
                  </Button>
                </div>

                {carrinhoLoteMisto.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-3 text-xs text-muted-foreground">
                    Nenhum item adicionado no lote ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {carrinhoLoteMisto.map((item, index) => (
                      <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 text-muted-foreground">
                            <p className="font-medium text-foreground">
                              {index + 1}. {item.acao === "adicionar" ? "Adicionar" : "Remover"} {item.quantidade} item(ns)
                            </p>
                            <p>{item.tipo} | {item.tamanho}</p>
                            {item.acao === "adicionar" && (
                              <p>
                                Status: {item.status}
                                {normalizarDescricaoOpcional(item.descricao) ? ` | ${item.descricao.trim()}` : ""}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/12 hover:text-destructive"
                            onClick={() => removerOperacaoLoteMisto(item.id)}
                            aria-label={`Remover linha ${index + 1}`}
                            title="Remover linha"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3 rounded-2xl border border-border/65 bg-surface-2/45 p-3 sm:p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dados do item</p>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-12">
                <FormField label="Codigo" htmlFor="novo-item-codigo" className="xl:col-span-4">
                  <Input
                    id="novo-item-codigo"
                    value={novo.codigo}
                    onChange={(e) => setNovo((p) => ({ ...p, codigo: e.target.value }))}
                    placeholder="Codigo"
                    className="h-9 text-xs"
                  />
                </FormField>
                <FormField label="Tipo" htmlFor="novo-item-tipo-select" className="sm:col-span-2 xl:col-span-4">
                  <DropdownMenu open={dropdownTipoAberto} onOpenChange={setDropdownTipoAberto} modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        id="novo-item-tipo-select"
                        type="button"
                        variant="outline"
                        className="group h-9 w-full justify-between rounded-xl border-input bg-surface-2 px-3.5 text-xs font-normal shadow-sm hover:border-primary/40 hover:bg-surface-2"
                        disabled={gerenciandoTipo || creating}
                      >
                        <span className={cn("truncate", tipoSelecionado === NOVO_TIPO_OPTION && "text-muted-foreground")}>
                          {tipoSelecionado === NOVO_TIPO_OPTION ? "Criar novo tipo..." : tipoSelecionado}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            dropdownTipoAberto && "rotate-180",
                          )}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] p-1"
                    >
                      {opcoesTipo.map((tipo) => {
                        const selecionado = normalizarTipoChave(tipoSelecionado) === normalizarTipoChave(tipo);
                        return (
                          <DropdownMenuItem
                            key={tipo}
                            className="gap-1.5 px-2 py-1.5 text-xs"
                            onSelect={(event) => {
                              event.preventDefault();
                              setTipoSelecionado(tipo);
                              setDropdownTipoAberto(false);
                            }}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center text-primary/80">
                              {selecionado ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{tipo}</span>
                            <div className="ml-1 flex items-center gap-0.5">
                              <button
                                type="button"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setDropdownTipoAberto(false);
                                  void editarTipoEspecifico(tipo);
                                }}
                                aria-label={`Editar tipo ${tipo}`}
                                title={`Editar ${tipo}`}
                                disabled={gerenciandoTipo || creating}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setDropdownTipoAberto(false);
                                  void removerTipoEspecifico(tipo);
                                }}
                                aria-label={`Remover tipo ${tipo}`}
                                title={`Remover ${tipo}`}
                                disabled={gerenciandoTipo || creating}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 px-2.5 py-1.5 text-xs"
                        onSelect={(event) => {
                          event.preventDefault();
                          setTipoSelecionado(NOVO_TIPO_OPTION);
                          setDropdownTipoAberto(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 text-primary/80" />
                        Criar novo tipo...
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FormField>
                <FormField label="Descricao (opcional)" htmlFor="novo-item-descricao" className="sm:col-span-2 xl:col-span-4">
                  <Input
                    id="novo-item-descricao"
                    value={novo.descricao}
                    onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descricao"
                    className="h-9 text-xs"
                  />
                </FormField>
                <FormField label="Tamanho" htmlFor="novo-item-tamanho-select" className="xl:col-span-2">
                  <Select value={tamanhoSelecionado} onValueChange={setTamanhoSelecionado}>
                    <SelectTrigger id="novo-item-tamanho-select" className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesTamanho.map((tamanho) => (
                        <SelectItem key={tamanho} value={tamanho}>
                          {tamanho}
                        </SelectItem>
                      ))}
                      <SelectItem value={NOVO_TAMANHO_OPTION}>Criar novo tamanho...</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Status" htmlFor="novo-item-status" className="xl:col-span-2">
                  <Select
                    value={novo.status}
                    onValueChange={(value) => setNovo((p) => ({ ...p, status: value as ItemStatus }))}
                  >
                    <SelectTrigger id="novo-item-status" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">disponivel</SelectItem>
                      <SelectItem value="emprestado">emprestado</SelectItem>
                      <SelectItem value="inativo">inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                {tipoSelecionado === NOVO_TIPO_OPTION && (
                  <FormField label="Novo tipo" htmlFor="novo-item-tipo-custom" className="sm:col-span-2 xl:col-span-6">
                    <Input
                      id="novo-item-tipo-custom"
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value)}
                      placeholder="Ex.: Kit roupa cirurgico"
                      maxLength={100}
                      className="h-9 text-xs"
                    />
                  </FormField>
                )}
                {tamanhoSelecionado === NOVO_TAMANHO_OPTION && (
                  <FormField label="Novo tamanho" htmlFor="novo-item-tamanho-custom" className="sm:col-span-2 xl:col-span-6">
                    <Input
                      id="novo-item-tamanho-custom"
                      value={novoTamanho}
                      onChange={(e) => setNovoTamanho(e.target.value.toUpperCase())}
                      placeholder="Ex.: EXG"
                      maxLength={20}
                      className="h-9 text-xs"
                    />
                  </FormField>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setOpenCreateModal(false)}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={criar} loading={creating}>
              <Plus className="h-4 w-4" />
              {modoCriacao === "lote"
                ? acaoLote === "adicionar"
                  ? "Criar lote"
                  : "Remover por quantidade"
                : "Criar item"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(itemParaExcluir)}
        onClose={() => setItemParaExcluir(null)}
        title="Apagar item"
        description={
          itemParaExcluir
            ? `Tem certeza que deseja apagar o item ${itemParaExcluir.codigo}?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!itemParaExcluir) return;
          await apagar(itemParaExcluir);
          setItemParaExcluir(null);
        }}
      />

      <ConfirmDialog
        open={excluirSelecionadosAberto}
        onClose={() => setExcluirSelecionadosAberto(false)}
        title="Apagar itens selecionados"
        description={
          codigosSelecionadosFiltrados.length > 0
            ? `Tem certeza que deseja apagar ${codigosSelecionadosFiltrados.length} item(ns) selecionado(s)?`
            : "Nenhum item selecionado."
        }
        confirmLabel="Apagar selecionados"
        onConfirm={async () => {
          await apagarSelecionados(codigosSelecionadosFiltrados);
          setExcluirSelecionadosAberto(false);
        }}
      />
    </div>
  );
}




