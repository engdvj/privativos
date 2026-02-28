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
import { KeyRound, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { CredencialDraft, CredencialRow, PerfilAcesso } from "../types";

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

export function CredenciaisTab() {
  const [rows, setRows] = useState<CredencialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUsuario, setSavingUsuario] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<"todos" | PerfilAcesso>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [credencialParaExcluir, setCredencialParaExcluir] = useState<CredencialRow | null>(null);
  const [edicao, setEdicao] = useState<CredencialDraft>({
    nome_completo: "",
    perfil: "setor",
    ativo: true,
    deve_alterar_senha: false,
    senha: "",
  });
  const { success, error } = useToast();

  const [novo, setNovo] = useState({
    usuario: "",
    nome_completo: "",
    perfil: "setor" as PerfilAcesso,
    senha: "",
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CredencialRow[]>("/admin/credenciais");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar credenciais");
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
      const matchTexto =
        !termo ||
        [row.usuario, row.nomeCompleto, row.perfil, row.ativo ? "ativo" : "inativo"].join(" ").toLowerCase().includes(termo);
      const matchPerfil = filtroPerfil === "todos" || row.perfil === filtroPerfil;
      const matchStatus =
        filtroStatus === "todos" || (filtroStatus === "ativo" ? row.ativo : !row.ativo);
      return matchTexto && matchPerfil && matchStatus;
    });
  }, [rows, busca, filtroPerfil, filtroStatus]);

  const ativosFiltrados = useMemo(
    () => rowsFiltradas.filter((row) => row.ativo).length,
    [rowsFiltradas],
  );
  const inativosFiltrados = rowsFiltradas.length - ativosFiltrados;

  async function criar() {
    if (!novo.usuario || !novo.nome_completo || !novo.senha) {
      error("Preencha usuario, nome completo e senha");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/credenciais", {
        usuario: novo.usuario.trim(),
        nome_completo: novo.nome_completo.trim(),
        perfil: novo.perfil,
        senha: novo.senha,
      });
      setNovo({
        usuario: "",
        nome_completo: "",
        perfil: "setor",
        senha: "",
      });
      setOpenCreateModal(false);
      success("Credencial criada com sucesso");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar credencial");
    } finally {
      setCreating(false);
    }
  }

  function abrirEdicao(row: CredencialRow) {
    setEditandoUsuario(row.usuario);
    setEdicao({
      nome_completo: row.nomeCompleto,
      perfil: row.perfil,
      ativo: row.ativo,
      deve_alterar_senha: row.deveAlterarSenha,
      senha: "",
    });
  }

  function fecharEdicao() {
    setEditandoUsuario(null);
    setEdicao({
      nome_completo: "",
      perfil: "setor",
      ativo: true,
      deve_alterar_senha: false,
      senha: "",
    });
  }

  async function salvarEdicao() {
    if (!editandoUsuario) return;
    if (!edicao.nome_completo.trim()) {
      error("Informe o nome completo");
      return;
    }

    setSavingUsuario(editandoUsuario);
    try {
      const payload: {
        nome_completo: string;
        perfil: PerfilAcesso;
        ativo: boolean;
        deve_alterar_senha: boolean;
        senha?: string;
      } = {
        nome_completo: edicao.nome_completo.trim(),
        perfil: edicao.perfil,
        ativo: edicao.ativo,
        deve_alterar_senha: edicao.deve_alterar_senha,
      };

      if (edicao.senha.trim()) {
        payload.senha = edicao.senha;
      }

      await api.put(`/admin/credenciais/${editandoUsuario}`, payload);
      success(`Credencial ${editandoUsuario} atualizada`);
      fecharEdicao();
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar credencial");
    } finally {
      setSavingUsuario(null);
    }
  }

  async function apagar(row: CredencialRow) {
    try {
      await api.del(`/admin/credenciais/${row.usuario}`);
      success(`Credencial ${row.usuario} apagada`);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar credencial");
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Credenciais</span>}
        icon={KeyRound}
        description={(
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Ativas: {ativosFiltrados}</span>
            <span>Inativas: {inativosFiltrados}</span>
          </div>
        )}
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={(
          <FilterBar className={FILTRO_BAR_CLASS}>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar usuario, nome ou perfil"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-52 lg:w-60`}
            />
            <Select value={filtroPerfil} onValueChange={(value) => setFiltroPerfil(value as "todos" | PerfilAcesso)}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-36`}>
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos perfis</SelectItem>
                <SelectItem value="setor">setor</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="superadmin">superadmin</SelectItem>
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
              aria-label="Nova credencial"
              title="Nova credencial"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        )}
      >
        <div className="hidden md:block">
          <DataTable
            columns={[
              { key: "usuario", title: "Usuario", width: "16%", className: "font-mono font-semibold", sortValue: (row) => row.usuario },
              { key: "nome", title: "Nome completo", width: "33%", sortValue: (row) => row.nomeCompleto },
              { key: "perfil", title: "Perfil", align: "center", width: "16%", sortValue: (row) => row.perfil },
              { key: "status", title: "Status", align: "center", width: "14%", sortValue: (row) => row.ativo },
              { key: "acoes", title: "Acoes", align: "center", width: "21%", sortable: false },
            ]}
            rows={rowsFiltradas}
            getRowKey={(row) => row.id}
            onRowClick={(row) => abrirEdicao(row)}
            loading={loading}
            emptyMessage="Nenhuma credencial encontrada."
            minWidthClassName="min-w-[920px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => (
              <>
                <td>{row.usuario}</td>
                <td className="max-w-0 truncate" title={row.nomeCompleto}>{row.nomeCompleto}</td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone="info" className="text-[10px]">{row.perfil}</StatusPill>
                  </div>
                </td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone={row.ativo ? "success" : "danger"} className="text-[10px]">
                      {row.ativo ? "ativo" : "inativo"}
                    </StatusPill>
                  </div>
                </td>
                <td>
                  <TableActions className="justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => abrirEdicao(row)}
                      aria-label={`Editar credencial ${row.usuario}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setCredencialParaExcluir(row)}
                      aria-label={`Apagar credencial ${row.usuario}`}
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
              <div key={`credencial-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : rowsFiltradas.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhuma credencial encontrada." />
            </div>
          ) : (
            rowsFiltradas.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => abrirEdicao(row)}
                  >
                    {row.usuario}
                  </button>
                  <StatusPill tone={row.ativo ? "success" : "danger"} className="text-[10px]">
                    {row.ativo ? "ativo" : "inativo"}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{row.nomeCompleto}</p>
                <div className="mt-2">
                  <StatusPill tone="info" className="text-[10px]">{row.perfil}</StatusPill>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => abrirEdicao(row)}
                    aria-label={`Editar credencial ${row.usuario}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                    onClick={() => setCredencialParaExcluir(row)}
                    aria-label={`Apagar credencial ${row.usuario}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </SectionCard>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Nova Credencial"
        description="Cadastre usuario, perfil de acesso e senha inicial."
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Usuario" htmlFor="novo-usuario">
              <Input
                id="novo-usuario"
                value={novo.usuario}
                onChange={(e) => setNovo((p) => ({ ...p, usuario: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Nome completo" htmlFor="novo-nome">
              <Input
                id="novo-nome"
                value={novo.nome_completo}
                onChange={(e) => setNovo((p) => ({ ...p, nome_completo: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Perfil" htmlFor="novo-perfil">
              <Select
                value={novo.perfil}
                onValueChange={(value) => setNovo((p) => ({ ...p, perfil: value as PerfilAcesso }))}
              >
                <SelectTrigger id="novo-perfil" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setor">setor</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="superadmin">superadmin</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Senha" htmlFor="nova-senha">
              <Input
                id="nova-senha"
                type="password"
                value={novo.senha}
                onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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

      <Modal
        open={Boolean(editandoUsuario)}
        onClose={fecharEdicao}
        title={editandoUsuario ? `Editar Credencial: ${editandoUsuario}` : "Editar Credencial"}
        description="Ajuste perfil, status e senha desta credencial."
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField label="Nome completo" htmlFor="edicao-nome" className="sm:col-span-2">
              <Input
                id="edicao-nome"
                value={edicao.nome_completo}
                onChange={(e) => setEdicao((p) => ({ ...p, nome_completo: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Perfil" htmlFor="edicao-perfil">
              <Select
                value={edicao.perfil}
                onValueChange={(value) => setEdicao((p) => ({ ...p, perfil: value as PerfilAcesso }))}
              >
                <SelectTrigger id="edicao-perfil" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setor">setor</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="superadmin">superadmin</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Nova senha (opcional)" htmlFor="edicao-senha">
              <Input
                id="edicao-senha"
                type="password"
                value={edicao.senha}
                onChange={(e) => setEdicao((p) => ({ ...p, senha: e.target.value }))}
                className="h-9 text-xs"
              />
            </FormField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
              <Checkbox
                checked={edicao.ativo}
                onCheckedChange={(checked) => setEdicao((p) => ({ ...p, ativo: Boolean(checked) }))}
              />
              Ativo
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
              <Checkbox
                checked={edicao.deve_alterar_senha}
                onCheckedChange={(checked) => setEdicao((p) => ({ ...p, deve_alterar_senha: Boolean(checked) }))}
              />
              Exigir troca de senha
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={fecharEdicao}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={salvarEdicao} loading={savingUsuario === editandoUsuario}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(credencialParaExcluir)}
        onClose={() => setCredencialParaExcluir(null)}
        title="Apagar credencial"
        description={
          credencialParaExcluir
            ? `Tem certeza que deseja apagar a credencial ${credencialParaExcluir.usuario}?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!credencialParaExcluir) return;
          await apagar(credencialParaExcluir);
          setCredencialParaExcluir(null);
        }}
      />
    </div>
  );
}
