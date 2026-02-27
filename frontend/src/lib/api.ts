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
  private getToken(): string | null {
    return localStorage.getItem("token");
  }

  clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("perfil");
    localStorage.removeItem("nome");
    localStorage.removeItem("theme");
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
    return this.request<T>("GET", path);
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
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        throw new Error(data.erro || "Erro desconhecido");
      }
      throw new Error("Erro ao processar exportacao");
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

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.erro || "Erro desconhecido") as Error & {
        status: number;
        codigo: string;
      };
      err.status = res.status;
      err.codigo = data.codigo;
      throw err;
    }

    return data as T;
  }
}

export const api = new ApiClient();
