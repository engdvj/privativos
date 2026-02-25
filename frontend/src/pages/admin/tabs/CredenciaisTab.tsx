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
import { KeyRound, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { CredencialDraft, CredencialRow, PerfilAcesso } from "../types";

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
    <div className="space-y-4">
      <SectionCard
        title="Credenciais"
        icon={KeyRound}
        description={`Total filtrado: ${rowsFiltradas.length}`}
        actions={
          <FilterBar>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar usuario, nome ou perfil"
              className="h-9 w-full sm:w-56"
            />
            <Select value={filtroPerfil} onValueChange={(value) => setFiltroPerfil(value as "todos" | PerfilAcesso)}>
              <SelectTrigger className="h-9 w-full sm:w-40">
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
              <SelectTrigger className="h-9 w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Nova credencial" title="Nova credencial">
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <DataTable
          columns={[
            { key: "usuario", title: "Usuario", width: "20%" },
            { key: "nome", title: "Nome completo", width: "42%" },
            { key: "perfil", title: "Perfil", align: "center", width: "14%" },
            { key: "status", title: "Status", align: "center", width: "12%" },
            { key: "acoes", title: "Acoes", align: "center", width: "12%" },
          ]}
          rows={rowsFiltradas}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyMessage="Nenhuma credencial encontrada."
          minWidthClassName="min-w-[920px]"
          renderRow={(row) => (
            <>
              <td className="font-mono font-semibold">{row.usuario}</td>
              <td>{row.nomeCompleto}</td>
              <td>
                <div className="flex justify-center">
                  <StatusPill tone="info">{row.perfil}</StatusPill>
                </div>
              </td>
              <td>
                <div className="flex justify-center">
                  <StatusPill tone={row.ativo ? "success" : "danger"}>
                    {row.ativo ? "ativo" : "inativo"}
                  </StatusPill>
                </div>
              </td>
              <td>
                <TableActions className="justify-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => abrirEdicao(row)}
                    aria-label={`Editar credencial ${row.usuario}`}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setCredencialParaExcluir(row)}
                    className="text-destructive hover:bg-destructive/12 hover:text-destructive"
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
      </SectionCard>

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Nova Credencial" maxWidthClassName="max-w-3xl">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Usuario" htmlFor="novo-usuario">
            <Input
              id="novo-usuario"
              value={novo.usuario}
              onChange={(e) => setNovo((p) => ({ ...p, usuario: e.target.value }))}
            />
          </FormField>
          <FormField label="Nome completo" htmlFor="novo-nome">
            <Input
              id="novo-nome"
              value={novo.nome_completo}
              onChange={(e) => setNovo((p) => ({ ...p, nome_completo: e.target.value }))}
            />
          </FormField>
          <FormField label="Perfil" htmlFor="novo-perfil">
            <Select
              value={novo.perfil}
              onValueChange={(value) => setNovo((p) => ({ ...p, perfil: value as PerfilAcesso }))}
            >
              <SelectTrigger id="novo-perfil">
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
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={criar} loading={creating}>
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editandoUsuario)}
        onClose={fecharEdicao}
        title={editandoUsuario ? `Editar Credencial: ${editandoUsuario}` : "Editar Credencial"}
        maxWidthClassName="max-w-3xl"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Nome completo" htmlFor="edicao-nome" className="md:col-span-2">
            <Input
              id="edicao-nome"
              value={edicao.nome_completo}
              onChange={(e) => setEdicao((p) => ({ ...p, nome_completo: e.target.value }))}
            />
          </FormField>
          <FormField label="Perfil" htmlFor="edicao-perfil">
            <Select
              value={edicao.perfil}
              onValueChange={(value) => setEdicao((p) => ({ ...p, perfil: value as PerfilAcesso }))}
            >
              <SelectTrigger id="edicao-perfil">
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
            />
          </FormField>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={edicao.ativo}
              onCheckedChange={(checked) => setEdicao((p) => ({ ...p, ativo: Boolean(checked) }))}
            />
            Ativo
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={salvarEdicao} loading={savingUsuario === editandoUsuario}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
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
