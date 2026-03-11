export type MonitorTipoOperacao = "emprestimo" | "devolucao";

export interface MonitorResumoData {
  tipo: MonitorTipoOperacao;
  funcionarioNome: string;
  funcionarioUnidade: string;
  funcionarioSetor: string;
  matricula: string;
  quantidade: number;
  tipo_item?: string | null;
  tamanho?: string | null;
  selecoes?: Array<{ tipo: string; tamanho: string; quantidade: number }>;
  itens: Array<{ codigo: string; descricao?: string | null; tipo?: string; tamanho?: string }>;
}

export interface MonitorResultadoData {
  tipo: MonitorTipoOperacao;
  sucesso: boolean;
  mensagem: string;
  itens: string[];
}

export type OperacaoMonitorEvent =
  | {
      kind: "waiting";
      timestamp: string;
      mensagem: string;
    }
  | {
      kind: "resumo";
      timestamp: string;
      data: MonitorResumoData;
    }
  | {
      kind: "resultado";
      timestamp: string;
      data: MonitorResultadoData;
    };

const CHANNEL_NAME = "operacao-monitor-channel";
const STORAGE_EVENT_KEY = "operacao-monitor-event";

function hasBroadcastChannel() {
  return typeof window !== "undefined" && "BroadcastChannel" in window;
}

function publishWithStorage(event: OperacaoMonitorEvent) {
  const payload = JSON.stringify({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    event,
  });

  localStorage.setItem(STORAGE_EVENT_KEY, payload);
}

export function readLastOperacaoMonitorEvent() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_EVENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { event?: OperacaoMonitorEvent };
    return parsed.event ?? null;
  } catch {
    return null;
  }
}

export function publishOperacaoMonitor(event: OperacaoMonitorEvent) {
  if (typeof window === "undefined") return;

  if (hasBroadcastChannel()) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  }

  publishWithStorage(event);
}

export function subscribeOperacaoMonitor(handler: (event: OperacaoMonitorEvent) => void) {
  let channel: BroadcastChannel | null = null;

  if (hasBroadcastChannel()) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (message: MessageEvent<OperacaoMonitorEvent>) => {
      handler(message.data);
    };
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) return;

    try {
      const parsed = JSON.parse(event.newValue) as { event?: OperacaoMonitorEvent };
      if (parsed.event) {
        handler(parsed.event);
      }
    } catch {
      // ignora payload inválido
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("storage", onStorage);
    if (channel) {
      channel.close();
    }
  };
}
