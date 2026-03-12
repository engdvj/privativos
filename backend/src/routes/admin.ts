import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { BACKUP_FORMAT_VERSION, RESET_DB_TARGETS } from "../constants/manutencao.js";
import { AppError } from "../errors/app-error.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminService } from "../services/admin-service.js";
import { DashboardService } from "../services/dashboard-service.js";
import { ExportService } from "../services/export-service.js";

const adminService = new AdminService();
const dashboardService = new DashboardService();
const exportService = new ExportService();
const tamanhoSchema = z
  .string()
  .min(1)
  .max(20)
  .transform((value) => value.trim().toUpperCase());
const tipoItemSchema = z
  .string()
  .max(100)
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .refine((value) => value.length > 0, "Tipo do item inválido");
const codigoItemSchema = z
  .string()
  .max(50)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "Código do item inválido");
const unidadesSchema = z.array(z.string().min(1).max(100)).min(1);
const setoresSchema = z.array(z.string().min(1).max(100)).min(1);
const funcoesSchema = z.array(z.string().min(1).max(100)).min(1);

const funcionarioCreateSchema = z
  .object({
    matricula: z.string().min(1).max(20),
    nome: z.string().min(1).max(150),
    unidade: z.string().min(1).max(100).optional(),
    unidade_principal: z.string().min(1).max(100).optional(),
    unidades: unidadesSchema.optional(),
    setor: z.string().min(1).max(100).optional(),
    setor_principal: z.string().min(1).max(100).optional(),
    setores: setoresSchema.optional(),
    funcao: z.string().min(1).max(100).optional(),
    funcao_principal: z.string().min(1).max(100).optional(),
    funcoes: funcoesSchema.optional(),
  })
  .refine((data) => Boolean(data.unidade_principal || data.unidade || data.unidades?.length), {
    message: "Informe ao menos uma unidade",
  })
  .refine((data) => Boolean(data.setor_principal || data.setor || data.setores?.length), {
    message: "Informe ao menos um setor",
  })
  .refine((data) => Boolean(data.funcao_principal || data.funcao || data.funcoes?.length), {
    message: "Informe ao menos uma função",
  });

const funcionarioUpdateSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  unidade: z.string().min(1).max(100).optional(),
  unidade_principal: z.string().min(1).max(100).optional(),
  unidades: unidadesSchema.optional(),
  setor: z.string().min(1).max(100).optional(),
  setor_principal: z.string().min(1).max(100).optional(),
  setores: setoresSchema.optional(),
  funcao: z.string().min(1).max(100).optional(),
  funcao_principal: z.string().min(1).max(100).optional(),
  funcoes: funcoesSchema.optional(),
  status_ativo: z.boolean().optional(),
});

const itemCreateSchema = z.object({
  codigo: codigoItemSchema,
  descricao: z.string().max(200).nullable().optional(),
  tipo: tipoItemSchema,
  tamanho: tamanhoSchema,
  status: z.enum(["disponivel", "emprestado", "inativo"]).optional(),
});

const itemUpdateSchema = z.object({
  codigo: codigoItemSchema.optional(),
  descricao: z.string().max(200).nullable().optional(),
  tipo: tipoItemSchema.optional(),
  tamanho: tamanhoSchema.optional(),
  status: z.enum(["disponivel", "emprestado", "inativo"]).optional(),
  status_ativo: z.boolean().optional(),
});
const itemBulkOperationSchema = z.object({
  acao: z.enum(["adicionar", "remover"]),
  tipo: tipoItemSchema,
  tamanho: tamanhoSchema,
  quantidade: z.coerce.number().int().positive().max(1000),
  descricao: z.string().max(200).nullable().optional(),
  status: z.enum(["disponivel", "emprestado", "inativo"]).optional(),
});
const itemBulkAdjustSchema = z.object({
  codigo_base: z
    .string()
    .max(40)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Codigo base invalido"),
  numero_inicial: z.coerce.number().int().min(0),
  casas_codigo: z.coerce.number().int().min(1).max(10).default(3),
  operacoes: z.array(itemBulkOperationSchema).min(1).max(120),
});

const credencialCreateSchema = z.object({
  usuario: z.string().min(1).max(100),
  senha: z.string().min(8).max(100),
  perfil: z.enum(["setor", "admin", "superadmin"]),
  nome_completo: z.string().min(1).max(150),
});

const credencialUpdateSchema = z.object({
  nome_completo: z.string().min(1).max(150).optional(),
  perfil: z.enum(["setor", "admin", "superadmin"]).optional(),
  ativo: z.boolean().optional(),
  senha: z.string().min(8).max(100).optional(),
  deve_alterar_senha: z.boolean().optional(),
});

const configUpdateSchema = z.object({
  max_kits_por_funcionario: z.coerce.number().int().positive(),
});

const configResetSchema = z.object({
  chaves: z.array(z.string().min(1).max(100)).optional(),
});

const resetDbTargetSchema = z.enum(RESET_DB_TARGETS);
const dateLikeSchema = z.union([z.string(), z.date()]);

const maintenanceResetSchema = z.object({
  alvos: z.array(resetDbTargetSchema).optional(),
  preservar_usuario_atual: z.boolean().optional(),
});

const backupDataSchema = z.object({
  configuracoes: z.array(
    z.object({
      chave: z.string().min(1).max(100),
      valor: z.string().min(1).max(255),
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  credenciais: z.array(
    z.object({
      usuario: z.string().min(1).max(100),
      senhaHash: z.string().min(1).max(255),
      perfil: z.enum(["setor", "admin", "superadmin"]),
      nomeCompleto: z.string().min(1).max(150),
      ativo: z.boolean(),
      deveAlterarSenha: z.boolean(),
      temaPreferido: z.string().min(1).max(10).default("light"),
      criadoEm: dateLikeSchema,
      criadoPor: z.string().min(1).max(150),
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  setores: z.array(
    z.object({
      nome: z.string().min(1).max(100),
      statusAtivo: z.boolean(),
      unidades: z.array(z.string().min(1).max(100)).optional(),
      criadoEm: dateLikeSchema,
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  unidades: z.array(
    z.object({
      nome: z.string().min(1).max(100),
      statusAtivo: z.boolean(),
      criadoEm: dateLikeSchema,
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  funcoes: z.array(
    z.object({
      nome: z.string().min(1).max(100),
      statusAtivo: z.boolean(),
      criadoEm: dateLikeSchema,
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  funcionarios: z.array(
    z.object({
      matricula: z.string().min(1).max(20),
      nome: z.string().min(1).max(150),
      unidade: z.string().min(1).max(100).optional(),
      unidades: z.array(z.string().min(1).max(100)).optional(),
      setor: z.string().min(1).max(100).optional(),
      setores: z.array(z.string().min(1).max(100)).optional(),
      funcao: z.string().min(1).max(100),
      funcoes: z.array(z.string().min(1).max(100)).optional(),
      statusAtivo: z.boolean(),
      criadoEm: dateLikeSchema,
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  itens: z.array(
    z.object({
      codigo: z.string().min(1).max(50),
      descricao: z.string().max(200).nullable().optional(),
      tipo: z.string().min(1).max(100).optional(),
      tamanho: z.string().min(1).max(20),
      status: z.enum(["disponivel", "emprestado", "inativo"]),
      solicitanteMatricula: z.string().max(20).nullable().optional(),
      setorSolicitante: z.string().max(100).nullable().optional(),
      dataEmprestimo: dateLikeSchema.nullable().optional(),
      statusAtivo: z.boolean(),
      criadoEm: dateLikeSchema,
      atualizadoPor: z.string().max(150).nullable().optional(),
      atualizadoEm: dateLikeSchema.nullable().optional(),
    }),
  ),
  solicitacoes: z.array(
    z.object({
      timestamp: dateLikeSchema,
      matricula: z.string().min(1).max(20),
      nomeFuncionario: z.string().min(1).max(150),
      itemCodigo: z.string().min(1).max(50),
      operadorNome: z.string().min(1).max(150),
      origemOperacao: z.enum(["colaborador", "setor"]).optional(),
      setorSolicitante: z.string().max(100).nullable().optional(),
    }),
  ),
  devolucoes: z.array(
    z.object({
      timestamp: dateLikeSchema,
      matricula: z.string().min(1).max(20),
      nomeFuncionario: z.string().min(1).max(150),
      itemCodigo: z.string().min(1).max(50),
      operadorNome: z.string().min(1).max(150),
      origemOperacao: z.enum(["colaborador", "setor"]).optional(),
      setorSolicitante: z.string().max(100).nullable().optional(),
    }),
  ),
  auditoria: z.array(
    z.object({
      timestamp: dateLikeSchema,
      operador: z.string().min(1).max(150),
      entidade: z.string().min(1).max(50),
      operacao: z.string().min(1).max(20),
      registroId: z.string().min(1).max(100),
      dadosAntes: z.unknown().optional().nullable(),
      dadosDepois: z.unknown().optional().nullable(),
    }),
  ),
});

const maintenanceRestoreSchema = z.object({
  backup: z.object({
    versao_formato: z.coerce.number().int().positive(),
    gerado_em: dateLikeSchema.optional(),
    gerado_por: z.string().min(1).max(150).optional(),
    dados: backupDataSchema,
  }),
  preservar_usuario_atual: z.boolean().optional(),
});

const catalogoCreateSchema = z.object({
  nome: z.string().min(1).max(100),
});

const catalogoUpdateSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  status_ativo: z.boolean().optional(),
});

const setorCreateSchema = z.object({
  nome: z.string().min(1).max(100),
  unidades: z.array(z.string().min(1).max(100)).min(1).optional(),
});

const setorUpdateSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  unidades: z.array(z.string().min(1).max(100)).min(1).optional(),
  status_ativo: z.boolean().optional(),
});

const dashboardFiltrosSchema = z.object({
  data_inicio: z.string().min(1).optional(),
  data_fim: z.string().min(1).optional(),
  unidade: z.string().min(1).max(100).optional(),
  setor: z.string().min(1).max(100).optional(),
  matricula: z.string().min(1).max(20).optional(),
  origem: z.enum(["colaborador", "setor"]).optional(),
});

const setorFuncionariosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(5).max(100).default(10),
  include_inactive: z.string().optional(),
});

function parseBool(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function normalizarTextoOpcional(value: string | null | undefined) {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function ensureSuperadmin(request: { user?: { kind?: string; perfil?: string } }) {
  if (request.user?.kind !== "setor_admin" || request.user.perfil !== "superadmin") {
    throw new AppError(403, "FORBIDDEN", "Acesso permitido somente para superadmin");
  }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", authorize(["admin", "superadmin"]));

  app.get("/admin/funcionarios", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listFuncionarios(includeInactive);
    return reply.status(200).send(rows);
  });

  app.post("/admin/funcionarios", async (request, reply) => {
    const parsed = funcionarioCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.createFuncionario({
      matricula: parsed.data.matricula,
      nome: parsed.data.nome,
      unidade: parsed.data.unidade_principal ?? parsed.data.unidade,
      unidades: parsed.data.unidades,
      setor: parsed.data.setor_principal ?? parsed.data.setor,
      setores: parsed.data.setores,
      funcao: parsed.data.funcao_principal ?? parsed.data.funcao,
      funcoes: parsed.data.funcoes,
      operador,
    });
    return reply.status(201).send(row);
  });

  app.put("/admin/funcionarios/:matricula", async (request, reply) => {
    const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);
    const parsed = funcionarioUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.updateFuncionario(params.matricula, {
      nome: parsed.data.nome,
      unidade: parsed.data.unidade_principal ?? parsed.data.unidade,
      unidades: parsed.data.unidades,
      setor: parsed.data.setor_principal ?? parsed.data.setor,
      setores: parsed.data.setores,
      funcao: parsed.data.funcao_principal ?? parsed.data.funcao,
      funcoes: parsed.data.funcoes,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });

    return reply.status(200).send(row);
  });

  app.delete("/admin/funcionarios/:matricula", async (request, reply) => {
    const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);
    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }
    await adminService.deleteFuncionario(params.matricula, operador);
    return reply.status(204).send();
  });

  app.get("/admin/setores", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listSetores(includeInactive);
    return reply.status(200).send(rows);
  });

  app.get("/admin/unidades", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listUnidades(includeInactive);
    return reply.status(200).send(rows);
  });

  app.get("/admin/unidades/:id/funcionarios", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const query = setorFuncionariosQuerySchema.parse(request.query ?? {});
    const includeInactive = parseBool(query.include_inactive);

    const result = await adminService.listFuncionariosPorUnidade(params.id, {
      pagina: query.pagina,
      limite: query.limite,
      includeInactive,
    });

    return reply.status(200).send(result);
  });

  app.post("/admin/unidades", async (request, reply) => {
    const parsed = catalogoCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.createUnidade({ nome: parsed.data.nome, operador });
    return reply.status(201).send(row);
  });

  app.put("/admin/unidades/:id", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const parsed = catalogoUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.updateUnidade(params.id, {
      nome: parsed.data.nome,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });
    return reply.status(200).send(row);
  });

  app.delete("/admin/unidades/:id", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }
    await adminService.deleteUnidade(params.id, operador);
    return reply.status(204).send();
  });

  app.get("/admin/setores/:id/funcionarios", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const query = setorFuncionariosQuerySchema.parse(request.query ?? {});
    const includeInactive = parseBool(query.include_inactive);

    const result = await adminService.listFuncionariosPorSetor(params.id, {
      pagina: query.pagina,
      limite: query.limite,
      includeInactive,
    });

    return reply.status(200).send(result);
  });

  app.post("/admin/setores", async (request, reply) => {
    const parsed = setorCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.createSetor({
      nome: parsed.data.nome,
      unidades: parsed.data.unidades,
      operador,
    });
    return reply.status(201).send(row);
  });

  app.put("/admin/setores/:id", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const parsed = setorUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.updateSetor(params.id, {
      nome: parsed.data.nome,
      unidades: parsed.data.unidades,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });
    return reply.status(200).send(row);
  });

  app.delete("/admin/setores/:id", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }
    await adminService.deleteSetor(params.id, operador);
    return reply.status(204).send();
  });

  app.get("/admin/funcoes", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listFuncoes(includeInactive);
    return reply.status(200).send(rows);
  });

  app.get("/admin/funcoes/:id/funcionarios", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const query = setorFuncionariosQuerySchema.parse(request.query ?? {});
    const includeInactive = parseBool(query.include_inactive);

    const result = await adminService.listFuncionariosPorFuncao(params.id, {
      pagina: query.pagina,
      limite: query.limite,
      includeInactive,
    });

    return reply.status(200).send(result);
  });

  app.post("/admin/funcoes", async (request, reply) => {
    const parsed = catalogoCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.createFuncao({ nome: parsed.data.nome, operador });
    return reply.status(201).send(row);
  });

  app.put("/admin/funcoes/:id", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const parsed = catalogoUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.updateFuncao(params.id, {
      nome: parsed.data.nome,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });
    return reply.status(200).send(row);
  });

  app.delete("/admin/funcoes/:id", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }
    await adminService.deleteFuncao(params.id, operador);
    return reply.status(204).send();
  });

  app.get("/admin/itens", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listItens(includeInactive);
    return reply.status(200).send(rows);
  });

  app.post("/admin/itens", async (request, reply) => {
    const parsed = itemCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.createItem({
      codigo: parsed.data.codigo,
      descricao: normalizarTextoOpcional(parsed.data.descricao),
      tipo: parsed.data.tipo,
      tamanho: parsed.data.tamanho,
      status: parsed.data.status,
      operador,
    });
    return reply.status(201).send(row);
  });

  app.post("/admin/itens/lote-misto", async (request, reply) => {
    const parsed = itemBulkAdjustSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
    }

    const resultado = await adminService.processarLoteMistoItens({
      codigoBase: parsed.data.codigo_base,
      numeroInicial: parsed.data.numero_inicial,
      casasCodigo: parsed.data.casas_codigo,
      operacoes: parsed.data.operacoes.map((operacao) => ({
        acao: operacao.acao,
        tipo: operacao.tipo,
        tamanho: operacao.tamanho,
        quantidade: operacao.quantidade,
        descricao: operacao.acao === "adicionar"
          ? normalizarTextoOpcional(operacao.descricao)
          : undefined,
        status: operacao.acao === "adicionar" ? operacao.status : undefined,
      })),
      operador,
    });

    return reply.status(200).send(resultado);
  });

  app.put("/admin/itens/:codigo", async (request, reply) => {
    const params = z.object({ codigo: codigoItemSchema }).parse(request.params);
    const parsed = itemUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.updateItem(params.codigo, {
      codigo: parsed.data.codigo,
      descricao: parsed.data.descricao === undefined
        ? undefined
        : normalizarTextoOpcional(parsed.data.descricao),
      tipo: parsed.data.tipo,
      tamanho: parsed.data.tamanho,
      status: parsed.data.status,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });

    return reply.status(200).send(row);
  });

  app.delete("/admin/itens/:codigo", async (request, reply) => {
    const params = z.object({ codigo: codigoItemSchema }).parse(request.params);
    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }
    await adminService.deleteItem(params.codigo, operador);
    return reply.status(204).send();
  });

  app.get("/admin/credenciais", async (_request, reply) => {
    ensureSuperadmin(_request);
    const rows = await adminService.listCredenciais();
    return reply.status(200).send(rows);
  });

  app.post("/admin/credenciais", async (request, reply) => {
    ensureSuperadmin(request);
    const parsed = credencialCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.createCredencial({
      usuario: parsed.data.usuario,
      senha: parsed.data.senha,
      perfil: parsed.data.perfil,
      nomeCompleto: parsed.data.nome_completo,
      operador,
    });

    return reply.status(201).send(row);
  });

  app.put("/admin/credenciais/:usuario", async (request, reply) => {
    ensureSuperadmin(request);
    const params = z.object({ usuario: z.string().min(1).max(100) }).parse(request.params);
    const parsed = credencialUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.updateCredencial(params.usuario, {
      nomeCompleto: parsed.data.nome_completo,
      perfil: parsed.data.perfil,
      ativo: parsed.data.ativo,
      senha: parsed.data.senha,
      deveAlterarSenha: parsed.data.deve_alterar_senha,
      operador,
    });

    return reply.status(200).send(row);
  });

  app.delete("/admin/credenciais/:usuario", async (request, reply) => {
    ensureSuperadmin(request);
    const params = z.object({ usuario: z.string().min(1).max(100) }).parse(request.params);

    if (request.user?.usuario === params.usuario) {
      throw new AppError(400, "INVALID_OPERATION", "Não é permitido apagar a própria credencial");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    await adminService.deleteCredencial(params.usuario, operador);
    return reply.status(204).send();
  });

  app.get("/admin/configuracoes", async (_request, reply) => {
    ensureSuperadmin(_request);
    const rows = await adminService.getConfiguracoes();
    return reply.status(200).send(rows);
  });

  app.put("/admin/configuracoes/max-kits", async (request, reply) => {
    ensureSuperadmin(request);
    const parsed = configUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const row = await adminService.setMaxKitsPorFuncionario(parsed.data.max_kits_por_funcionario, operador);
    return reply.status(200).send(row);
  });

  app.post("/admin/configuracoes/reset", async (request, reply) => {
    ensureSuperadmin(request);
    const parsed = configResetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const rows = await adminService.resetConfiguracoes(parsed.data.chaves, operador);
    return reply.status(200).send(rows);
  });

  app.get("/admin/manutencao/backup", async (request, reply) => {
    ensureSuperadmin(request);
    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const backup = await adminService.gerarBackupBanco(operador);
    return reply.status(200).send(backup);
  });

  app.post("/admin/manutencao/reset", async (request, reply) => {
    ensureSuperadmin(request);
    const parsed = maintenanceResetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const result = await adminService.resetBanco({
      alvos: parsed.data.alvos,
      preservarUsuarioAtual: parsed.data.preservar_usuario_atual,
      usuarioAtual: request.user?.usuario,
      operador,
    });

    return reply.status(200).send(result);
  });

  app.post("/admin/manutencao/restaurar", async (request, reply) => {
    ensureSuperadmin(request);
    const parsed = maintenanceRestoreSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    if (parsed.data.backup.versao_formato !== BACKUP_FORMAT_VERSION) {
      throw new AppError(
        400,
        "INVALID_PAYLOAD",
        `Versão de backup inválida. Esperado ${BACKUP_FORMAT_VERSION}.`,
      );
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida");
    }

    const result = await adminService.restaurarBanco({
      backup: parsed.data.backup,
      preservarUsuarioAtual: parsed.data.preservar_usuario_atual,
      usuarioAtual: request.user?.usuario,
      operador,
    });

    return reply.status(200).send(result);
  });

  app.get("/admin/auditoria", async (request, reply) => {
    ensureSuperadmin(request);
    const limit = Number((request.query as Record<string, unknown>)?.limit ?? 100);
    const rows = await adminService.listAuditoria(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100);
    return reply.status(200).send(rows);
  });

  app.post("/admin/dashboard", async (request, reply) => {
    const parsed = dashboardFiltrosSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const data = await dashboardService.getData(parsed.data);
    return reply.status(200).send(data);
  });

  app.get("/admin/dashboard/filtros", async (_request, reply) => {
    const data = await dashboardService.getFilterOptions();
    return reply.status(200).send(data);
  });

  app.post("/admin/export", async (request, reply) => {
    const parsed = dashboardFiltrosSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload inválido");
    }

    const xlsx = await exportService.gerarXlsx(parsed.data);
    const buffer = Buffer.isBuffer(xlsx) ? xlsx : Buffer.from(xlsx);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .header("Content-Disposition", `attachment; filename=\"privativos_export_${timestamp}.xlsx\"`)
      .send(buffer);
  });
};
