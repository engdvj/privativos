export type PerfilAcesso = "setor" | "admin";

export interface SessionPayload {
  usuario: string;
  perfil: PerfilAcesso;
  nomeCompleto: string;
}

export interface SolicitanteSessionPayload {
  matricula: string;
  nomeFuncionario: string;
}
