import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
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
    const ok = window.confirm(`Apagar funcionario ${row.matricula} (${row.nome})?`);
    if (!ok) return;

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Funcionarios</span>
            <div className="flex items-center gap-2">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar matricula, nome, setor ou funcao"
                className="h-8 w-56"
              />
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className="h-8 w-40">
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
                <SelectTrigger className="h-8 w-40">
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
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Novo funcionario">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rowsFiltradas.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">Nenhum funcionario encontrado.</p>
          ) : (
            <div className="overflow-x-auto px-2">
              <table className="w-full min-w-[980px] table-auto text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matricula</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Setor</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funcao</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row) => (
                    <tr key={row.matricula} className="border-b transition-colors odd:bg-muted/10 hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono font-semibold">{row.matricula}</td>
                      <td className="px-4 py-3">{row.nome}</td>
                      <td className="px-4 py-3">{row.setor}</td>
                      <td className="px-4 py-3">{row.funcao}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={row.statusAtivo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                          variant="outline"
                        >
                          {row.statusAtivo ? "ativo" : "inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
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
                            onClick={() => {
                              void apagar(row);
                            }}
                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                            aria-label={`Apagar funcionario ${row.matricula}`}
                            title="Apagar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Novo Funcionario">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="matricula">Matricula</Label>
            <Input
              id="matricula"
              value={novo.matricula}
              onChange={(e) => setNovo((p) => ({ ...p, matricula: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={novo.nome}
              onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="setor">Setor</Label>
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
          </div>
          <div className="space-y-1">
            <Label htmlFor="funcao">Funcao</Label>
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
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={criar} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
