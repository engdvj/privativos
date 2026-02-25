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
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
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
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemRow | null>(null);
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
      const matchTexto =
        !termo || [row.codigo, row.descricao, row.status, row.statusAtivo ? "ativo" : "inativo"].join(" ").toLowerCase().includes(termo);
      const matchStatus = filtroStatusItem === "todos" || row.status === filtroStatusItem;
      const matchAtivo = filtroAtivo === "todos" || (filtroAtivo === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchStatus && matchAtivo;
    });
  }, [rows, busca, filtroStatusItem, filtroAtivo]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Itens"
        icon={Package}
        description={`Total filtrado: ${rowsFiltradas.length}`}
        actions={
          <FilterBar>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar codigo ou descricao"
              className="h-9 w-full sm:w-56"
            />
            <Select value={filtroStatusItem} onValueChange={(value) => setFiltroStatusItem(value as "todos" | ItemStatus)}>
              <SelectTrigger className="h-9 w-full sm:w-40">
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
              <SelectTrigger className="h-9 w-full sm:w-36">
                <SelectValue placeholder="Ativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Novo item" title="Novo item">
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <DataTable
          columns={[
            { key: "codigo", title: "Codigo", width: "14%" },
            { key: "descricao", title: "Descricao", width: "42%" },
            { key: "status", title: "Status", align: "center", width: "16%" },
            { key: "ativo", title: "Ativo", align: "center", width: "14%" },
            { key: "acoes", title: "Acoes", align: "center", width: "14%" },
          ]}
          rows={rowsFiltradas}
          getRowKey={(row) => row.codigo}
          loading={loading}
          emptyMessage="Nenhum item encontrado."
          minWidthClassName="min-w-[900px]"
          renderRow={(row) => (
            <>
              <td className="font-mono font-semibold">{row.codigo}</td>
              <td>{row.descricao}</td>
              <td>
                <div className="flex justify-center">
                  <StatusPill tone="info">{row.status}</StatusPill>
                </div>
              </td>
              <td>
                <div className="flex justify-center">
                  <StatusPill tone={row.statusAtivo ? "success" : "danger"}>
                    {row.statusAtivo ? "ativo" : "inativo"}
                  </StatusPill>
                </div>
              </td>
              <td>
                <TableActions className="justify-center">
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
                    onClick={() => setItemParaExcluir(row)}
                    className="text-destructive hover:bg-destructive/12 hover:text-destructive"
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
      </SectionCard>

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Novo Item" maxWidthClassName="max-w-2xl">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Codigo" htmlFor="novo-item-codigo">
            <Input
              id="novo-item-codigo"
              value={novo.codigo}
              onChange={(e) => setNovo((p) => ({ ...p, codigo: e.target.value }))}
              placeholder="Codigo"
            />
          </FormField>
          <FormField label="Descricao" htmlFor="novo-item-descricao">
            <Input
              id="novo-item-descricao"
              value={novo.descricao}
              onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Descricao"
            />
          </FormField>
          <FormField label="Status" htmlFor="novo-item-status">
            <Select
              value={novo.status}
              onValueChange={(value) => setNovo((p) => ({ ...p, status: value as ItemStatus }))}
            >
              <SelectTrigger id="novo-item-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disponivel">disponivel</SelectItem>
                <SelectItem value="emprestado">emprestado</SelectItem>
                <SelectItem value="inativo">inativo</SelectItem>
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
