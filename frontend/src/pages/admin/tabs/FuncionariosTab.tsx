import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import { cn } from "@/lib/utils";
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
const FUNCIONARIOS_POR_PAGINA = 10;

function notificarAtualizacaoGlobal(entidade: "kit" | "funcionario" | "setor" | "unidade" | "funcao") {
  window.dispatchEvent(new CustomEvent("global-detail-updated", { detail: { entidade } }));
}

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
  const [paginaFuncionarios, setPaginaFuncionarios] = useState(1);
  const [sortFuncionarios, setSortFuncionarios] = useState<DataTableSortState>(null);
  const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState<FuncionarioRow | null>(null);
  const [matriculasSelecionadas, setMatriculasSelecionadas] = useState<string[]>([]);
  const [excluirSelecionadosAberto, setExcluirSelecionadosAberto] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
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

  const unidadesAtivas = useMemo(() => unidades.filter((row) => row.statusAtivo), [unidades]);
  const setoresAtivos = useMemo(() => setores.filter((row) => row.statusAtivo), [setores]);
  const funcoesAtivas = useMemo(() => funcoes.filter((row) => row.statusAtivo), [funcoes]);
  const setorByNome = useMemo(
    () => new Map(setores.map((setor) => [setor.nome, setor] as const)),
    [setores],
  );

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

  function setorCompativelComUnidades(setor: CatalogoRow, unidadesSelecionadas: string[]) {
    if (unidadesSelecionadas.length === 0) {
      return true;
    }
    const unidadesSetor = setor.unidades?.filter(Boolean) ?? [];
    if (unidadesSetor.length === 0) {
      return true;
    }
    return unidadesSelecionadas.some((unidade) => unidadesSetor.includes(unidade));
  }

  function setorCompativelPorNome(nomeSetor: string, unidadesSelecionadas: string[]) {
    const setor = setorByNome.get(nomeSetor);
    if (!setor) {
      return false;
    }
    return setorCompativelComUnidades(setor, unidadesSelecionadas);
  }

  function toggleSetorNovo(nomeSetor: string, checked: boolean) {
    setNovo((prev) => {
      if (checked) {
        if (prev.setores.includes(nomeSetor)) {
          return prev;
        }
        if (!setorCompativelPorNome(nomeSetor, prev.unidades)) {
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
        api.get<CatalogoRow[]>("/admin/unidades?include_inactive=true"),
        api.get<CatalogoRow[]>("/admin/setores?include_inactive=true"),
        api.get<CatalogoRow[]>("/admin/funcoes?include_inactive=true"),
      ]);
      setRows(data);
      setUnidades(unidadesData);
      setSetores(setoresData);
      setFuncoes(funcoesData);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar funcionários");
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

  const setoresFiltroDisponiveis = useMemo(() => {
    if (filtroUnidade === "todos") {
      return setores;
    }
    return setores.filter((setor) => setorCompativelComUnidades(setor, [filtroUnidade]));
  }, [setores, filtroUnidade]);

  const unidadesFiltroDisponiveis = useMemo(() => {
    if (filtroSetor === "todos") {
      return unidades;
    }
    const setorSelecionado = setorByNome.get(filtroSetor);
    if (!setorSelecionado) {
      return unidades;
    }
    const unidadesSetor = setorSelecionado.unidades?.filter(Boolean) ?? [];
    if (unidadesSetor.length === 0) {
      return unidades;
    }
    return unidades.filter((unidade) => unidadesSetor.includes(unidade.nome));
  }, [unidades, filtroSetor, setorByNome]);

  const setoresDisponiveisNovo = useMemo(() => {
    if (novo.unidades.length === 0) {
      return setoresAtivos;
    }
    return setoresAtivos.filter((setor) => setorCompativelComUnidades(setor, novo.unidades));
  }, [setoresAtivos, novo.unidades]);

  useEffect(() => {
    if (filtroUnidade !== "todos" && !unidadesFiltroDisponiveis.some((row) => row.nome === filtroUnidade)) {
      setFiltroUnidade("todos");
    }
    if (filtroSetor !== "todos" && !setoresFiltroDisponiveis.some((row) => row.nome === filtroSetor)) {
      setFiltroSetor("todos");
    }
  }, [filtroUnidade, filtroSetor, unidadesFiltroDisponiveis, setoresFiltroDisponiveis]);

  useEffect(() => {
    const setoresDisponiveis = new Set(setoresDisponiveisNovo.map((setor) => setor.nome));
    setNovo((prev) => {
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
  }, [setoresDisponiveisNovo]);

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
  const colunasOrdenacaoFuncionarios = useMemo<DataTableColumn<FuncionarioRow>[]>(() => [
    { key: "selecionar", title: "Selecao", sortable: false },
    { key: "matricula", title: "Matrícula", sortValue: (row) => row.matricula },
    { key: "nome", title: "Nome", sortValue: (row) => row.nome },
    {
      key: "unidade",
      title: "Unidades",
      sortValue: (row) => {
        const unidades = row.unidades?.filter(Boolean) ?? [];
        return (unidades.length > 0 ? unidades : row.unidade ? [row.unidade] : []).join(", ") || "-";
      },
    },
    {
      key: "setor",
      title: "Setores",
      sortValue: (row) => {
        const setores = row.setores?.filter(Boolean) ?? [];
        return (setores.length > 0 ? setores : row.setor ? [row.setor] : []).join(", ") || "-";
      },
    },
    {
      key: "funcao",
      title: "Funções",
      sortValue: (row) => {
        const funcoes = row.funcoes?.filter(Boolean) ?? [];
        return (funcoes.length > 0 ? funcoes : row.funcao ? [row.funcao] : []).join(", ") || "-";
      },
    },
    { key: "status", title: "Status", sortValue: (row) => row.statusAtivo },
    { key: "acoes", title: "Acoes", sortable: false },
  ], []);
  const rowsOrdenadas = useMemo(
    () => sortDataTableRows(rowsFiltradas, colunasOrdenacaoFuncionarios, sortFuncionarios),
    [rowsFiltradas, colunasOrdenacaoFuncionarios, sortFuncionarios],
  );

  const ativosFiltrados = useMemo(
    () => rowsFiltradas.filter((row) => row.statusAtivo).length,
    [rowsFiltradas],
  );
  const inativosFiltrados = rowsFiltradas.length - ativosFiltrados;
  const totalPaginasFuncionarios = Math.max(1, Math.ceil(rowsOrdenadas.length / FUNCIONARIOS_POR_PAGINA));
  const rowsPaginadas = useMemo(() => {
    const inicio = (paginaFuncionarios - 1) * FUNCIONARIOS_POR_PAGINA;
    return rowsOrdenadas.slice(inicio, inicio + FUNCIONARIOS_POR_PAGINA);
  }, [rowsOrdenadas, paginaFuncionarios]);
  const matriculasSelecionadasSet = useMemo(() => new Set(matriculasSelecionadas), [matriculasSelecionadas]);
  const matriculasFiltradas = useMemo(() => rowsFiltradas.map((row) => row.matricula), [rowsFiltradas]);
  const matriculasPaginadas = useMemo(() => rowsPaginadas.map((row) => row.matricula), [rowsPaginadas]);
  const matriculasSelecionadasFiltradas = useMemo(
    () => matriculasSelecionadas.filter((matricula) => matriculasFiltradas.includes(matricula)),
    [matriculasSelecionadas, matriculasFiltradas],
  );
  const todosSelecionadosNaPagina =
    matriculasPaginadas.length > 0 && matriculasPaginadas.every((matricula) => matriculasSelecionadasSet.has(matricula));
  const algunsSelecionadosNaPagina = matriculasPaginadas.some((matricula) => matriculasSelecionadasSet.has(matricula));
  const inicioPaginaFuncionarios = rowsOrdenadas.length === 0 ? 0 : (paginaFuncionarios - 1) * FUNCIONARIOS_POR_PAGINA + 1;
  const fimPaginaFuncionarios = Math.min(paginaFuncionarios * FUNCIONARIOS_POR_PAGINA, rowsOrdenadas.length);

  useEffect(() => {
    setPaginaFuncionarios(1);
  }, [busca, filtroUnidade, filtroSetor, filtroFuncao, filtroStatus]);

  useEffect(() => {
    if (paginaFuncionarios > totalPaginasFuncionarios) {
      setPaginaFuncionarios(totalPaginasFuncionarios);
    }
  }, [paginaFuncionarios, totalPaginasFuncionarios]);

  useEffect(() => {
    const matriculasDisponiveis = new Set(rows.map((row) => row.matricula));
    setMatriculasSelecionadas((prev) => prev.filter((matricula) => matriculasDisponiveis.has(matricula)));
  }, [rows]);

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
      error("Preencha matrícula, nome, unidade principal, setor principal e função principal");
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
      error("Função principal precisa estar na lista de funções selecionadas");
      return;
    }

    const setoresIncompativeis = novo.setores.filter(
      (setor) => !setorCompativelPorNome(setor, novo.unidades),
    );
    if (setoresIncompativeis.length > 0) {
      error(`Setores sem vínculo com as unidades selecionadas: ${setoresIncompativeis.join(", ")}`);
      return;
    }

    if (!setorCompativelPorNome(novo.setorPrincipal, [novo.unidadePrincipal])) {
      error("Setor principal precisa estar vinculado a unidade principal");
      return;
    }

    const matriculaConflito = rows.some(
      (row) => row.matricula.trim().toLowerCase() === matriculaNormalizada.toLowerCase(),
    );
    if (matriculaConflito) {
      error("Já existe funcionário com esta matrícula");
      return;
    }

    const nomeConflito = rows.some((row) => row.nome.trim().toLowerCase() === nomeNormalizado.toLowerCase());
    if (nomeConflito) {
      error("Já existe funcionário com este nome");
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
      success("Funcionário criado com sucesso");
      await carregar();
      notificarAtualizacaoGlobal("funcionario");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar funcionário");
    } finally {
      setCreating(false);
    }
  }

  async function apagar(row: FuncionarioRow) {
    try {
      await api.del(`/admin/funcionarios/${row.matricula}`);
      success(`Funcionário ${row.matricula} apagado`);
      await carregar();
      notificarAtualizacaoGlobal("funcionario");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar funcionário");
    }
  }

  function alternarSelecao(matricula: string, checked: boolean) {
    setMatriculasSelecionadas((prev) => {
      if (checked) {
        if (prev.includes(matricula)) {
          return prev;
        }
        return [...prev, matricula];
      }
      return prev.filter((itemMatricula) => itemMatricula !== matricula);
    });
  }

  function alternarSelecaoPagina(checked: boolean) {
    setMatriculasSelecionadas((prev) => {
      if (checked) {
        const next = new Set(prev);
        for (const matricula of matriculasPaginadas) {
          next.add(matricula);
        }
        return Array.from(next);
      }
      return prev.filter((matricula) => !matriculasPaginadas.includes(matricula));
    });
  }

  async function apagarSelecionados(matriculas: string[]) {
    if (matriculas.length === 0) {
      error("Selecione ao menos um funcionário para apagar");
      return;
    }

    setDeletingBulk(true);
    const matriculasComSucesso: string[] = [];
    const matriculasComFalha: string[] = [];

    try {
      for (const matricula of matriculas) {
        try {
          await api.del(`/admin/funcionarios/${matricula}`);
          matriculasComSucesso.push(matricula);
        } catch (_err) {
          matriculasComFalha.push(matricula);
        }
      }

      if (matriculasComSucesso.length > 0) {
        success(`${matriculasComSucesso.length} funcionário(s) apagado(s)`);
      }
      if (matriculasComFalha.length > 0) {
        error(`Falha ao apagar ${matriculasComFalha.length} funcionário(s)`);
      }

      const sucessoSet = new Set(matriculasComSucesso);
      setMatriculasSelecionadas((prev) => prev.filter((matricula) => !sucessoSet.has(matricula)));
      await carregar();
      if (matriculasComSucesso.length > 0) {
        notificarAtualizacaoGlobal("funcionario");
      }
    } finally {
      setDeletingBulk(false);
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Funcionários</span>}
        icon={Users}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Ativos: {ativosFiltrados}</span>
            <span>Inativos: {inativosFiltrados}</span>
            <span>Selecionados: {matriculasSelecionadasFiltradas.length}</span>
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
              placeholder="Buscar matrícula, nome, unidade, setor ou função"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-52 lg:w-60`}
            />
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas unidades</SelectItem>
                {unidadesFiltroDisponiveis.map((unidade) => (
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
                {setoresFiltroDisponiveis.map((setor) => (
                  <SelectItem key={setor.id} value={setor.nome}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-40`}>
                <SelectValue placeholder="Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas funções</SelectItem>
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
              className="h-8 whitespace-nowrap rounded-lg border-border/70 px-2.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setExcluirSelecionadosAberto(true)}
              disabled={matriculasSelecionadasFiltradas.length === 0 || deletingBulk}
            >
              Apagar selecionados ({matriculasSelecionadasFiltradas.length})
            </Button>
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg border-0 bg-primary text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-sky-500 hover:animate-pulse"
              onClick={() => setOpenCreateModal(true)}
              aria-label="Novo funcionário"
              title="Novo funcionário"
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
                      aria-label="Selecionar funcionários da página"
                    />
                  </div>
                ),
                align: "center",
                width: "6%",
                sortable: false,
              },
              {
                key: "matricula",
                title: "Matrícula",
                width: "12%",
                className: "font-mono font-semibold",
                sortValue: (row) => row.matricula,
              },
              { key: "nome", title: "Nome", width: "21%", sortValue: (row) => row.nome },
              { key: "unidade", title: "Unidades", width: "17%", sortValue: (row) => unidadesLabel(row) },
              { key: "setor", title: "Setores", width: "18%", sortValue: (row) => setoresLabel(row) },
              { key: "funcao", title: "Funções", width: "17%", sortValue: (row) => funcoesLabel(row) },
              { key: "status", title: "Status", align: "center", width: "9%", sortValue: (row) => row.statusAtivo },
              { key: "acoes", title: "Acoes", align: "center", width: "10%" },
            ]}
            rows={rowsPaginadas}
            sortState={sortFuncionarios}
            onSortStateChange={setSortFuncionarios}
            getRowKey={(row) => row.matricula}
            onRowClick={(row) => {
              void openFuncionario(row.matricula);
            }}
            loading={loading}
            emptyMessage="Nenhum funcionário encontrado."
            minWidthClassName="min-w-[1040px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => {
              const unidadesExibicao = unidadesLabel(row);
              const setoresExibicao = setoresLabel(row);
              const funcoesExibicao = funcoesLabel(row);

              return (
                <>
                  <td>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={matriculasSelecionadasSet.has(row.matricula)}
                        onCheckedChange={(checked) => alternarSelecao(row.matricula, Boolean(checked))}
                        aria-label={`Selecionar funcionário ${row.matricula}`}
                      />
                    </div>
                  </td>
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
                        aria-label={`Editar funcionário ${row.matricula}`}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                        onClick={() => setFuncionarioParaExcluir(row)}
                        aria-label={`Apagar funcionário ${row.matricula}`}
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
              <EmptyState compact title="Nenhum funcionário encontrado." />
            </div>
          ) : (
            rowsPaginadas.map((row) => {
              const unidadesExibicao = unidadesLabel(row);
              const setoresExibicao = setoresLabel(row);
              const funcoesExibicao = funcoesLabel(row);
              return (
                <article
                  key={row.matricula}
                  className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={matriculasSelecionadasSet.has(row.matricula)}
                        onCheckedChange={(checked) => alternarSelecao(row.matricula, Boolean(checked))}
                        aria-label={`Selecionar funcionário ${row.matricula}`}
                      />
                      <button
                        type="button"
                        className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                        onClick={() => {
                          void openFuncionario(row.matricula);
                        }}
                      >
                        {row.matricula}
                      </button>
                    </div>
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
                      <p className="text-[10px] uppercase tracking-wide">Funções</p>
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
                      aria-label={`Editar funcionário ${row.matricula}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setFuncionarioParaExcluir(row)}
                      aria-label={`Apagar funcionário ${row.matricula}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[10px] text-muted-foreground">
            <p>{inicioPaginaFuncionarios}-{fimPaginaFuncionarios} de {rowsFiltradas.length} | Página {paginaFuncionarios} de {totalPaginasFuncionarios}</p>
            <p>Selecionados nos filtros: {matriculasSelecionadasFiltradas.length}</p>
          </div>
          <div className="flex min-w-[220px] justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaFuncionarios((paginaAtual) => Math.max(1, paginaAtual - 1))}
              disabled={paginaFuncionarios === 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaFuncionarios((paginaAtual) => Math.min(totalPaginasFuncionarios, paginaAtual + 1))}
              disabled={paginaFuncionarios === totalPaginasFuncionarios}
            >
              Próxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Novo Funcionário"
        description="Preencha os dados e vincule ao menos uma unidade, um setor e uma função."
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Matrícula" htmlFor="matricula">
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

          <div className="grid items-start gap-2.5 lg:grid-cols-3">
            <FormField label="Unidades" className="space-y-1.5">
              <div className="h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
                {unidadesAtivas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma unidade ativa encontrada.</p>
                ) : (
                  unidadesAtivas.map((unidade) => {
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
              <div className="min-h-8 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">Selecionadas: {novo.unidades.length}</p>
                <p className="text-[11px] text-muted-foreground">Disponíveis: {unidadesAtivas.length}</p>
              </div>
              <div>
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

            <FormField label="Setores" className="space-y-1.5">
              <div className="h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
                {setoresAtivos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum setor ativo encontrado.</p>
                ) : (
                  setoresAtivos.map((setor) => {
                    const checked = novo.setores.includes(setor.nome);
                    const compativel = novo.unidades.length === 0 || setorCompativelComUnidades(setor, novo.unidades);
                    return (
                      <label
                        key={setor.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs",
                          compativel ? "hover:bg-accent/40" : "cursor-not-allowed opacity-55",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!compativel}
                          onCheckedChange={(value) => toggleSetorNovo(setor.nome, Boolean(value))}
                        />
                        <span>{setor.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="min-h-8 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">Selecionados: {novo.setores.length}</p>
                <p className="text-[11px] text-muted-foreground">
                  Disponíveis: {setoresDisponiveisNovo.length}
                </p>
              </div>
              <div>
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

            <FormField label="Funções" className="space-y-1.5">
              <div className="h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
                {funcoesAtivas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma função ativa encontrada.</p>
                ) : (
                  funcoesAtivas.map((funcao) => {
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
              <div className="min-h-8 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">Selecionadas: {novo.funcoes.length}</p>
                <p className="text-[11px] text-muted-foreground">Disponíveis: {funcoesAtivas.length}</p>
              </div>
              <div>
                <Select
                  value={novo.funcaoPrincipal}
                  onValueChange={(value) => setNovo((prev) => ({ ...prev, funcaoPrincipal: value }))}
                  disabled={novo.funcoes.length === 0}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a função principal" />
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
        title="Apagar funcionário"
        description={
          funcionarioParaExcluir
            ? `Tem certeza que deseja apagar o funcionário ${funcionarioParaExcluir.matricula} (${funcionarioParaExcluir.nome})?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!funcionarioParaExcluir) return;
          await apagar(funcionarioParaExcluir);
          setFuncionarioParaExcluir(null);
        }}
      />

      <ConfirmDialog
        open={excluirSelecionadosAberto}
        onClose={() => setExcluirSelecionadosAberto(false)}
        title="Apagar funcionários selecionados"
        description={
          matriculasSelecionadasFiltradas.length > 0
            ? `Tem certeza que deseja apagar ${matriculasSelecionadasFiltradas.length} funcionário(s) selecionado(s)?`
            : "Nenhum funcionário selecionado."
        }
        confirmLabel="Apagar selecionados"
        onConfirm={async () => {
          await apagarSelecionados(matriculasSelecionadasFiltradas);
          setExcluirSelecionadosAberto(false);
        }}
      />
    </div>
  );
}


