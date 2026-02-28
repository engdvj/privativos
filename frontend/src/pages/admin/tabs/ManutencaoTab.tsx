import { useMemo, useState, type ChangeEvent } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/use-toast";
import { Database, Download, RefreshCcw, Upload } from "lucide-react";

type ResetTarget =
  | "credenciais"
  | "configuracoes"
  | "unidades"
  | "setores"
  | "funcoes"
  | "funcionarios"
  | "itens"
  | "solicitacoes"
  | "devolucoes"
  | "auditoria";

const RESET_TARGET_OPTIONS: Array<{ value: ResetTarget; label: string; helper: string }> = [
  { value: "credenciais", label: "Usuarios", helper: "Limpa contas de acesso (com opcao de preservar voce)." },
  { value: "configuracoes", label: "Configuracoes", helper: "Reinicia parametros para os valores padrao." },
  { value: "unidades", label: "Unidades", helper: "Apaga o catalogo de unidades." },
  { value: "setores", label: "Setores", helper: "Apaga o catalogo de setores." },
  { value: "funcoes", label: "Funcoes", helper: "Apaga o catalogo de funcoes." },
  { value: "funcionarios", label: "Funcionarios", helper: "Apaga solicitantes cadastrados." },
  { value: "itens", label: "Itens", helper: "Apaga todos os itens de estoque." },
  { value: "solicitacoes", label: "Solicitacoes", helper: "Apaga historico de emprestimos." },
  { value: "devolucoes", label: "Devolucoes", helper: "Apaga historico de devolucoes." },
  { value: "auditoria", label: "Auditoria", helper: "Apaga trilha de auditoria." },
];

interface BackupData {
  configuracoes: unknown[];
  credenciais: unknown[];
  unidades: unknown[];
  setores: unknown[];
  funcoes: unknown[];
  funcionarios: unknown[];
  itens: unknown[];
  solicitacoes: unknown[];
  devolucoes: unknown[];
  auditoria: unknown[];
}

interface BackupPayload {
  versao_formato: number;
  gerado_em?: string;
  gerado_por?: string;
  dados: BackupData;
}

const SECTION_HEADER_CLASS = "gap-2 px-3 pb-2 pt-3 sm:px-4 sm:pb-2 sm:pt-4";
const SECTION_CONTENT_CLASS = "space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4";
const ACTIONS_GROUP_CLASS = "flex flex-wrap items-center gap-1.5";
const PANEL_CLASS =
  "rounded-xl border border-border/70 bg-surface-2/80 px-3 py-2.5 text-xs text-muted-foreground";

function getTargetCounts(backup: BackupPayload): Record<ResetTarget, number> {
  return {
    credenciais: backup.dados.credenciais.length,
    configuracoes: backup.dados.configuracoes.length,
    unidades: backup.dados.unidades.length,
    setores: backup.dados.setores.length,
    funcoes: backup.dados.funcoes.length,
    funcionarios: backup.dados.funcionarios.length,
    itens: backup.dados.itens.length,
    solicitacoes: backup.dados.solicitacoes.length,
    devolucoes: backup.dados.devolucoes.length,
    auditoria: backup.dados.auditoria.length,
  };
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<BackupPayload>;
  if (!payload.dados || typeof payload.dados !== "object") return false;
  const dados = payload.dados as Partial<BackupData>;
  return (
    Array.isArray(dados.configuracoes) &&
    Array.isArray(dados.credenciais) &&
    Array.isArray(dados.unidades) &&
    Array.isArray(dados.setores) &&
    Array.isArray(dados.funcoes) &&
    Array.isArray(dados.funcionarios) &&
    Array.isArray(dados.itens) &&
    Array.isArray(dados.solicitacoes) &&
    Array.isArray(dados.devolucoes) &&
    Array.isArray(dados.auditoria)
  );
}

export function ManutencaoTab() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [resetando, setResetando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [preservarUsuarioAtual, setPreservarUsuarioAtual] = useState(true);
  const [backupImportado, setBackupImportado] = useState<BackupPayload | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState("");
  const [targets, setTargets] = useState<Record<ResetTarget, boolean>>({
    credenciais: true,
    configuracoes: true,
    unidades: true,
    setores: true,
    funcoes: true,
    funcionarios: true,
    itens: true,
    solicitacoes: true,
    devolucoes: true,
    auditoria: true,
  });
  const { success, error } = useToast();

  const selectedTargets = useMemo(
    () => RESET_TARGET_OPTIONS.filter((item) => targets[item.value]).map((item) => item.value),
    [targets],
  );

  const backupCounts = useMemo(
    () => (backupImportado ? getTargetCounts(backupImportado) : null),
    [backupImportado],
  );

  async function gerarBackup() {
    setBackupLoading(true);
    try {
      const payload = await api.get<BackupPayload>("/admin/manutencao/backup");
      const fileName = `privativos_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      success("Backup gerado com sucesso");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao gerar backup");
    } finally {
      setBackupLoading(false);
    }
  }

  async function importarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setBackupImportado(null);
      setArquivoSelecionado("");
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;

      if (!isBackupPayload(parsed)) {
        throw new Error("Arquivo de backup invalido");
      }

      setBackupImportado(parsed);
      setArquivoSelecionado(file.name);
      success("Arquivo de backup carregado");
    } catch (err) {
      setBackupImportado(null);
      setArquivoSelecionado("");
      error(err instanceof Error ? err.message : "Erro ao ler arquivo de backup");
    }
  }

  async function executarReset() {
    if (selectedTargets.length === 0) {
      error("Selecione ao menos um alvo para reset");
      return;
    }

    setResetando(true);
    try {
      await api.post("/admin/manutencao/reset", {
        alvos: selectedTargets,
        preservar_usuario_atual: preservarUsuarioAtual,
      });
      success("Reset concluido com sucesso");
      setConfirmarReset(false);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao resetar banco");
    } finally {
      setResetando(false);
    }
  }

  async function executarRestauracao() {
    if (!backupImportado) {
      error("Selecione um arquivo de backup antes de restaurar");
      return;
    }

    setRestaurando(true);
    try {
      await api.post("/admin/manutencao/restaurar", {
        backup: backupImportado,
        preservar_usuario_atual: preservarUsuarioAtual,
      });
      success("Restauracao concluida com sucesso");
      setConfirmarRestauracao(false);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao restaurar backup");
    } finally {
      setRestaurando(false);
    }
  }

  function selecionarTodosTargets() {
    setTargets({
      credenciais: true,
      configuracoes: true,
      unidades: true,
      setores: true,
      funcoes: true,
      funcionarios: true,
      itens: true,
      solicitacoes: true,
      devolucoes: true,
      auditoria: true,
    });
  }

  function limparTargets() {
    setTargets({
      credenciais: false,
      configuracoes: false,
      unidades: false,
      setores: false,
      funcoes: false,
      funcionarios: false,
      itens: false,
      solicitacoes: false,
      devolucoes: false,
      auditoria: false,
    });
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Backup</span>}
        icon={Database}
        description="Gera um arquivo JSON completo com dados e configuracoes do sistema."
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={(
          <Button className="h-8 rounded-lg text-xs" onClick={gerarBackup} loading={backupLoading}>
            <Download className="h-3.5 w-3.5" />
            Gerar backup
          </Button>
        )}
      >
        <div className={PANEL_CLASS}>
          O backup inclui credenciais (hash de senha), catalogos, movimentacoes e auditoria.
        </div>
      </SectionCard>

      <SectionCard
        title={<span className="text-sm font-semibold">Restauracao</span>}
        icon={Upload}
        description="Importa um backup JSON e substitui os dados atuais."
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={(
          <Button
            variant="destructive"
            className="h-8 rounded-lg text-xs"
            onClick={() => setConfirmarRestauracao(true)}
            disabled={!backupImportado || restaurando}
          >
            <Upload className="h-3.5 w-3.5" />
            Restaurar backup
          </Button>
        )}
      >
        <div className="space-y-2.5">
          <Input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importarArquivo(event)}
            className="h-9 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/12 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={backupImportado ? "success" : "neutral"} className="text-[10px]">
              {backupImportado ? "Arquivo carregado" : "Nenhum arquivo"}
            </StatusPill>
            {arquivoSelecionado ? (
              <span className="text-[11px] text-muted-foreground">{arquivoSelecionado}</span>
            ) : null}
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={preservarUsuarioAtual}
              onCheckedChange={(checked) => setPreservarUsuarioAtual(Boolean(checked))}
            />
            Preservar meu usuario atual para evitar bloqueio de acesso
          </label>

          {backupCounts ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {RESET_TARGET_OPTIONS.map((item) => (
                <div key={item.value} className="rounded-lg border border-border/70 bg-surface-2/80 px-3 py-2 text-xs">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-muted-foreground">{backupCounts[item.value]} registros</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={<span className="text-sm font-semibold">Reset de Banco</span>}
        icon={RefreshCcw}
        description="Apaga dados das tabelas selecionadas."
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={(
          <div className={ACTIONS_GROUP_CLASS}>
            <Button variant="outline" className="h-8 rounded-lg text-xs" onClick={selecionarTodosTargets}>
              Marcar tudo
            </Button>
            <Button variant="outline" className="h-8 rounded-lg text-xs" onClick={limparTargets}>
              Limpar
            </Button>
            <Button
              variant="destructive"
              className="h-8 rounded-lg text-xs"
              onClick={() => setConfirmarReset(true)}
              disabled={selectedTargets.length === 0 || resetando}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Resetar ({selectedTargets.length})
            </Button>
          </div>
        )}
      >
        <div className="space-y-2.5">
          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={preservarUsuarioAtual}
              onCheckedChange={(checked) => setPreservarUsuarioAtual(Boolean(checked))}
            />
            Preservar meu usuario atual para evitar bloqueio de acesso
          </label>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RESET_TARGET_OPTIONS.map((item) => (
              <label
                key={item.value}
                className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface-2/80 p-2.5 text-xs"
              >
                <Checkbox
                  checked={targets[item.value]}
                  onCheckedChange={(checked) =>
                    setTargets((prev) => ({
                      ...prev,
                      [item.value]: Boolean(checked),
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">{item.helper}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirmarReset}
        onClose={() => setConfirmarReset(false)}
        title="Confirmar reset de banco"
        description={`Tem certeza que deseja resetar ${selectedTargets.length} alvo(s) selecionado(s)?`}
        confirmLabel="Resetar banco"
        onConfirm={executarReset}
      />

      <ConfirmDialog
        open={confirmarRestauracao}
        onClose={() => setConfirmarRestauracao(false)}
        title="Confirmar restauracao de backup"
        description="A restauracao substitui os dados atuais do banco. Essa acao nao pode ser desfeita."
        confirmLabel="Restaurar backup"
        onConfirm={executarRestauracao}
      />
    </div>
  );
}
