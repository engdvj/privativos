import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import type { CatalogoRow, FuncionarioRow } from "../types";

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

export function FuncionariosTab() {
  const [rows, setRows] = useState<FuncionarioRow[]>([]);
  const [unidades, setUnidades] = useState<CatalogoRow[]>([]);
  const [setores, setSetores] = useState<CatalogoRow[]>([]);
  const [funcoes, setFuncoes] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("todos");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroFuncao, setFiltroFuncao] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState<FuncionarioRow | null>(null);
  const { success, error } = useToast();
  const { openFuncionario } = useGlobalDetail();

  const [novo, setNovo] = useState({
    matricula: "",
    nome: "",
    unidades: [] as string[],
    unidadePrincipal: "",
    setores: [] as string[],
    setorPrincipal: "",
    funcoes: [] as string[],
    funcaoPrincipal: "",
  });

  function unidadesDoFuncionario(row: FuncionarioRow) {
    const fromApi = row.unidades?.filter(Boolean) ?? [];
    if (fromApi.length > 0) {
      return fromApi;
    }
    return row.unidade ? [row.unidade] : [];
  }

  function unidadesLabel(row: FuncionarioRow) {
    const unidades = unidadesDoFuncionario(row);
    return unidades.join(", ") || "-";
  }

  function setoresDoFuncionario(row: FuncionarioRow) {
    const fromApi = row.setores?.filter(Boolean) ?? [];
    if (fromApi.length > 0) {
      return fromApi;
    }
    return row.setor ? [row.setor] : [];
  }

  function setoresLabel(row: FuncionarioRow) {
    const setores = setoresDoFuncionario(row);
    return setores.join(", ") || "-";
  }

  function funcoesDoFuncionario(row: FuncionarioRow) {
    const fromApi = row.funcoes?.filter(Boolean) ?? [];
    if (fromApi.length > 0) {
      return fromApi;
    }
    return row.funcao ? [row.funcao] : [];
  }

  function funcoesLabel(row: FuncionarioRow) {
    const funcoes = funcoesDoFuncionario(row);
    return funcoes.join(", ") || "-";
  }

  function toggleSetorNovo(nomeSetor: string, checked: boolean) {
    setNovo((prev) => {
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
  }

  function toggleUnidadeNovo(nomeUnidade: string, checked: boolean) {
    setNovo((prev) => {
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
  }

  function toggleFuncaoNovo(nomeFuncao: string, checked: boolean) {
    setNovo((prev) => {
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
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [data, unidadesData, setoresData, funcoesData] = await Promise.all([
        api.get<FuncionarioRow[]>("/admin/funcionarios?include_inactive=true"),
        api.get<CatalogoRow[]>("/admin/unidades"),
        api.get<CatalogoRow[]>("/admin/setores"),
        api.get<CatalogoRow[]>("/admin/funcoes"),
      ]);
      setRows(data);
      setUnidades(unidadesData);
      setSetores(setoresData);
      setFuncoes(funcoesData);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar funcionarios");
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
      if (detail?.entidade === "funcionario") {
        void carregar();
      }
    };

    window.addEventListener("global-detail-updated", onUpdated);
    return () => window.removeEventListener("global-detail-updated", onUpdated);
  }, [carregar]);

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      const setoresLinha = setoresDoFuncionario(row);
      const unidadesLinha = unidadesDoFuncionario(row);
      const funcoesLinha = funcoesDoFuncionario(row);
      const matchTexto =
        !termo ||
        [row.matricula, row.nome, unidadesLinha.join(" "), setoresLinha.join(" "), funcoesLinha.join(" "), row.statusAtivo ? "ativo" : "inativo"]
          .join(" ")
          .toLowerCase()
          .includes(termo);
      const matchUnidade = filtroUnidade === "todos" || unidadesLinha.includes(filtroUnidade);
      const matchSetor = filtroSetor === "todos" || setoresLinha.includes(filtroSetor);
      const matchFuncao = filtroFuncao === "todos" || funcoesLinha.includes(filtroFuncao);
      const matchStatus =
        filtroStatus === "todos" || (filtroStatus === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchUnidade && matchSetor && matchFuncao && matchStatus;
    });
  }, [rows, busca, filtroUnidade, filtroSetor, filtroFuncao, filtroStatus]);

  const ativosFiltrados = useMemo(
    () => rowsFiltradas.filter((row) => row.statusAtivo).length,
    [rowsFiltradas],
  );
  const inativosFiltrados = rowsFiltradas.length - ativosFiltrados;

  async function criar() {
    const matriculaNormalizada = novo.matricula.trim();
    const nomeNormalizado = novo.nome.trim();
    if (
      !matriculaNormalizada ||
      !nomeNormalizado ||
      novo.unidades.length === 0 ||
      !novo.unidadePrincipal ||
      novo.setores.length === 0 ||
      !novo.setorPrincipal ||
      novo.funcoes.length === 0 ||
      !novo.funcaoPrincipal
    ) {
      error("Preencha matricula, nome, unidade principal, setor principal e funcao principal");
      return;
    }

    if (!novo.unidades.includes(novo.unidadePrincipal)) {
      error("Unidade principal precisa estar na lista de unidades selecionadas");
      return;
    }

    if (!novo.setores.includes(novo.setorPrincipal)) {
      error("Setor principal precisa estar na lista de setores selecionados");
      return;
    }

    if (!novo.funcoes.includes(novo.funcaoPrincipal)) {
      error("Funcao principal precisa estar na lista de funcoes selecionadas");
      return;
    }

    const matriculaConflito = rows.some(
      (row) => row.matricula.trim().toLowerCase() === matriculaNormalizada.toLowerCase(),
    );
    if (matriculaConflito) {
      error("Ja existe funcionario com esta matricula");
      return;
    }

    const nomeConflito = rows.some((row) => row.nome.trim().toLowerCase() === nomeNormalizado.toLowerCase());
    if (nomeConflito) {
      error("Ja existe funcionario com este nome");
      return;
    }

    setCreating(true);
    try {
      const unidadesOrdenadas = [
        novo.unidadePrincipal,
        ...novo.unidades.filter((unidade) => unidade !== novo.unidadePrincipal),
      ];
      const setoresOrdenados = [
        novo.setorPrincipal,
        ...novo.setores.filter((setor) => setor !== novo.setorPrincipal),
      ];
      const funcoesOrdenadas = [
        novo.funcaoPrincipal,
        ...novo.funcoes.filter((funcao) => funcao !== novo.funcaoPrincipal),
      ];

      await api.post("/admin/funcionarios", {
        matricula: matriculaNormalizada,
        nome: nomeNormalizado,
        unidade_principal: novo.unidadePrincipal,
        unidade: novo.unidadePrincipal,
        unidades: unidadesOrdenadas,
        setor_principal: novo.setorPrincipal,
        setores: setoresOrdenados,
        funcao_principal: novo.funcaoPrincipal,
        funcao: novo.funcaoPrincipal,
        funcoes: funcoesOrdenadas,
      });
      setNovo({
        matricula: "",
        nome: "",
        unidades: [],
        unidadePrincipal: "",
        setores: [],
        setorPrincipal: "",
        funcoes: [],
        funcaoPrincipal: "",
      });
      setOpenCreateModal(false);
      success("Funcionario criado com sucesso");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar funcionario");
    } finally {
      setCreating(false);
    }
  }

  async function apagar(row: FuncionarioRow) {
    try {
      await api.del(`/admin/funcionarios/${row.matricula}`);
      success(`Funcionario ${row.matricula} apagado`);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar funcionario");
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Funcionarios</span>}
        icon={Users}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Ativos: {ativosFiltrados}</span>
            <span>Inativos: {inativosFiltrados}</span>
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
              placeholder="Buscar matricula, nome, unidade, setor ou funcao"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-52 lg:w-60`}
            />
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas unidades</SelectItem>
                {unidades.map((unidade) => (
                  <SelectItem key={unidade.id} value={unidade.nome}>
                    {unidade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroSetor} onValueChange={setFiltroSetor}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos setores</SelectItem>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.nome}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Funcao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas funcoes</SelectItem>
                {funcoes.map((funcao) => (
                  <SelectItem key={funcao.id} value={funcao.nome}>
                    {funcao.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(value) => setFiltroStatus(value as "todos" | "ativo" | "inativo")}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-32`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-r from-primary to-primary/85 text-primary-foreground"
              onClick={() => setOpenCreateModal(true)}
              aria-label="Novo funcionario"
              title="Novo funcionario"
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
                key: "matricula",
                title: "Matricula",
                width: "14%",
                className: "font-mono font-semibold",
                sortValue: (row) => row.matricula,
              },
              { key: "nome", title: "Nome", width: "22%", sortValue: (row) => row.nome },
              { key: "unidade", title: "Unidades", width: "18%", sortValue: (row) => unidadesLabel(row) },
              { key: "setor", title: "Setores", width: "20%", sortValue: (row) => setoresLabel(row) },
              { key: "funcao", title: "Funcoes", width: "19%", sortValue: (row) => funcoesLabel(row) },
              { key: "status", title: "Status", align: "center", width: "10%", sortValue: (row) => row.statusAtivo },
              { key: "acoes", title: "Acoes", align: "center", width: "8%" },
            ]}
            rows={rowsFiltradas}
            getRowKey={(row) => row.matricula}
            onRowClick={(row) => {
              void openFuncionario(row.matricula);
            }}
            loading={loading}
            emptyMessage="Nenhum funcionario encontrado."
            minWidthClassName="min-w-[1040px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => {
              const unidadesExibicao = unidadesLabel(row);
              const setoresExibicao = setoresLabel(row);
              const funcoesExibicao = funcoesLabel(row);

              return (
                <>
                  <td>{row.matricula}</td>
                  <td className="max-w-0 truncate" title={row.nome}>{row.nome}</td>
                  <td className="max-w-0 truncate" title={unidadesExibicao}>{unidadesExibicao}</td>
                  <td className="max-w-0 truncate" title={setoresExibicao}>{setoresExibicao}</td>
                  <td className="max-w-0 truncate" title={funcoesExibicao}>{funcoesExibicao}</td>
                  <td>
                    <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                      {row.statusAtivo ? "ativo" : "inativo"}
                    </StatusPill>
                  </td>
                  <td>
                    <TableActions className="justify-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => {
                          void openFuncionario(row.matricula);
                        }}
                        aria-label={`Editar funcionario ${row.matricula}`}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                        onClick={() => setFuncionarioParaExcluir(row)}
                        aria-label={`Apagar funcionario ${row.matricula}`}
                        title="Apagar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableActions>
                  </td>
                </>
              );
            }}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`funcionario-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : rowsFiltradas.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhum funcionario encontrado." />
            </div>
          ) : (
            rowsFiltradas.map((row) => {
              const unidadesExibicao = unidadesLabel(row);
              const setoresExibicao = setoresLabel(row);
              const funcoesExibicao = funcoesLabel(row);
              return (
                <article
                  key={row.matricula}
                  className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        void openFuncionario(row.matricula);
                      }}
                    >
                      {row.matricula}
                    </button>
                    <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                      {row.statusAtivo ? "ativo" : "inativo"}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{row.nome}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Unidades</p>
                      <p className="truncate text-foreground" title={unidadesExibicao}>{unidadesExibicao}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Funcoes</p>
                      <p className="truncate text-foreground" title={funcoesExibicao}>{funcoesExibicao}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Setores</p>
                      <p className="truncate text-foreground" title={setoresExibicao}>{setoresExibicao}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => {
                        void openFuncionario(row.matricula);
                      }}
                      aria-label={`Editar funcionario ${row.matricula}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setFuncionarioParaExcluir(row)}
                      aria-label={`Apagar funcionario ${row.matricula}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SectionCard>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Novo Funcionario"
        description="Preencha os dados e vincule ao menos uma unidade, um setor e uma funcao."
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Matricula" htmlFor="matricula">
              <Input
                id="matricula"
                value={novo.matricula}
                onChange={(e) => setNovo((p) => ({ ...p, matricula: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Nome" htmlFor="nome">
              <Input
                id="nome"
                value={novo.nome}
                onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-3">
            <FormField label="Unidades">
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
                {unidades.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma unidade ativa encontrada.</p>
                ) : (
                  unidades.map((unidade) => {
                    const checked = novo.unidades.includes(unidade.nome);
                    return (
                      <label key={unidade.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleUnidadeNovo(unidade.nome, Boolean(value))}
                        />
                        <span>{unidade.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Selecionadas: {novo.unidades.length}</p>
              <div className="mt-2">
                <Select
                  value={novo.unidadePrincipal}
                  onValueChange={(value) => setNovo((prev) => ({ ...prev, unidadePrincipal: value }))}
                  disabled={novo.unidades.length === 0}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a unidade principal" />
                  </SelectTrigger>
                  <SelectContent>
                    {novo.unidades.map((unidadeNome) => (
                      <SelectItem key={unidadeNome} value={unidadeNome}>
                        {unidadeNome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>

            <FormField label="Setores">
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
                {setores.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum setor ativo encontrado.</p>
                ) : (
                  setores.map((setor) => {
                    const checked = novo.setores.includes(setor.nome);
                    return (
                      <label key={setor.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleSetorNovo(setor.nome, Boolean(value))}
                        />
                        <span>{setor.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Selecionados: {novo.setores.length}</p>
              <div className="mt-2">
                <Select
                  value={novo.setorPrincipal}
                  onValueChange={(value) => setNovo((prev) => ({ ...prev, setorPrincipal: value }))}
                  disabled={novo.setores.length === 0}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o setor principal" />
                  </SelectTrigger>
                  <SelectContent>
                    {novo.setores.map((setorNome) => (
                      <SelectItem key={setorNome} value={setorNome}>
                        {setorNome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>

            <FormField label="Funcoes">
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
                {funcoes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma funcao ativa encontrada.</p>
                ) : (
                  funcoes.map((funcao) => {
                    const checked = novo.funcoes.includes(funcao.nome);
                    return (
                      <label key={funcao.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleFuncaoNovo(funcao.nome, Boolean(value))}
                        />
                        <span>{funcao.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Selecionadas: {novo.funcoes.length}</p>
              <div className="mt-2">
                <Select
                  value={novo.funcaoPrincipal}
                  onValueChange={(value) => setNovo((prev) => ({ ...prev, funcaoPrincipal: value }))}
                  disabled={novo.funcoes.length === 0}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a funcao principal" />
                  </SelectTrigger>
                  <SelectContent>
                    {novo.funcoes.map((funcaoNome) => (
                      <SelectItem key={funcaoNome} value={funcaoNome}>
                        {funcaoNome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setOpenCreateModal(false)}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={criar} loading={creating}>
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(funcionarioParaExcluir)}
        onClose={() => setFuncionarioParaExcluir(null)}
        title="Apagar funcionario"
        description={
          funcionarioParaExcluir
            ? `Tem certeza que deseja apagar o funcionario ${funcionarioParaExcluir.matricula} (${funcionarioParaExcluir.nome})?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!funcionarioParaExcluir) return;
          await apagar(funcionarioParaExcluir);
          setFuncionarioParaExcluir(null);
        }}
      />
    </div>
  );
}
