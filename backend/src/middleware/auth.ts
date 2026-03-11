import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../services/auth-service.js";
import { AppError } from "../errors/app-error.js";
import { getBearerToken } from "../utils/auth.js";
import type { PerfilAcesso } from "../types/session.js";

const authService = new AuthService();

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const token = getBearerToken(request.headers.authorization);

  if (!token) {
    throw new AppError(401, "UNAUTHENTICATED", "Token ausente");
  }

  const session = await authService.validarSessao(token);

  if (!session) {
    throw new AppError(401, "INVALID_SESSION", "Sessão inválida");
  }

  if (session.tipo === "setor_admin") {
    request.user = {
      kind: "setor_admin",
      token,
      perfil: session.dados.perfil,
      usuario: session.dados.usuario,
      nomeCompleto: session.dados.nomeCompleto,
    };
    return;
  }

  request.user = {
    kind: "solicitante",
    token,
    matricula: session.dados.matricula,
    nomeFuncionario: session.dados.nomeFuncionario,
  };
}

export function authorize(perfis: Array<PerfilAcesso | "solicitante">) {
  return async function checkRole(request: FastifyRequest, _reply: FastifyReply) {
    const user = request.user;

    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Não autenticado");
    }

    if (user.kind === "solicitante") {
      if (!perfis.includes("solicitante")) {
        throw new AppError(403, "FORBIDDEN", "Acesso negado");
      }
      return;
    }

    if (!user.perfil || !perfis.includes(user.perfil)) {
      throw new AppError(403, "FORBIDDEN", "Acesso negado");
    }
  };
}
