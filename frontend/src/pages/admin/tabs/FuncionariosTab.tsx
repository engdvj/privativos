import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TableActions } from "@/components/ui/table-actions";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import type { CatalogoRow, FuncionarioRow } from "../types";

export function FuncionariosTab() {
  const [rows, setRows] = useState<FuncionarioRow[]>([]);
  const [setores, setSetores] = useState<CatalogoRow[]>([]);
  const [funcoes, setFuncoes] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroFuncao, setFiltroFuncao] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState<FuncionarioRow | null>(null);
  const { success, error } = useToast();
  const { openFuncionario } = useGlobalDetail();

  const [novo, setNovo] = useState({
    matricula: "",
    nome: "",
    setor: "",
    funcao: "",
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [data, setoresData, funcoesData] = await Promise.all([
        api.get<FuncionarioRow[]>("/admin/funcionarios?include_inactive=true"),
        api.get<CatalogoRow[]>("/admin/setores"),
        api.get<CatalogoRow[]>("/admin/funcoes"),
      ]);
      setRows(data);
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
      const matchTexto =
        !termo ||
        [row.matricula, row.nome, row.setor, row.funcao, row.statusAtivo ? "ativo" : "inativo"]
          .join(" ")
          .toLowerCase()
          .includes(termo);
      const matchSetor = filtroSetor === "todos" || row.setor === filtroSetor;
      const matchFuncao = filtroFuncao === "todos" || row.funcao === filtroFuncao;
      const matchStatus =
        filtroStatus === "todos" || (filtroStatus === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchSetor && matchFuncao && matchStatus;
    });
  }, [rows, busca, filtroSetor, filtroFuncao, filtroStatus]);

  async function criar() {
    if (!novo.matricula || !novo.nome || !novo.setor || !novo.funcao) {
      error("Preencha todos os campos para criar funcionario");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/funcionarios", {
        matricula: novo.matricula.trim(),
        nome: novo.nome.trim(),
        setor: novo.setor.trim(),
        funcao: novo.funcao.trim(),
      });
      setNovo({ matricula: "", nome: "", setor: "", funcao: "" });
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
    <div className="space-y-4">
      <SectionCard
        title="Funcionarios"
        icon={Users}
        description={`Total filtrado: ${rowsFiltradas.length}`}
        actions={
          <FilterBar>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar matricula, nome, setor ou funcao"
              className="h-9 w-full sm:w-56"
            />
            <Select value={filtroSetor} onValueChange={setFiltroSetor}>
              <SelectTrigger className="h-9 w-full sm:w-40">
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
              <SelectTrigger className="h-9 w-full sm:w-40">
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
              <SelectTrigger className="h-9 w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Novo funcionario" title="Novo funcionario">
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <DataTable
          columns={[
            { key: "matricula", title: "Matricula" },
            { key: "nome", title: "Nome" },
            { key: "setor", title: "Setor" },
            { key: "funcao", title: "Funcao" },
            { key: "status", title: "Status", align: "center" },
            { key: "acoes", title: "Acoes", align: "center" },
          ]}
          rows={rowsFiltradas}
          getRowKey={(row) => row.matricula}
          loading={loading}
          emptyMessage="Nenhum funcionario encontrado."
          minWidthClassName="min-w-[980px]"
          renderRow={(row) => (
            <>
              <td className="font-mono font-semibold">{row.matricula}</td>
              <td>{row.nome}</td>
              <td>{row.setor}</td>
              <td>{row.funcao}</td>
              <td>
                <StatusPill tone={row.statusAtivo ? "success" : "danger"}>
                  {row.statusAtivo ? "ativo" : "inativo"}
                </StatusPill>
              </td>
              <td>
                <TableActions className="justify-center">
                  <Button
                    size="icon"
                    variant="ghost"
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
                    onClick={() => setFuncionarioParaExcluir(row)}
                    className="text-destructive hover:bg-destructive/12 hover:text-destructive"
                    aria-label={`Apagar funcionario ${row.matricula}`}
                    title="Apagar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableActions>
              </td>
            </>
          )}
        />
      </SectionCard>

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Novo Funcionario" maxWidthClassName="max-w-4xl">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Matricula" htmlFor="matricula">
            <Input
              id="matricula"
              value={novo.matricula}
              onChange={(e) => setNovo((p) => ({ ...p, matricula: e.target.value }))}
            />
          </FormField>
          <FormField label="Nome" htmlFor="nome">
            <Input
              id="nome"
              value={novo.nome}
              onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
            />
          </FormField>
          <FormField label="Setor" htmlFor="setor">
            <Select value={novo.setor} onValueChange={(value) => setNovo((p) => ({ ...p, setor: value }))}>
              <SelectTrigger id="setor">
                <SelectValue placeholder="Selecione um setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.nome}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Funcao" htmlFor="funcao">
            <Select value={novo.funcao} onValueChange={(value) => setNovo((p) => ({ ...p, funcao: value }))}>
              <SelectTrigger id="funcao">
                <SelectValue placeholder="Selecione uma funcao" />
              </SelectTrigger>
              <SelectContent>
                {funcoes.map((funcao) => (
                  <SelectItem key={funcao.id} value={funcao.nome}>
                    {funcao.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={criar} loading={creating}>
            <Plus className="h-4 w-4" />
            Criar
          </Button>
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
