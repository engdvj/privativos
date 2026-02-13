import type { ServerResponse } from "node:http";

interface SSEClient {
  id: number;
  response: ServerResponse;
}

export class SSEManager {
  private readonly clients = new Map<string, SSEClient[]>();
  private sequence = 0;

  register(matricula: string, response: ServerResponse) {
    const current = this.clients.get(matricula) ?? [];
    const clientId = ++this.sequence;
    current.push({ id: clientId, response });
    this.clients.set(matricula, current);

    return () => {
      const clients = this.clients.get(matricula) ?? [];
      const next = clients.filter((client) => client.id !== clientId);
      if (next.length === 0) {
        this.clients.delete(matricula);
        return;
      }
      this.clients.set(matricula, next);
    };
  }

  emit(matricula: string, event: string, payload: unknown) {
    const clients = this.clients.get(matricula) ?? [];
    if (clients.length === 0) {
      return;
    }

    const data = this.formatEvent(event, payload);

    for (const client of clients) {
      client.response.write(data);
    }
  }

  heartbeat() {
    for (const [matricula, clients] of this.clients.entries()) {
      if (clients.length === 0) {
        this.clients.delete(matricula);
        continue;
      }

      const data = this.formatEvent("heartbeat", { timestamp: new Date().toISOString() });
      for (const client of clients) {
        client.response.write(data);
      }
    }
  }

  private formatEvent(event: string, payload: unknown) {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  }
}

export const sseManager = new SSEManager();
