import type { PerfilAcesso } from "../types/session.js";

export interface AuthenticatedUser {
  kind: "setor_admin" | "solicitante";
  token: string;
  perfil?: PerfilAcesso;
  usuario?: string;
  nomeCompleto?: string;
  matricula?: string;
  nomeFuncionario?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    startTimeNs?: bigint;
  }
}
