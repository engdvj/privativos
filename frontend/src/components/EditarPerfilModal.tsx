import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock, Save, User } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";

interface PerfilUsuario {
  usuario: string;
  nomeCompleto: string;
  perfil: string;
  deveAlterarSenha: boolean;
}

interface EditarPerfilModalProps {
  open: boolean;
  onClose: () => void;
  onPerfilAtualizado?: (novoNome: string) => void;
}

export function EditarPerfilModal({ open, onClose, onPerfilAtualizado }: EditarPerfilModalProps) {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  const { success, error } = useToast();

  const carregarPerfil = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PerfilUsuario>("/auth/perfil");
      setPerfil(data);
      setNomeCompleto(data.nomeCompleto);
      setAlterandoSenha(data.deveAlterarSenha);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar perfil");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [error, onClose]);

  useEffect(() => {
    if (open) {
      void carregarPerfil();
    } else {
      setNomeCompleto("");
      setSenhaNova("");
      setSenhaConfirmacao("");
      setAlterandoSenha(false);
    }
  }, [carregarPerfil, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!nomeCompleto.trim()) {
      error("Nome completo é obrigatório");
      return;
    }

    if (alterandoSenha) {
      if (!senhaNova) {
        error("Informe a nova senha");
        return;
      }

      if (senhaNova.length < 6) {
        error("A nova senha deve ter no mínimo 6 caracteres");
        return;
      }

      if (senhaNova !== senhaConfirmacao) {
        error("As senhas não coincidem");
        return;
      }
    }

    setSalvando(true);
    try {
      const payload: {
        nomeCompleto?: string;
        senhaNova?: string;
      } = {};

      if (nomeCompleto !== perfil?.nomeCompleto) {
        payload.nomeCompleto = nomeCompleto;
      }

      if (alterandoSenha && senhaNova) {
        payload.senhaNova = senhaNova;
      }

      if (Object.keys(payload).length === 0) {
        error("Nenhuma alteração foi feita");
        return;
      }

      const atualizado = await api.put<PerfilUsuario>("/auth/perfil", payload);

      success(
        alterandoSenha && senhaNova
          ? "Perfil e senha atualizados com sucesso"
          : "Perfil atualizado com sucesso",
      );

      if (payload.nomeCompleto) {
        const sessionData = {
          ...JSON.parse(localStorage.getItem("session") || "{}"),
          nome: atualizado.nomeCompleto,
        };
        localStorage.setItem("session", JSON.stringify(sessionData));
        onPerfilAtualizado?.(atualizado.nomeCompleto);
      }

      onClose();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Perfil"
      description="Atualize suas informações pessoais e senha"
      maxWidthClassName="max-w-2xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="usuario" className="text-foreground">
                Usuário
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="usuario"
                  value={perfil?.usuario || ""}
                  disabled
                  className="pl-9 bg-muted/55 text-foreground/85"
                />
              </div>
              <p className="text-xs text-muted-foreground/90">O nome de usuário não pode ser alterado</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomeCompleto" className="text-foreground">
                Nome Completo
              </Label>
              <Input
                id="nomeCompleto"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Digite seu nome completo"
                maxLength={150}
                className="text-foreground placeholder:text-muted-foreground/90"
              />
            </div>

            <div className="pt-1">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alterarSenha"
                  checked={alterandoSenha}
                  onChange={(e) => setAlterandoSenha(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="alterarSenha" className="cursor-pointer font-normal text-foreground">
                  Alterar senha
                </Label>
              </div>

              {alterandoSenha ? (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="senhaNova" className="text-foreground">
                        Nova Senha
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="senhaNova"
                          type="password"
                          value={senhaNova}
                          onChange={(e) => setSenhaNova(e.target.value)}
                          placeholder="Digite a nova senha"
                          className="pl-9 text-foreground placeholder:text-muted-foreground/90"
                          minLength={6}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="senhaConfirmacao" className="text-foreground">
                        Confirmar Nova Senha
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="senhaConfirmacao"
                          type="password"
                          value={senhaConfirmacao}
                          onChange={(e) => setSenhaConfirmacao(e.target.value)}
                          placeholder="Confirme a nova senha"
                          className="pl-9 text-foreground placeholder:text-muted-foreground/90"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground/90">Mínimo de 6 caracteres.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={salvando}>
              <Save className="h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
