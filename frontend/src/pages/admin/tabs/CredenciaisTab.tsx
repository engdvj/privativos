import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { KeyRound, Loader2, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
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

  async function carregar() {
    setLoading(true);
    try {
      const data = await api.get<CredencialRow[]>("/admin/credenciais");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar credenciais");
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
    const ok = window.confirm(`Apagar credencial ${row.usuario}?`);
    if (!ok) return;

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Credenciais</span>
            <div className="flex items-center gap-2">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar usuario, nome ou perfil"
                className="h-8 w-56"
              />
              <Select value={filtroPerfil} onValueChange={(value) => setFiltroPerfil(value as "todos" | PerfilAcesso)}>
                <SelectTrigger className="h-8 w-40">
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
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" onClick={() => setOpenCreateModal(true)} aria-label="Nova credencial">
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
            <p className="text-sm text-muted-foreground">Nenhuma credencial encontrada.</p>
          ) : (
            <div className="overflow-x-auto px-2">
              <table className="w-full min-w-[920px] table-auto text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usuario</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome completo</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfil</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row) => (
                    <tr key={row.id} className="border-b transition-colors odd:bg-muted/10 hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono font-semibold">{row.usuario}</td>
                      <td className="px-4 py-3">{row.nomeCompleto}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{row.perfil}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={row.ativo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                          variant="outline"
                        >
                          {row.ativo ? "ativo" : "inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
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
                            onClick={() => {
                              void apagar(row);
                            }}
                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                            aria-label={`Apagar credencial ${row.usuario}`}
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

      <Modal open={openCreateModal} onClose={() => setOpenCreateModal(false)} title="Nova Credencial">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="novo-usuario">Usuario</Label>
            <Input
              id="novo-usuario"
              value={novo.usuario}
              onChange={(e) => setNovo((p) => ({ ...p, usuario: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="novo-nome">Nome completo</Label>
            <Input
              id="novo-nome"
              value={novo.nome_completo}
              onChange={(e) => setNovo((p) => ({ ...p, nome_completo: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="novo-perfil">Perfil</Label>
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
          </div>
          <div className="space-y-1">
            <Label htmlFor="nova-senha">Senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={novo.senha}
              onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={criar} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editandoUsuario)}
        onClose={fecharEdicao}
        title={editandoUsuario ? `Editar Credencial: ${editandoUsuario}` : "Editar Credencial"}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="edicao-nome">Nome completo</Label>
            <Input
              id="edicao-nome"
              value={edicao.nome_completo}
              onChange={(e) => setEdicao((p) => ({ ...p, nome_completo: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edicao-perfil">Perfil</Label>
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
          </div>
          <div className="space-y-1">
            <Label htmlFor="edicao-senha">Nova senha (opcional)</Label>
            <Input
              id="edicao-senha"
              type="password"
              value={edicao.senha}
              onChange={(e) => setEdicao((p) => ({ ...p, senha: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={edicao.ativo}
              onCheckedChange={(checked) => setEdicao((p) => ({ ...p, ativo: Boolean(checked) }))}
            />
            Ativo
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={salvarEdicao} disabled={savingUsuario === editandoUsuario}>
            {savingUsuario === editandoUsuario ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </Modal>
    </div>
  );
}


