import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminService } from "../services/admin-service.js";
import { DashboardService } from "../services/dashboard-service.js";
import { ExportService } from "../services/export-service.js";

const adminService = new AdminService();
const dashboardService = new DashboardService();
const exportService = new ExportService();

const funcionarioCreateSchema = z.object({
  matricula: z.string().min(1).max(20),
  nome: z.string().min(1).max(150),
  setor: z.string().min(1).max(100),
  funcao: z.string().min(1).max(100),
});

const funcionarioUpdateSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  setor: z.string().min(1).max(100).optional(),
  funcao: z.string().min(1).max(100).optional(),
  status_ativo: z.boolean().optional(),
});

const itemCreateSchema = z.object({
  codigo: z.string().min(1).max(50),
  descricao: z.string().min(1).max(200),
  status: z.enum(["disponivel", "emprestado", "inativo"]).optional(),
});

const itemUpdateSchema = z.object({
  descricao: z.string().min(1).max(200).optional(),
  status: z.enum(["disponivel", "emprestado", "inativo"]).optional(),
  status_ativo: z.boolean().optional(),
});

const credencialCreateSchema = z.object({
  usuario: z.string().min(1).max(100),
  senha: z.string().min(8).max(100),
  perfil: z.enum(["setor", "admin"]),
  nome_completo: z.string().min(1).max(150),
});

const credencialUpdateSchema = z.object({
  nome_completo: z.string().min(1).max(150).optional(),
  perfil: z.enum(["setor", "admin"]).optional(),
  ativo: z.boolean().optional(),
  senha: z.string().min(8).max(100).optional(),
  deve_alterar_senha: z.boolean().optional(),
});

const configUpdateSchema = z.object({
  max_kits_por_funcionario: z.coerce.number().int().positive(),
});

const dashboardFiltrosSchema = z.object({
  data_inicio: z.string().min(1).optional(),
  data_fim: z.string().min(1).optional(),
  setor: z.string().min(1).max(100).optional(),
  matricula: z.string().min(1).max(20).optional(),
});

function parseBool(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", authorize(["admin"]));

  app.get("/admin/funcionarios", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listFuncionarios(includeInactive);
    return reply.status(200).send(rows);
  });

  app.post("/admin/funcionarios", async (request, reply) => {
    const parsed = funcionarioCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
    }

    const row = await adminService.createFuncionario({ ...parsed.data, operador });
    return reply.status(201).send(row);
  });

  app.put("/admin/funcionarios/:matricula", async (request, reply) => {
    const params = z.object({ matricula: z.string().min(1).max(20) }).parse(request.params);
    const parsed = funcionarioUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
    }

    const row = await adminService.updateFuncionario(params.matricula, {
      nome: parsed.data.nome,
      setor: parsed.data.setor,
      funcao: parsed.data.funcao,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });

    return reply.status(200).send(row);
  });

  app.get("/admin/itens", async (request, reply) => {
    const includeInactive = parseBool((request.query as Record<string, unknown>)?.include_inactive);
    const rows = await adminService.listItens(includeInactive);
    return reply.status(200).send(rows);
  });

  app.post("/admin/itens", async (request, reply) => {
    const parsed = itemCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
    }

    const row = await adminService.createItem({ ...parsed.data, operador });
    return reply.status(201).send(row);
  });

  app.put("/admin/itens/:codigo", async (request, reply) => {
    const params = z.object({ codigo: z.string().min(1).max(50) }).parse(request.params);
    const parsed = itemUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
    }

    const row = await adminService.updateItem(params.codigo, {
      descricao: parsed.data.descricao,
      status: parsed.data.status,
      statusAtivo: parsed.data.status_ativo,
      operador,
    });

    return reply.status(200).send(row);
  });

  app.get("/admin/credenciais", async (_request, reply) => {
    const rows = await adminService.listCredenciais();
    return reply.status(200).send(rows);
  });

  app.post("/admin/credenciais", async (request, reply) => {
    const parsed = credencialCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
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
    const params = z.object({ usuario: z.string().min(1).max(100) }).parse(request.params);
    const parsed = credencialUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
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

  app.get("/admin/configuracoes", async (_request, reply) => {
    const rows = await adminService.getConfiguracoes();
    return reply.status(200).send(rows);
  });

  app.put("/admin/configuracoes/max-kits", async (request, reply) => {
    const parsed = configUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const operador = request.user?.nomeCompleto;
    if (!operador) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessao invalida");
    }

    const row = await adminService.setMaxKitsPorFuncionario(parsed.data.max_kits_por_funcionario, operador);
    return reply.status(200).send(row);
  });

  app.get("/admin/auditoria", async (request, reply) => {
    const limit = Number((request.query as Record<string, unknown>)?.limit ?? 100);
    const rows = await adminService.listAuditoria(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100);
    return reply.status(200).send(rows);
  });

  app.post("/admin/dashboard", async (request, reply) => {
    const parsed = dashboardFiltrosSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
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
      throw new AppError(400, "INVALID_PAYLOAD", "Payload invalido");
    }

    const xlsx = await exportService.gerarXlsx(parsed.data);
    const buffer = Buffer.isBuffer(xlsx) ? xlsx : Buffer.from(xlsx);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .header("Content-Disposition", `attachment; filename=\"reunir_export_${timestamp}.xlsx\"`)
      .send(buffer);
  });
};
