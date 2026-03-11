
import { useMemo, useState, type ChangeEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, ClipboardList, Database, Download, RefreshCcw, Upload, Wrench } from "lucide-react";

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

type MaintenanceCounts = Record<ResetTarget, number>;

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

interface BackupAnalysis {
  problemas: string[];
  avisos: string[];
}

interface ResetResponse {
  alvos: ResetTarget[];
  contagens: MaintenanceCounts;
  usuarioPreservado: string | null;
}

interface RestoreResponse {
  restauradoEm: string;
  usuarioPreservado: string | null;
  contagens: MaintenanceCounts;
}

interface MaintenanceResult {
  tipo: "reset" | "restauracao";
  executadoEm: string;
  usuarioPreservado: string | null;
  contagens: MaintenanceCounts;
  alvos: ResetTarget[];
}
type MaintenanceTab = "correcao" | "backup" | "restauracao" | "reset";

const BACKUP_FORMAT_VERSION = 2;
const PREVIEW_LIMIT = 6;

const RESET_TARGET_OPTIONS: Array<{ value: ResetTarget; label: string; helper: string }> = [
  { value: "credenciais", label: "Usuários", helper: "Limpa contas de acesso (com opção de preservar você)." },
  { value: "configuracoes", label: "Configurações", helper: "Reinicia parâmetros para os valores padrão." },
  { value: "unidades", label: "Unidades", helper: "Apaga unidades e exige reset de setores vinculados." },
  { value: "setores", label: "Setores", helper: "Apaga o catalogo de setores." },
  { value: "funcoes", label: "Funções", helper: "Apaga o catálogo de funções." },
  { value: "funcionarios", label: "Funcionários", helper: "Apaga solicitantes cadastrados." },
  { value: "itens", label: "Itens", helper: "Apaga todos os itens de estoque." },
  { value: "solicitacoes", label: "Solicitações", helper: "Apaga histórico de empréstimos." },
  { value: "devolucoes", label: "Devoluções", helper: "Apaga histórico de devoluções." },
  { value: "auditoria", label: "Auditoria", helper: "Apaga trilha de auditoria." },
];

const ALL_TARGETS = RESET_TARGET_OPTIONS.map((item) => item.value);
const TARGET_LABEL_BY_ID = new Map(RESET_TARGET_OPTIONS.map((item) => [item.value, item.label]));

const SECTION_HEADER_CLASS = "gap-2 px-3 pb-2 pt-3 sm:px-4 sm:pb-2 sm:pt-4";
const SECTION_CONTENT_CLASS = "space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4";
const ACTIONS_GROUP_CLASS = "flex flex-wrap items-center gap-1.5";
const PANEL_CLASS =
  "rounded-xl border border-border/70 bg-surface-2/80 px-3 py-2.5 text-xs text-muted-foreground";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function getStringArrayField(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTargetCounts(backup: BackupPayload): MaintenanceCounts {
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

function createEmptyCounts(): MaintenanceCounts {
  return {
    credenciais: 0,
    configuracoes: 0,
    unidades: 0,
    setores: 0,
    funcoes: 0,
    funcionarios: 0,
    itens: 0,
    solicitacoes: 0,
    devolucoes: 0,
    auditoria: 0,
  };
}

function toMaintenanceCounts(value: unknown): MaintenanceCounts {
  const counts = createEmptyCounts();
  if (!isObjectRecord(value)) {
    return counts;
  }

  for (const target of ALL_TARGETS) {
    const amount = value[target];
    if (typeof amount === "number" && Number.isFinite(amount)) {
      counts[target] = amount;
    }
  }

  return counts;
}

function normalizarListaNomes(candidatos: Array<string | null | undefined>) {
  const vistos = new Set<string>();
  const nomes: string[] = [];

  for (const nome of candidatos) {
    const normalizado = (nome ?? "").trim();
    if (!normalizado || vistos.has(normalizado)) {
      continue;
    }
    vistos.add(normalizado);
    nomes.push(normalizado);
  }

  return nomes;
}

function findDuplicates(values: string[]) {
  const counters = new Map<string, number>();

  for (const value of values) {
    const normalizado = value.trim();
    if (!normalizado) continue;
    counters.set(normalizado, (counters.get(normalizado) ?? 0) + 1);
  }

  return [...counters.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function formatSample(values: string[], limit = PREVIEW_LIMIT) {
  const cleanValues = normalizarListaNomes(values);
  if (cleanValues.length <= limit) {
    return cleanValues.join(", ");
  }
  return `${cleanValues.slice(0, limit).join(", ")} (+${cleanValues.length - limit})`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!isObjectRecord(value)) return false;
  if (!isObjectRecord(value.dados)) return false;

  const dados = value.dados as Record<string, unknown>;
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
function analisarBackup(backup: BackupPayload, preservarUsuarioAtual: boolean): BackupAnalysis {
  const problemas: string[] = [];
  const avisos: string[] = [];

  if (backup.versao_formato !== BACKUP_FORMAT_VERSION) {
    problemas.push(
      `Versão de backup ${backup.versao_formato} inválida para esta tela. Esperado: ${BACKUP_FORMAT_VERSION}.`,
    );
  }

  if (backup.gerado_em) {
    const geradoEm = new Date(backup.gerado_em);
    if (Number.isNaN(geradoEm.getTime())) {
      avisos.push("Data gerado_em inválida no arquivo de backup.");
    } else {
      const dias = Math.floor((Date.now() - geradoEm.getTime()) / (1000 * 60 * 60 * 24));
      if (dias > 30) {
        avisos.push(`Backup antigo: gerado ha ${dias} dia(s). Considere usar backup mais recente.`);
      }
    }
  }

  if (backup.dados.configuracoes.length === 0) {
    avisos.push("Backup sem configurações. O sistema aplicará valores padrão.");
  }

  if (backup.dados.credenciais.length === 0 && !preservarUsuarioAtual) {
    problemas.push("Backup sem credenciais e sem preservação do usuário atual. Você pode perder acesso.");
  } else if (backup.dados.credenciais.length === 0) {
    avisos.push("Backup sem credenciais. O acesso dependerá da preservação do usuário atual.");
  }

  const duplicidades = [
    {
      label: "Credenciais",
      field: "usuario",
      rows: backup.dados.credenciais,
    },
    {
      label: "Configurações",
      field: "chave",
      rows: backup.dados.configuracoes,
    },
    {
      label: "Unidades",
      field: "nome",
      rows: backup.dados.unidades,
    },
    {
      label: "Setores",
      field: "nome",
      rows: backup.dados.setores,
    },
    {
      label: "Funções",
      field: "nome",
      rows: backup.dados.funcoes,
    },
    {
      label: "Funcionários",
      field: "matricula",
      rows: backup.dados.funcionarios,
    },
    {
      label: "Itens",
      field: "codigo",
      rows: backup.dados.itens,
    },
  ] as const;

  for (const group of duplicidades) {
    const duplicatedKeys = findDuplicates(
      group.rows.map((row) => (isObjectRecord(row) ? getStringField(row, group.field) : "")),
    );
    if (duplicatedKeys.length > 0) {
      problemas.push(`${group.label} com chave duplicada: ${formatSample(duplicatedKeys)}.`);
    }
  }

  const unidadesDisponiveis = new Set(
    normalizarListaNomes(
      backup.dados.unidades.map((row) => (isObjectRecord(row) ? getStringField(row, "nome") : "")),
    ),
  );
  const setoresDisponiveis = new Set(
    normalizarListaNomes(
      backup.dados.setores.map((row) => (isObjectRecord(row) ? getStringField(row, "nome") : "")),
    ),
  );
  const funcoesDisponiveis = new Set(
    normalizarListaNomes(
      backup.dados.funcoes.map((row) => (isObjectRecord(row) ? getStringField(row, "nome") : "")),
    ),
  );
  const matriculasFuncionarios = new Set(
    normalizarListaNomes(
      backup.dados.funcionarios.map((row) => (isObjectRecord(row) ? getStringField(row, "matricula") : "")),
    ),
  );

  const setorUnidadesByNome = new Map<string, Set<string>>();
  for (const [index, row] of backup.dados.setores.entries()) {
    if (!isObjectRecord(row)) {
      problemas.push(`Setor #${index + 1} com formato inválido.`);
      continue;
    }
    const setorNome = getStringField(row, "nome") || `#${index + 1}`;
    const unidadesSetor = normalizarListaNomes(getStringArrayField(row, "unidades"));
    if (unidadesSetor.length === 0) {
      avisos.push(`Setor ${setorNome} sem unidades vinculadas.`);
    }

    const unidadesInvalidas = unidadesSetor.filter((unidadeNome) => !unidadesDisponiveis.has(unidadeNome));
    if (unidadesInvalidas.length > 0) {
      problemas.push(`Setor ${setorNome} referencia unidades inexistentes: ${formatSample(unidadesInvalidas)}.`);
    }

    setorUnidadesByNome.set(
      setorNome,
      new Set(unidadesSetor.filter((unidadeNome) => unidadesDisponiveis.has(unidadeNome))),
    );
  }

  const funcionariosSemUnidade: string[] = [];
  const funcionariosSemSetor: string[] = [];
  const funcionariosSemFuncao: string[] = [];
  const referenciasUnidadeInexistente: string[] = [];
  const referenciasSetorInexistente: string[] = [];
  const referenciasFuncaoInexistente: string[] = [];
  const funcionariosComSetorIncompativel: string[] = [];
  const funcionariosComPrincipalIncompativel: string[] = [];

  for (const [index, row] of backup.dados.funcionarios.entries()) {
    if (!isObjectRecord(row)) {
      problemas.push(`Funcionário #${index + 1} com formato inválido.`);
      continue;
    }

    const matricula = getStringField(row, "matricula") || `#${index + 1}`;
    const unidadePrincipal = getStringField(row, "unidade");
    const setorPrincipal = getStringField(row, "setor");
    const funcaoPrincipal = getStringField(row, "funcao");

    const unidades = normalizarListaNomes([unidadePrincipal, ...getStringArrayField(row, "unidades")]);
    const setores = normalizarListaNomes([setorPrincipal, ...getStringArrayField(row, "setores")]);
    const funcoes = normalizarListaNomes([funcaoPrincipal, ...getStringArrayField(row, "funcoes")]);

    if (unidades.length === 0) funcionariosSemUnidade.push(matricula);
    if (setores.length === 0) funcionariosSemSetor.push(matricula);
    if (funcoes.length === 0) funcionariosSemFuncao.push(matricula);

    referenciasUnidadeInexistente.push(
      ...unidades.filter((unidadeNome) => !unidadesDisponiveis.has(unidadeNome)),
    );
    referenciasSetorInexistente.push(
      ...setores.filter((setorNome) => !setoresDisponiveis.has(setorNome)),
    );
    referenciasFuncaoInexistente.push(
      ...funcoes.filter((funcaoNome) => !funcoesDisponiveis.has(funcaoNome)),
    );

    const setoresIncompativeis = setores.filter((setorNome) => {
      const unidadesSetor = setorUnidadesByNome.get(setorNome);
      if (!unidadesSetor || unidadesSetor.size === 0) {
        return true;
      }
      return !unidades.some((unidadeNome) => unidadesSetor.has(unidadeNome));
    });
    if (setoresIncompativeis.length > 0) {
      funcionariosComSetorIncompativel.push(matricula);
    }

    if (setorPrincipal && unidadePrincipal) {
      const unidadesSetorPrincipal = setorUnidadesByNome.get(setorPrincipal);
      if (unidadesSetorPrincipal && unidadesSetorPrincipal.size > 0 && !unidadesSetorPrincipal.has(unidadePrincipal)) {
        funcionariosComPrincipalIncompativel.push(matricula);
      }
    }
  }
  if (funcionariosSemUnidade.length > 0) {
    problemas.push(`Funcionários sem unidade: ${formatSample(funcionariosSemUnidade)}.`);
  }
  if (funcionariosSemSetor.length > 0) {
    problemas.push(`Funcionários sem setor: ${formatSample(funcionariosSemSetor)}.`);
  }
  if (funcionariosSemFuncao.length > 0) {
    problemas.push(`Funcionários sem função: ${formatSample(funcionariosSemFuncao)}.`);
  }

  if (referenciasUnidadeInexistente.length > 0) {
    problemas.push(
      `Funcionários referenciam unidades inexistentes: ${formatSample(referenciasUnidadeInexistente)}.`,
    );
  }
  if (referenciasSetorInexistente.length > 0) {
    problemas.push(`Funcionários referenciam setores inexistentes: ${formatSample(referenciasSetorInexistente)}.`);
  }
  if (referenciasFuncaoInexistente.length > 0) {
    problemas.push(`Funcionários referenciam funções inexistentes: ${formatSample(referenciasFuncaoInexistente)}.`);
  }

  if (funcionariosComSetorIncompativel.length > 0) {
    problemas.push(
      `Funcionários com setor sem vínculo com suas unidades: ${formatSample(funcionariosComSetorIncompativel)}.`,
    );
  }
  if (funcionariosComPrincipalIncompativel.length > 0) {
    problemas.push(
      `Funcionários com setor principal incompatível com unidade principal: ${formatSample(funcionariosComPrincipalIncompativel)}.`,
    );
  }

  const itensComMatriculaInvalida: string[] = [];
  const itensEmprestadosSemVinculo: string[] = [];
  const itensDisponiveisComMatricula: string[] = [];

  for (const [index, row] of backup.dados.itens.entries()) {
    if (!isObjectRecord(row)) {
      problemas.push(`Item #${index + 1} com formato inválido.`);
      continue;
    }

    const codigo = getStringField(row, "codigo") || `#${index + 1}`;
    const solicitanteMatricula = getStringField(row, "solicitanteMatricula");
    const setorSolicitante = getStringField(row, "setorSolicitante");
    const status = getStringField(row, "status");

    if (solicitanteMatricula && !matriculasFuncionarios.has(solicitanteMatricula)) {
      itensComMatriculaInvalida.push(codigo);
    }
    if (status === "emprestado" && !solicitanteMatricula && !setorSolicitante) {
      itensEmprestadosSemVinculo.push(codigo);
    }
    if (status === "disponivel" && solicitanteMatricula) {
      itensDisponiveisComMatricula.push(codigo);
    }
  }

  if (itensComMatriculaInvalida.length > 0) {
    problemas.push(`Itens com matrícula inexistente: ${formatSample(itensComMatriculaInvalida)}.`);
  }
  if (itensEmprestadosSemVinculo.length > 0) {
    avisos.push(`Itens emprestados sem matrícula/setor: ${formatSample(itensEmprestadosSemVinculo)}.`);
  }
  if (itensDisponiveisComMatricula.length > 0) {
    avisos.push(`Itens disponíveis com matrícula preenchida: ${formatSample(itensDisponiveisComMatricula)}.`);
  }

  if (backup.dados.auditoria.length === 0) {
    avisos.push("Backup sem auditoria. O histórico de trilha será perdido na restauração.");
  }

  return {
    problemas: normalizarListaNomes(problemas),
    avisos: normalizarListaNomes(avisos),
  };
}

export function ManutencaoTab() {
  const [abaAtiva, setAbaAtiva] = useState<MaintenanceTab>("correcao");
  const [backupLoading, setBackupLoading] = useState(false);
  const [resetando, setResetando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [preservarUsuarioAtual, setPreservarUsuarioAtual] = useState(true);
  const [backupImportado, setBackupImportado] = useState<BackupPayload | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState("");
  const [arquivoInputKey, setArquivoInputKey] = useState(0);
  const [backupGeradoEm, setBackupGeradoEm] = useState<string | null>(null);
  const [resultadoUltimaAcao, setResultadoUltimaAcao] = useState<MaintenanceResult | null>(null);
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

  const totalBackupRegistros = useMemo(
    () => (backupCounts ? Object.values(backupCounts).reduce((acc, value) => acc + value, 0) : 0),
    [backupCounts],
  );

  const backupAnalise = useMemo(
    () => (backupImportado ? analisarBackup(backupImportado, preservarUsuarioAtual) : null),
    [backupImportado, preservarUsuarioAtual],
  );

  const backupComProblemas = (backupAnalise?.problemas.length ?? 0) > 0;
  const backupProntoParaRestaurar = Boolean(backupImportado) && !backupComProblemas;

  const fluxoStatus = useMemo(
    () => [
      {
        titulo: "Correção do arquivo",
        done: backupProntoParaRestaurar,
        descricao: backupImportado
          ? backupComProblemas
            ? "Corrija os problemas listados antes de restaurar."
            : "Arquivo validado e pronto para restauração."
          : "Importe um backup JSON para validar.",
      },
      {
        titulo: "Backup atual",
        done: Boolean(backupGeradoEm),
        descricao: backupGeradoEm
          ? `Gerado em ${formatDateTime(backupGeradoEm)}.`
          : "Gere backup antes de qualquer ação destrutiva.",
      },
      {
        titulo: "Alvos de reset",
        done: selectedTargets.length > 0,
        descricao:
          selectedTargets.length > 0
            ? `${selectedTargets.length} alvo(s) selecionado(s).`
            : "Selecione pelo menos um alvo para reset.",
      },
      {
        titulo: "Preservação de acesso",
        done: preservarUsuarioAtual,
        descricao: preservarUsuarioAtual
          ? "Usuário atual será preservado em reset/restauração."
          : "Sem preservação de usuário atual.",
      },
    ],
    [
      backupComProblemas,
      backupGeradoEm,
      backupImportado,
      backupProntoParaRestaurar,
      preservarUsuarioAtual,
      selectedTargets.length,
    ],
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

      setBackupGeradoEm(payload.gerado_em ?? new Date().toISOString());
      success("Backup gerado com sucesso");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao gerar backup");
    } finally {
      setBackupLoading(false);
    }
  }

  function limparArquivoImportado() {
    setBackupImportado(null);
    setArquivoSelecionado("");
    setArquivoInputKey((prev) => prev + 1);
  }
  async function importarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      limparArquivoImportado();
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;

      if (!isBackupPayload(parsed)) {
        throw new Error("Arquivo de backup inválido");
      }

      setBackupImportado(parsed);
      setArquivoSelecionado(file.name);
      success("Arquivo de backup carregado");
    } catch (err) {
      limparArquivoImportado();
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
      const payload = await api.post<ResetResponse>("/admin/manutencao/reset", {
        alvos: selectedTargets,
        preservar_usuario_atual: preservarUsuarioAtual,
      });

      setResultadoUltimaAcao({
        tipo: "reset",
        executadoEm: new Date().toISOString(),
        usuarioPreservado: payload.usuarioPreservado,
        contagens: toMaintenanceCounts(payload.contagens),
        alvos: payload.alvos?.length ? payload.alvos : selectedTargets,
      });

      success(
        payload.usuarioPreservado
          ? `Reset concluído. Usuário preservado: ${payload.usuarioPreservado}.`
          : "Reset concluido com sucesso.",
      );
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

    if (backupComProblemas) {
      error("Corrija os problemas do backup antes de restaurar.");
      return;
    }

    setRestaurando(true);
    try {
      const payload = await api.post<RestoreResponse>("/admin/manutencao/restaurar", {
        backup: backupImportado,
        preservar_usuario_atual: preservarUsuarioAtual,
      });

      setResultadoUltimaAcao({
        tipo: "restauracao",
        executadoEm: payload.restauradoEm ?? new Date().toISOString(),
        usuarioPreservado: payload.usuarioPreservado,
        contagens: toMaintenanceCounts(payload.contagens),
        alvos: [...ALL_TARGETS],
      });

      success(
        payload.usuarioPreservado
          ? `Restauração concluída. Usuário preservado: ${payload.usuarioPreservado}.`
          : "Restauração concluída com sucesso.",
      );
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

  function atualizarTarget(target: ResetTarget, checked: boolean) {
    setTargets((prev) => {
      const next = {
        ...prev,
        [target]: checked,
      };

      if (target === "unidades" && checked) {
        next.setores = true;
      }

      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/95 via-surface-2/88 to-card/92 p-3 shadow-[var(--shadow-soft)] dark:border-border/85 dark:from-card/88 dark:via-background/90 dark:to-card/84">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Centro de manutenção
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground sm:text-base">
              Correção, backup, restauração e reset em um fluxo único
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Valide o arquivo, gere backup atual e execute restauração/reset com segurança.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={backupProntoParaRestaurar ? "success" : "neutral"} className="text-[10px]">
              Arquivo: {backupProntoParaRestaurar ? "validado" : backupImportado ? "com pendências" : "não carregado"}
            </StatusPill>
            <StatusPill tone={backupGeradoEm ? "success" : "warning"} className="text-[10px]">
              Backup atual: {backupGeradoEm ? "ok" : "pendente"}
            </StatusPill>
            <StatusPill tone={selectedTargets.length > 0 ? "info" : "warning"} className="text-[10px]">
              Alvos reset: {selectedTargets.length}
            </StatusPill>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {fluxoStatus.map((item) => (
            <div key={item.titulo} className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 dark:bg-background/55">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-foreground">{item.titulo}</p>
                <StatusPill tone={item.done ? "success" : "warning"} className="text-[10px]">
                  {item.done ? "OK" : "Pendente"}
                </StatusPill>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.descricao}</p>
            </div>
          ))}
        </div>
      </div>

      {resultadoUltimaAcao ? (
        <SectionCard
          title={<span className="text-sm font-semibold">Última ação de manutenção</span>}
          icon={ClipboardList}
          description="Resumo da execução mais recente de reset/restauração."
          className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
          headerClassName={SECTION_HEADER_CLASS}
          contentClassName={SECTION_CONTENT_CLASS}
        >
          <div className={PANEL_CLASS}>
            <p>
              {resultadoUltimaAcao.tipo === "reset" ? "Reset" : "Restauração"} executado em{" "}
              <span className="font-medium text-foreground">{formatDateTime(resultadoUltimaAcao.executadoEm)}</span>.
            </p>
            <p className="mt-1">
              Usuário preservado:{" "}
              <span className="font-medium text-foreground">
                {resultadoUltimaAcao.usuarioPreservado || "nenhum"}
              </span>
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {resultadoUltimaAcao.alvos.map((target) => (
              <div key={target} className="rounded-lg border border-border/70 bg-surface-2/80 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">{TARGET_LABEL_BY_ID.get(target) ?? target}</p>
                <p className="text-muted-foreground">{resultadoUltimaAcao.contagens[target]} registros</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <Tabs value={abaAtiva} onValueChange={(value) => setAbaAtiva(value as MaintenanceTab)}>
        <div className="rounded-2xl border border-border/70 bg-card/94 p-1.5 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 border-0 bg-transparent p-0 shadow-none sm:grid-cols-4">
            <TabsTrigger value="correcao" className="h-9 px-2 text-[11px] sm:text-xs">
              Correção
            </TabsTrigger>
            <TabsTrigger value="backup" className="h-9 px-2 text-[11px] sm:text-xs">
              Backup
            </TabsTrigger>
            <TabsTrigger value="restauracao" className="h-9 px-2 text-[11px] sm:text-xs">
              Restauração
            </TabsTrigger>
            <TabsTrigger value="reset" className="h-9 px-2 text-[11px] sm:text-xs">
              Reset
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="correcao">
          <SectionCard
            title={<span className="text-sm font-semibold">Correção e Diagnóstico</span>}
            icon={Wrench}
            description="Importe o backup e veja tudo que precisa ser corrigido antes da restauração."
            className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
            headerClassName={SECTION_HEADER_CLASS}
            contentClassName={SECTION_CONTENT_CLASS}
            actions={(
              <Button
                variant="outline"
                className="h-8 rounded-lg text-xs"
                onClick={limparArquivoImportado}
                disabled={!backupImportado}
              >
                Limpar arquivo
              </Button>
            )}
          >
            <div className="space-y-2.5">
              <Input
                key={arquivoInputKey}
                type="file"
                accept="application/json,.json"
                onChange={(event) => void importarArquivo(event)}
                className="h-9 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/12 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone={backupImportado ? "success" : "neutral"} className="text-[10px]">
                  {backupImportado ? "Arquivo carregado" : "Nenhum arquivo"}
                </StatusPill>
                {arquivoSelecionado ? <span className="text-[11px] text-muted-foreground">{arquivoSelecionado}</span> : null}
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={preservarUsuarioAtual}
                  onCheckedChange={(checked) => setPreservarUsuarioAtual(Boolean(checked))}
                />
                Preservar meu usuário atual (aplica em reset e restauração)
              </label>
              {backupImportado ? (
                <div className={PANEL_CLASS}>
                  <p>
                    Formato: <span className="font-medium text-foreground">v{backupImportado.versao_formato}</span>
                    {" | "}
                    Registros no arquivo: <span className="font-medium text-foreground">{totalBackupRegistros}</span>
                  </p>
                  <p className="mt-1">
                    Gerado em: <span className="font-medium text-foreground">{formatDateTime(backupImportado.gerado_em)}</span>
                    {" | "}
                    Responsavel: <span className="font-medium text-foreground">{backupImportado.gerado_por ?? "--"}</span>
                  </p>
                </div>
              ) : (
                <div className={PANEL_CLASS}>
                  Importe o arquivo de backup para liberar a análise de correção e a restauração.
                </div>
              )}

              {backupImportado && backupAnalise?.problemas.length ? (
                <Alert variant="destructive" className="border-destructive/35 bg-destructive/8 py-2.5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-xs">Correção obrigatória antes da restauração</AlertTitle>
                  <AlertDescription className="text-xs">
                    <ul className="space-y-1">
                      {backupAnalise.problemas.slice(0, PREVIEW_LIMIT).map((item, index) => (
                        <li key={`problema-${index}`}>- {item}</li>
                      ))}
                      {backupAnalise.problemas.length > PREVIEW_LIMIT ? (
                        <li>- ... e mais {backupAnalise.problemas.length - PREVIEW_LIMIT} problema(s)</li>
                      ) : null}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              {backupImportado && backupAnalise?.avisos.length ? (
                <Alert variant="warning" className="py-2.5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-xs">Avisos de consistencia</AlertTitle>
                  <AlertDescription className="text-xs">
                    <ul className="space-y-1">
                      {backupAnalise.avisos.slice(0, PREVIEW_LIMIT).map((item, index) => (
                        <li key={`aviso-${index}`}>- {item}</li>
                      ))}
                      {backupAnalise.avisos.length > PREVIEW_LIMIT ? (
                        <li>- ... e mais {backupAnalise.avisos.length - PREVIEW_LIMIT} aviso(s)</li>
                      ) : null}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              {backupImportado && !backupComProblemas ? (
                <Alert variant="success" className="py-2.5">
                  <AlertTitle className="text-xs">Arquivo pronto para restauração</AlertTitle>
                  <AlertDescription className="text-xs">
                    Nenhum bloqueio encontrado na analise automatica.
                  </AlertDescription>
                </Alert>
              ) : null}

              {backupCounts ? (
                <div className="grid gap-2 sm:grid-cols-2">
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
        </TabsContent>

        <TabsContent value="backup">
          <SectionCard
            title={<span className="text-sm font-semibold">Backup</span>}
            icon={Database}
            description="Gera um arquivo JSON completo com dados e configurações do sistema."
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
            <div className={PANEL_CLASS}>
              Último backup gerado nesta sessão:{" "}
              <span className="font-medium text-foreground">{formatDateTime(backupGeradoEm)}</span>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="restauracao">
          <SectionCard
            title={<span className="text-sm font-semibold">Restauração</span>}
            icon={Upload}
            description="Substitui os dados atuais do banco pelo backup validado."
            className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
            headerClassName={SECTION_HEADER_CLASS}
            contentClassName={SECTION_CONTENT_CLASS}
            actions={(
              <Button
                variant="destructive"
                className="h-8 rounded-lg text-xs"
                onClick={() => setConfirmarRestauracao(true)}
                disabled={!backupImportado || backupComProblemas || restaurando}
              >
                <Upload className="h-3.5 w-3.5" />
                Restaurar backup
              </Button>
            )}
          >
            <div className={PANEL_CLASS}>
              A restauração apaga os dados atuais e insere o conteúdo do arquivo importado.
              {backupImportado ? (
                <>
                  {" "}
                  Registros no arquivo:{" "}
                  <span className="font-medium text-foreground">{totalBackupRegistros}</span>.
                </>
              ) : null}
            </div>

            {backupImportado && backupComProblemas ? (
              <p className="text-[11px] text-destructive">
                A restauração está bloqueada até a correção dos problemas apontados no diagnóstico.
              </p>
            ) : null}
          </SectionCard>
        </TabsContent>

        <TabsContent value="reset">
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
                Preservar meu usuário atual para evitar bloqueio de acesso
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                {RESET_TARGET_OPTIONS.map((item) => (
                  <label
                    key={item.value}
                    className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface-2/80 p-2.5 text-xs"
                  >
                    <Checkbox
                      checked={targets[item.value]}
                      disabled={item.value === "setores" && targets.unidades}
                      onCheckedChange={(checked) => atualizarTarget(item.value, Boolean(checked))}
                    />
                    <span>
                      <span className="block font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.helper}</span>
                    </span>
                  </label>
                ))}
              </div>

              {targets.unidades ? (
                <p className="text-[11px] text-muted-foreground">
                  O alvo Setores fica obrigatorio quando Unidades estiver selecionado.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

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
        title="Confirmar restauração de backup"
        description="A restauração substitui os dados atuais do banco. Essa ação não pode ser desfeita."
        confirmLabel="Restaurar backup"
        onConfirm={executarRestauracao}
      />
    </div>
  );
}
