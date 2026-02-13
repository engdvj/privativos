export interface ApiError {
  erro: string;
  codigo?: string;
  detalhes?: unknown;
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("token");
  }

  clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("perfil");
    localStorage.removeItem("nome");
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

  saveSession(token: string, perfil: string, nome: string) {
    localStorage.setItem("token", token);
    localStorage.setItem("perfil", perfil);
    localStorage.setItem("nome", nome);
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

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
