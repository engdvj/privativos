import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Loader2, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import type { CatalogoRow } from "../types";

export function FuncoesTab() {
  const [rows, setRows] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [nomeNovo, setNomeNovo] = useState("");
  const [edicao, setEdicao] = useState({ nome: "", status_ativo: true });
  const { success, error } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      const data = await api.get<CatalogoRow[]>("/admin/funcoes?include_inactive=true");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar funcoes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      const matchTexto = !termo || row.nome.toLowerCase().includes(termo);
      const matchStatus = filtroStatus === "todos" || (filtroStatus === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchStatus;
    });
  }, [rows, busca, filtroStatus]);

  async function criar() {
    if (!nomeNovo.trim()) {
      error("Informe o nome da funcao");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/funcoes", { nome: nomeNovo.trim() });
      setNomeNovo("");
      setOpenCreateModal(false);
      success("Funcao criada com sucesso");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar funcao");
    } finally {
      setCreating(false);
    }
  }

  function abrirEdicao(row: CatalogoRow) {
    setEditandoId(row.id);
    setEdicao({ nome: row.nome, status_ativo: row.statusAtivo });
  }

  function fecharEdicao() {
    setEditandoId(null);
    setEdicao({ nome: "", status_ativo: true });
  }

  async function salvarEdicao() {
    if (!editandoId) return;
    if (!edicao.nome.trim()) {
      error("Informe o nome da funcao");
      return;
    }

    setSavingId(editandoId);
    try {
      await api.put(`/admin/funcoes/${editandoId}`, {
        nome: edicao.nome.trim(),
        status_ativo: edicao.status_ativo,
      });
      success("Funcao atualizada");
      fecharEdicao();
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar funcao");
    } finally {
      setSavingId(null);
    }
  }

  async function apagar(row: CatalogoRow) {
    const ok = window.confirm(`Apagar funcao ${row.nome}?`);
    if (!ok) return;

    try {
      await api.del(`/admin/funcoes/${row.id}`);
      success("Funcao apagada");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar funcao");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Funcoes</span>
            <div className="flex items-center gap-2">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar funcao"
                className="h-8 w-56"
              />
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
              <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Nova funcao">
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
            <p className="text-sm text-muted-foreground">Nenhuma funcao encontrada.</p>
          ) : (
            <div className="overflow-x-auto px-2">
              <table className="w-full min-w-[720px] table-auto text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row) => (
                    <tr key={row.id} className="border-b transition-colors odd:bg-muted/10 hover:bg-muted/40">
                      <td className="px-4 py-3">{row.nome}</td>
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
                            onClick={() => abrirEdicao(row)}
                            aria-label={`Editar funcao ${row.nome}`}
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
                            aria-label={`Apagar funcao ${row.nome}`}
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

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Nova Funcao">
        <div className="space-y-3">
          <Input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome da funcao" />
          <div className="flex justify-end">
            <Button onClick={criar} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editandoId)} onClose={fecharEdicao} title="Editar Funcao">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edicao-funcao-nome">Nome</Label>
            <Input
              id="edicao-funcao-nome"
              value={edicao.nome}
              onChange={(e) => setEdicao((p) => ({ ...p, nome: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={edicao.status_ativo}
              onCheckedChange={(checked) => setEdicao((p) => ({ ...p, status_ativo: Boolean(checked) }))}
            />
            Ativo
          </label>
          <div className="flex justify-end">
            <Button onClick={salvarEdicao} disabled={savingId === editandoId}>
              {savingId === editandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
