export interface ApiError {
  erro: string;
  codigo?: string;
  detalhes?: unknown;
}

type Perfil = "setor" | "admin" | "superadmin";

type SessionResponse =
  | {
      tipo: "setor_admin";
      dados: {
        usuario: string;
        perfil: Perfil;
        nomeCompleto: string;
      };
    }
  | {
      tipo: "solicitante";
      dados: {
        matricula: string;
        nomeFuncionario: string;
      };
    };

class ApiClient {
  private inFlightGetRequests = new Map<string, Promise<unknown>>();

  private getToken(): string | null {
    return localStorage.getItem("token");
  }

  private getInFlightGetKey(path: string): string {
    const token = this.getToken() ?? "";
    return `${token}::${path}`;
  }

  private parseResponsePayload(raw: string, contentType: string): unknown {
    const body = raw.trim();
    if (!body) {
      return null;
    }

    const isJson = contentType.toLowerCase().includes("application/json");
    if (isJson || body.startsWith("{") || body.startsWith("[")) {
      try {
        return JSON.parse(body) as unknown;
      } catch {
        if (isJson) {
          return null;
        }
      }
    }

    return body;
  }

  private isSafePlainErrorText(value: string): boolean {
    const text = value.trim();
    if (!text || text.length > 180) {
      return false;
    }

    if (
      text.startsWith("{") ||
      text.startsWith("[") ||
      text.startsWith("<") ||
      text.toLowerCase().startsWith("doctype")
    ) {
      return false;
    }

    return true;
  }

  private extractApiError(payload: unknown): { message?: string; codigo?: string } {
    if (typeof payload === "string") {
      const message = this.isSafePlainErrorText(payload) ? payload.trim() : undefined;
      return { message };
    }

    if (!payload || typeof payload !== "object") {
      return {};
    }

    const data = payload as Record<string, unknown>;
    const messageKeys = ["erro", "error", "message", "mensagem"] as const;
    let message: string | undefined;

    for (const key of messageKeys) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) {
        message = value.trim();
        break;
      }
    }

    if (!message && typeof data.detail === "string" && data.detail.trim()) {
      message = data.detail.trim();
    }

    const codigo = typeof data.codigo === "string" && data.codigo.trim()
      ? data.codigo.trim()
      : undefined;

    return { message, codigo };
  }

  private defaultErrorMessage(status: number): string {
    if (status >= 500) return "Erro interno";
    if (status === 404) return "Recurso nao encontrado";
    if (status === 403) return "Acesso negado";
    if (status === 401) return "Sessao expirada";
    if (status === 409) return "Operacao nao permitida";
    if (status >= 400) return "Requisicao invalida";
    return "Erro desconhecido";
  }

  clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("perfil");
    localStorage.removeItem("nome");
    localStorage.removeItem("theme");
    this.inFlightGetRequests.clear();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getPerfil(): string | null {
    return localStorage.getItem("perfil");
  }

  getNome(): string | null {
    return localStorage.getItem("nome");
  }

  saveSession(token: string, perfil: string, nome: string, tema?: string) {
    localStorage.setItem("token", token);
    localStorage.setItem("perfil", perfil);
    localStorage.setItem("nome", nome);
    if (tema) {
      localStorage.setItem("theme", tema);
      document.documentElement.classList.toggle("dark", tema === "dark");
    }
  }

  async atualizarTema(tema: "light" | "dark"): Promise<void> {
    await this.put("/auth/tema", { tema });
    localStorage.setItem("theme", tema);
    document.documentElement.classList.toggle("dark", tema === "dark");
  }

  async validateSetorAdminSession(expectedPerfis?: Perfil | Perfil[]): Promise<boolean> {
    if (!this.isAuthenticated()) return false;

    try {
      const session = await this.get<SessionResponse>("/auth/session");

      if (session.tipo !== "setor_admin") {
        this.clearSession();
        return false;
      }

      if (expectedPerfis) {
        const perfis = Array.isArray(expectedPerfis) ? expectedPerfis : [expectedPerfis];
        if (!perfis.includes(session.dados.perfil)) {
          this.clearSession();
          return false;
        }
      }

      localStorage.setItem("perfil", session.dados.perfil);
      localStorage.setItem("nome", session.dados.nomeCompleto);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async get<T>(path: string): Promise<T> {
    const key = this.getInFlightGetKey(path);
    const inFlight = this.inFlightGetRequests.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const requestPromise = this.request<T>("GET", path)
      .finally(() => {
        this.inFlightGetRequests.delete(key);
      }) as Promise<T>;

    this.inFlightGetRequests.set(key, requestPromise as Promise<unknown>);
    return requestPromise;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async del<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async postBlob(path: string, body?: unknown): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(path, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401) {
      this.clearSession();
      window.location.href = "/";
      throw new Error("Sessao expirada");
    }

    if (!res.ok) {
      const raw = await res.text();
      const contentType = res.headers.get("content-type") ?? "";
      const payload = this.parseResponsePayload(raw, contentType);
      const { message } = this.extractApiError(payload);
      throw new Error(message || "Erro ao processar exportacao");
    }

    return res.blob();
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const opts: RequestInit = { method, headers };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(path, opts);

    if (res.status === 401) {
      this.clearSession();
      window.location.href = "/";
      throw new Error("Sessao expirada");
    }

    if (res.status === 204) {
      return {} as T;
    }

    const raw = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    const data = this.parseResponsePayload(raw, contentType);

    if (!res.ok) {
      const { message, codigo } = this.extractApiError(data);
      const err = new Error(message || this.defaultErrorMessage(res.status)) as Error & {
        status: number;
        codigo: string;
      };
      err.status = res.status;
      err.codigo = codigo ?? "";
      throw err;
    }

    if (data === null) {
      return {} as T;
    }

    return data as T;
  }
}

export const api = new ApiClient();
