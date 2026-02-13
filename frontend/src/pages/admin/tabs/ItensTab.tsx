import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Loader2, Package, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import type { ItemRow, ItemStatus } from "../types";

export function ItensTab() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatusItem, setFiltroStatusItem] = useState<"todos" | ItemStatus>("todos");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativo" | "inativo">("todos");
  const { success, error } = useToast();
  const { openKit } = useGlobalDetail();

  const [novo, setNovo] = useState({
    codigo: "",
    descricao: "",
    status: "disponivel" as ItemStatus,
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

  async function criar() {
    if (!novo.codigo || !novo.descricao) {
      error("Preencha codigo e descricao para criar item");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/itens", {
        codigo: novo.codigo.trim(),
        descricao: novo.descricao.trim(),
        status: novo.status,
      });
      setNovo({ codigo: "", descricao: "", status: "disponivel" });
      setOpenCreateModal(false);
      success("Item criado com sucesso");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar item");
    } finally {
      setCreating(false);
    }
  }

  async function apagar(row: ItemRow) {
    const ok = window.confirm(`Apagar item ${row.codigo}?`);
    if (!ok) return;

    try {
      await api.del(`/admin/itens/${row.codigo}`);
      success(`Item ${row.codigo} apagado`);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar item");
    }
  }

  const statusLabel = useMemo(
    () => ({
      disponivel: "disponivel",
      emprestado: "emprestado",
      inativo: "inativo",
    }),
    [],
  );

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      const matchTexto =
        !termo || [row.codigo, row.descricao, row.status, row.statusAtivo ? "ativo" : "inativo"].join(" ").toLowerCase().includes(termo);
      const matchStatus = filtroStatusItem === "todos" || row.status === filtroStatusItem;
      const matchAtivo = filtroAtivo === "todos" || (filtroAtivo === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchStatus && matchAtivo;
    });
  }, [rows, busca, filtroStatusItem, filtroAtivo]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Itens</span>
            <div className="flex items-center gap-2">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar codigo ou descricao"
                className="h-8 w-56"
              />
              <Select value={filtroStatusItem} onValueChange={(value) => setFiltroStatusItem(value as "todos" | ItemStatus)}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Status do item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="disponivel">disponivel</SelectItem>
                  <SelectItem value="emprestado">emprestado</SelectItem>
                  <SelectItem value="inativo">inativo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroAtivo} onValueChange={(value) => setFiltroAtivo(value as "todos" | "ativo" | "inativo")}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Ativo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Novo item">
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
            <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
          ) : (
            <div className="overflow-x-auto px-2">
              <table className="w-full min-w-[900px] table-auto text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Codigo</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descricao</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ativo</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row) => (
                    <tr key={row.codigo} className="border-b transition-colors odd:bg-muted/10 hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono font-semibold">{row.codigo}</td>
                      <td className="px-4 py-3">{row.descricao}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{statusLabel[row.status]}</Badge>
                      </td>
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
                            onClick={() => {
                              void apagar(row);
                            }}
                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                            aria-label={`Apagar item ${row.codigo}`}
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

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Novo Item">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Input
              value={novo.codigo}
              onChange={(e) => setNovo((p) => ({ ...p, codigo: e.target.value }))}
              placeholder="Codigo"
            />
          </div>
          <div className="space-y-1">
            <Input
              value={novo.descricao}
              onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Descricao"
            />
          </div>
          <div className="space-y-1">
            <Select
              value={novo.status}
              onValueChange={(value) => setNovo((p) => ({ ...p, status: value as ItemStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disponivel">disponivel</SelectItem>
                <SelectItem value="emprestado">emprestado</SelectItem>
                <SelectItem value="inativo">inativo</SelectItem>
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
