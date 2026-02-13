export type ItemStatus = "disponivel" | "emprestado" | "inativo";

export interface FuncionarioRow {
  matricula: string;
  nome: string;
  setor: string;
  funcao: string;
  statusAtivo: boolean;
}

export interface ItemRow {
  codigo: string;
  descricao: string;
  status: ItemStatus;
  statusAtivo: boolean;
}

export interface FuncionarioDraft {
  nome: string;
  setor: string;
  funcao: string;
  status_ativo: boolean;
}

export interface CatalogoRow {
  id: number;
  nome: string;
  statusAtivo: boolean;
}

export interface ItemDraft {
  descricao: string;
  status: ItemStatus;
  status_ativo: boolean;
}

export type PerfilAcesso = "setor" | "admin" | "superadmin";

export interface CredencialRow {
  id: number;
  usuario: string;
  perfil: PerfilAcesso;
  nomeCompleto: string;
  ativo: boolean;
  deveAlterarSenha: boolean;
}

export interface CredencialDraft {
  nome_completo: string;
  perfil: PerfilAcesso;
  ativo: boolean;
  deve_alterar_senha: boolean;
  senha: string;
}

export interface DashboardFiltersResponse {
  setores: string[];
  funcionarios: Array<{ matricula: string; nome: string }>;
}

export interface DashboardDataResponse {
  kpis: {
    total_emprestimos: number;
    total_devolucoes: number;
    itens_disponiveis: number;
    itens_emprestados: number;
    funcionarios_ativos: number;
  };
  rows: {
    solicitacoes: Array<{
      id: number;
      timestamp: string;
      matricula: string;
      nome_funcionario: string;
      item_codigo: string;
      operador_nome: string;
      setor: string | null;
    }>;
    devolucoes: Array<{
      id: number;
      timestamp: string;
      matricula: string;
      nome_funcionario: string;
      item_codigo: string;
      operador_nome: string;
      setor: string | null;
    }>;
  };
  total: number;
  gerado_em: string;
}

export interface AuditoriaRow {
  id: number;
  timestamp: string;
  operador: string;
  entidade: string;
  operacao: string;
  registroId: string;
  dadosAntes: unknown;
  dadosDepois: unknown;
}

export interface ConfiguracaoRow {
  chave: string;
  valor: string;
  atualizadoPor: string | null;
  atualizadoEm: string | null;
}
