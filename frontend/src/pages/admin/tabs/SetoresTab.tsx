import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { CatalogoRow } from "../types";

export function SetoresTab() {
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
  const [setorParaExcluir, setSetorParaExcluir] = useState<CatalogoRow | null>(null);
  const { success, error } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CatalogoRow[]>("/admin/setores?include_inactive=true");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar setores");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
      error("Informe o nome do setor");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/setores", { nome: nomeNovo.trim() });
      setNomeNovo("");
      setOpenCreateModal(false);
      success("Setor criado com sucesso");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar setor");
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
      error("Informe o nome do setor");
      return;
    }

    setSavingId(editandoId);
    try {
      await api.put(`/admin/setores/${editandoId}`, {
        nome: edicao.nome.trim(),
        status_ativo: edicao.status_ativo,
      });
      success("Setor atualizado");
      fecharEdicao();
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar setor");
    } finally {
      setSavingId(null);
    }
  }

  async function apagar(row: CatalogoRow) {
    try {
      await api.del(`/admin/setores/${row.id}`);
      success("Setor apagado");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar setor");
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Setores"
        description={`Total filtrado: ${rowsFiltradas.length}`}
        actions={
          <FilterBar>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar setor"
              className="h-9 w-full sm:w-56"
            />
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
            <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Novo setor" title="Novo setor">
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <DataTable
          columns={[
            { key: "nome", title: "Nome", width: "62%" },
            { key: "status", title: "Status", align: "center", width: "20%" },
            { key: "acoes", title: "Acoes", align: "center", width: "18%" },
          ]}
          rows={rowsFiltradas}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyMessage="Nenhum setor encontrado."
          renderRow={(row) => (
            <>
              <td>{row.nome}</td>
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
                    onClick={() => abrirEdicao(row)}
                    aria-label={`Editar setor ${row.nome}`}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSetorParaExcluir(row)}
                    className="text-destructive hover:bg-destructive/12 hover:text-destructive"
                    aria-label={`Apagar setor ${row.nome}`}
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

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Novo Setor" maxWidthClassName="max-w-xl">
        <div className="space-y-3">
          <FormField label="Nome do setor" htmlFor="novo-setor-nome">
            <Input
              id="novo-setor-nome"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Nome do setor"
            />
          </FormField>
          <div className="flex justify-end">
            <Button onClick={criar} loading={creating}>
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editandoId)} onClose={fecharEdicao} title="Editar Setor" maxWidthClassName="max-w-xl">
        <div className="space-y-3">
          <FormField label="Nome" htmlFor="edicao-setor-nome">
            <Input
              id="edicao-setor-nome"
              value={edicao.nome}
              onChange={(e) => setEdicao((p) => ({ ...p, nome: e.target.value }))}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={edicao.status_ativo}
              onCheckedChange={(checked) => setEdicao((p) => ({ ...p, status_ativo: Boolean(checked) }))}
            />
            Ativo
          </label>
          <div className="flex justify-end">
            <Button onClick={salvarEdicao} loading={savingId === editandoId}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(setorParaExcluir)}
        onClose={() => setSetorParaExcluir(null)}
        title="Apagar setor"
        description={
          setorParaExcluir
            ? `Tem certeza que deseja apagar o setor ${setorParaExcluir.nome}?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!setorParaExcluir) return;
          await apagar(setorParaExcluir);
          setSetorParaExcluir(null);
        }}
      />
    </div>
  );
}
