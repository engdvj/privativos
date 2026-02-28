export const BACKUP_FORMAT_VERSION = 2 as const;

export const RESET_DB_TARGETS = [
  "credenciais",
  "configuracoes",
  "unidades",
  "setores",
  "funcoes",
  "funcionarios",
  "itens",
  "solicitacoes",
  "devolucoes",
  "auditoria",
] as const;

export type ResetDbTarget = (typeof RESET_DB_TARGETS)[number];
