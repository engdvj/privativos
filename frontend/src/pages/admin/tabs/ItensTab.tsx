import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TableActions } from "@/components/ui/table-actions";
import { useToast } from "@/components/ui/use-toast";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import type { ItemRow, ItemStatus } from "../types";

const NOVO_TAMANHO_OPTION = "__novo_tamanho__";
const NOVO_TIPO_OPTION = "__novo_tipo__";
const TAMANHOS_PADRAO = ["UNICO", "PP", "P", "M", "G", "GG", "XG"];
const TIPOS_PADRAO = ["Kit roupa", "Lencol", "Sem tipo"];
const CODIGO_BASE_PADRAO = "KIT-";
const CASAS_CODIGO_PADRAO = 3;
const MAX_ITENS_LOTE = 200;
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

function normalizarTamanho(valor: string) {
  return valor.trim().toUpperCase();
}

function normalizarTipo(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
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

type ModoCriacaoItem = "unitario" | "lote";

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

function resumirCodigos(codigos: string[], limite = 6) {
  if (codigos.length <= limite) {
    return codigos.join(", ");
  }
  const primeiros = codigos.slice(0, limite).join(", ");
  return `${primeiros} ... (+${codigos.length - limite})`;
}

export function ItensTab() {
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
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemRow | null>(null);
  const { success, error } = useToast();
  const { openKit } = useGlobalDetail();

  const [novo, setNovo] = useState({
    codigo: "",
    descricao: "",
    status: "disponivel" as ItemStatus,
  });
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_PADRAO[0]);
  const [novoTipo, setNovoTipo] = useState("");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("UNICO");
  const [novoTamanho, setNovoTamanho] = useState("");
  const [modoCriacao, setModoCriacao] = useState<ModoCriacaoItem>("unitario");
  const [lote, setLote] = useState({
    codigoBase: CODIGO_BASE_PADRAO,
    numeroInicial: "1",
    quantidade: "1",
    casasNumero: String(CASAS_CODIGO_PADRAO),
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ItemRow[]>("/admin/itens?include_inactive=true");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  }, [error]);

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
  const opcoesTipo = useMemo(() => montarOpcoesTipo(rows.map((row) => row.tipo)), [rows]);

  const codigosLotePreview = useMemo(() => {
    if (modoCriacao !== "lote") {
      return [];
    }

    const base = lote.codigoBase.trim();
    const numeroInicial = Number.parseInt(lote.numeroInicial, 10);
    const quantidade = Number.parseInt(lote.quantidade, 10);
    const casasNumero = Number.parseInt(lote.casasNumero, 10);

    if (!base || !Number.isInteger(numeroInicial) || !Number.isInteger(quantidade) || !Number.isInteger(casasNumero)) {
      return [];
    }

    if (numeroInicial < 0 || quantidade <= 0 || casasNumero <= 0) {
      return [];
    }

    const previewQuantidade = Math.min(quantidade, 20);
    return gerarCodigosLote({
      base,
      numeroInicial,
      quantidade: previewQuantidade,
      casasNumero,
    });
  }, [modoCriacao, lote]);

  function resetarFormularioCriacao() {
    const sugestao = sugerirSequenciaCodigo(rows);

    setNovo({
      codigo: gerarCodigoSequencial(sugestao.base, sugestao.proximoNumero, sugestao.casasNumero),
      descricao: "",
      status: "disponivel",
    });
    setTipoSelecionado(TIPOS_PADRAO[0]);
    setNovoTipo("");
    setTamanhoSelecionado("UNICO");
    setNovoTamanho("");
    setModoCriacao("unitario");
    setLote({
      codigoBase: sugestao.base,
      numeroInicial: String(sugestao.proximoNumero),
      quantidade: "1",
      casasNumero: String(sugestao.casasNumero),
    });
  }

  function abrirModalCriacao() {
    resetarFormularioCriacao();
    setOpenCreateModal(true);
  }

  async function criar() {
    const tipoFinal = tipoSelecionado === NOVO_TIPO_OPTION
      ? normalizarTipo(novoTipo)
      : normalizarTipo(tipoSelecionado);
    const tamanhoFinal = tamanhoSelecionado === NOVO_TAMANHO_OPTION
      ? normalizarTamanho(novoTamanho)
      : normalizarTamanho(tamanhoSelecionado);

    if (!tipoFinal || !tamanhoFinal) {
      error("Preencha tipo e tamanho para criar item");
      return;
    }

    const descricaoFinal = novo.descricao.trim() || null;

    if (modoCriacao === "unitario" && !novo.codigo.trim()) {
      error("Preencha codigo, tipo e tamanho para criar item");
      return;
    }

    const isLote = modoCriacao === "lote";
    const baseLote = lote.codigoBase.trim();
    const numeroInicialLote = Number.parseInt(lote.numeroInicial, 10);
    const quantidadeLote = Number.parseInt(lote.quantidade, 10);
    const casasNumeroLote = Number.parseInt(lote.casasNumero, 10);

    if (isLote) {
      if (!baseLote || !Number.isInteger(numeroInicialLote) || !Number.isInteger(quantidadeLote) || !Number.isInteger(casasNumeroLote)) {
        error("Preencha codigo base, numero inicial, quantidade e casas do codigo");
        return;
      }

      if (numeroInicialLote < 0 || quantidadeLote <= 0 || casasNumeroLote <= 0) {
        error("Numero inicial deve ser maior ou igual a zero; quantidade e casas do codigo devem ser maiores que zero");
        return;
      }

      if (quantidadeLote > MAX_ITENS_LOTE) {
        error(`Quantidade maxima por lote: ${MAX_ITENS_LOTE} itens`);
        return;
      }
    }

    setCreating(true);
    try {
      if (!isLote) {
        await api.post("/admin/itens", {
          codigo: novo.codigo.trim(),
          descricao: descricaoFinal,
          tipo: tipoFinal,
          tamanho: tamanhoFinal,
          status: novo.status,
        });
        success("Item criado com sucesso");
      } else {
        const codigos = gerarCodigosLote({
          base: baseLote,
          numeroInicial: numeroInicialLote,
          quantidade: quantidadeLote,
          casasNumero: casasNumeroLote,
        });

        const codigosNormalizados = codigos.map((codigo) => codigo.toLowerCase());
        const codigosDuplicadosNoLote = codigos.filter(
          (_codigo, index) => codigosNormalizados.indexOf(codigosNormalizados[index]) !== index,
        );
        if (codigosDuplicadosNoLote.length > 0) {
          error(`Lote invalido: codigos duplicados (${resumirCodigos([...new Set(codigosDuplicadosNoLote)])})`);
          return;
        }

        const codigosExistentes = new Set(rows.map((row) => row.codigo.toLowerCase()));
        const codigosConflitantes = codigos.filter((codigo) => codigosExistentes.has(codigo.toLowerCase()));
        if (codigosConflitantes.length > 0) {
          error(`Ja existem codigos cadastrados neste lote: ${resumirCodigos(codigosConflitantes)}`);
          return;
        }

        const codigosCriados: string[] = [];
        for (const codigo of codigos) {
          try {
            await api.post("/admin/itens", {
              codigo,
              descricao: descricaoFinal,
              tipo: tipoFinal,
              tamanho: tamanhoFinal,
              status: novo.status,
            });
            codigosCriados.push(codigo);
          } catch (err) {
            const mensagemBase = err instanceof Error ? err.message : "Erro ao criar item";
            const sufixo = codigosCriados.length > 0
              ? ` (${codigosCriados.length} itens criados antes da falha)`
              : "";
            throw new Error(`${mensagemBase}${sufixo}`);
          }
        }

        success(`${codigosCriados.length} itens criados com sucesso`);
      }

      resetarFormularioCriacao();
      setOpenCreateModal(false);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar item");
      await carregar();
    } finally {
      setCreating(false);
    }
  }

  async function apagar(row: ItemRow) {
    try {
      await api.del(`/admin/itens/${row.codigo}`);
      success(`Item ${row.codigo} apagado`);
      await carregar();
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

  useEffect(() => {
    setPaginaItens(1);
  }, [busca, filtroStatusItem, filtroTipo, filtroTamanho, filtroAtivo]);

  const totalPaginasItens = Math.max(1, Math.ceil(rowsFiltradas.length / ITENS_POR_PAGINA));
  const rowsPaginadas = useMemo(() => {
    const inicio = (paginaItens - 1) * ITENS_POR_PAGINA;
    return rowsFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [rowsFiltradas, paginaItens]);

  useEffect(() => {
    if (paginaItens > totalPaginasItens) {
      setPaginaItens(totalPaginasItens);
    }
  }, [paginaItens, totalPaginasItens]);

  const inicioPaginaItens = rowsFiltradas.length === 0 ? 0 : (paginaItens - 1) * ITENS_POR_PAGINA + 1;
  const fimPaginaItens = Math.min(paginaItens * ITENS_POR_PAGINA, rowsFiltradas.length);

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

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Itens</span>}
        icon={Package}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Disponiveis: {resumoStatus.disponivel}</span>
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
              placeholder="Buscar codigo, tipo, descricao ou tamanho"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-64`}
            />
            <Select value={filtroStatusItem} onValueChange={(value) => setFiltroStatusItem(value as "todos" | ItemStatus)}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Status do item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="disponivel">disponivel</SelectItem>
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
                key: "codigo",
                title: "Codigo",
                width: "14%",
                className: "font-mono font-semibold",
                sortValue: (row) => row.codigo,
              },
              { key: "tipo", title: "Tipo", width: "16%", sortValue: (row) => row.tipo },
              { key: "descricao", title: "Descricao", width: "26%", sortValue: (row) => descricaoItemLabel(row.descricao) },
              { key: "tamanho", title: "Tamanho", align: "center", width: "12%", sortValue: (row) => row.tamanho },
              { key: "status", title: "Status", align: "center", width: "12%", sortValue: (row) => row.status },
              { key: "ativo", title: "Ativo", align: "center", width: "10%", sortValue: (row) => row.statusAtivo },
              { key: "acoes", title: "Acoes", align: "center", width: "10%" },
            ]}
            rows={rowsPaginadas}
            getRowKey={(row) => row.codigo}
            onRowClick={(row) => {
              void openKit(row.codigo);
            }}
            loading={loading}
            emptyMessage="Nenhum item encontrado."
            minWidthClassName="min-w-[980px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => (
              <>
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
                  <button
                    type="button"
                    className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      void openKit(row.codigo);
                    }}
                  >
                    {row.codigo}
                  </button>
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
          <p className="text-[10px] text-muted-foreground">
            {inicioPaginaItens}-{fimPaginaItens} de {rowsFiltradas.length} | Pagina {paginaItens} de {totalPaginasItens}
          </p>
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
              Proxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title={modoCriacao === "lote" ? "Novo Lote de Itens" : "Novo Item"}
        description={
          modoCriacao === "lote"
            ? "Use um codigo base e uma quantidade para gerar codigos em sequencia."
            : "Cadastre codigo, tipo, descricao opcional, tamanho e status inicial."
        }
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Modo de criacao" htmlFor="novo-item-modo">
              <Select value={modoCriacao} onValueChange={(value) => setModoCriacao(value as ModoCriacaoItem)}>
                <SelectTrigger id="novo-item-modo" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unitario">Unitario</SelectItem>
                  <SelectItem value="lote">Lote</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {modoCriacao === "unitario" ? (
              <FormField label="Codigo" htmlFor="novo-item-codigo">
                <Input
                  id="novo-item-codigo"
                  value={novo.codigo}
                  onChange={(e) => setNovo((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="Codigo"
                  className="h-9 text-xs"
                />
              </FormField>
            ) : (
              <>
                <FormField label="Codigo base" htmlFor="novo-item-lote-base">
                  <Input
                    id="novo-item-lote-base"
                    value={lote.codigoBase}
                    onChange={(e) => setLote((prev) => ({ ...prev, codigoBase: e.target.value }))}
                    placeholder="Ex.: KIT-"
                    className="h-9 text-xs"
                  />
                </FormField>
                <FormField label="Numero inicial" htmlFor="novo-item-lote-inicial">
                  <Input
                    id="novo-item-lote-inicial"
                    type="number"
                    min={0}
                    value={lote.numeroInicial}
                    onChange={(e) => setLote((prev) => ({ ...prev, numeroInicial: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </FormField>
                <FormField label="Quantidade" htmlFor="novo-item-lote-quantidade">
                  <Input
                    id="novo-item-lote-quantidade"
                    type="number"
                    min={1}
                    max={MAX_ITENS_LOTE}
                    value={lote.quantidade}
                    onChange={(e) => setLote((prev) => ({ ...prev, quantidade: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </FormField>
                <FormField label="Casas do codigo" htmlFor="novo-item-lote-casas">
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
              </>
            )}
          </div>

          {modoCriacao === "lote" && (
            <div className="rounded-xl border border-border/70 bg-surface-2/60 px-3 py-2.5 text-xs text-muted-foreground">
              {codigosLotePreview.length > 0 ? (
                <p>
                  Previa de codigos: <span className="font-mono text-foreground">{resumirCodigos(codigosLotePreview)}</span>
                  {Number.parseInt(lote.quantidade, 10) > codigosLotePreview.length ? " ..." : ""}
                </p>
              ) : (
                <p>Preencha o padrao do lote para gerar a previa de codigos.</p>
              )}
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Tipo" htmlFor="novo-item-tipo-select">
              <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                <SelectTrigger id="novo-item-tipo-select" className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesTipo.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                  <SelectItem value={NOVO_TIPO_OPTION}>Criar novo tipo...</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Descricao (opcional)" htmlFor="novo-item-descricao" className="sm:col-span-2 xl:col-span-1">
              <Input
                id="novo-item-descricao"
                value={novo.descricao}
                onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Descricao"
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Tamanho" htmlFor="novo-item-tamanho-select">
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
            <FormField label="Status" htmlFor="novo-item-status">
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
              <FormField label="Novo tipo" htmlFor="novo-item-tipo-custom" className="sm:col-span-2 xl:col-span-2">
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
              <FormField label="Novo tamanho" htmlFor="novo-item-tamanho-custom" className="sm:col-span-2 xl:col-span-2">
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setOpenCreateModal(false)}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={criar} loading={creating}>
              <Plus className="h-4 w-4" />
              {modoCriacao === "lote" ? "Criar lote" : "Criar"}
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
    </div>
  );
}
