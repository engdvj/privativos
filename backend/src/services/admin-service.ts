import bcrypt from "bcrypt";
import { Perfil, Prisma, StatusItem } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { DashboardService } from "./dashboard-service.js";

const dashboardService = new DashboardService();

export class AdminService {
  async listFuncionarios(includeInactive = false) {
    return prisma.funcionario.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ nome: "asc" }],
    });
  }

  async createFuncionario(input: {
    matricula: string;
    nome: string;
    setor: string;
    funcao: string;
    operador: string;
  }) {
    const created = await prisma.funcionario.create({
      data: {
        matricula: input.matricula,
        nome: input.nome,
        setor: input.setor,
        funcao: input.funcao,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "funcionarios",
      operacao: "INSERT",
      registroId: input.matricula,
      dadosAntes: null,
      dadosDepois: created,
    });
    await this.invalidateDashboardCaches();

    return created;
  }

  async updateFuncionario(
    matricula: string,
    input: { nome?: string; setor?: string; funcao?: string; statusAtivo?: boolean; operador: string },
  ) {
    const before = await prisma.funcionario.findUnique({ where: { matricula } });

    if (!before) {
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionario nao encontrado");
    }

    const updated = await prisma.funcionario.update({
      where: { matricula },
      data: {
        nome: input.nome,
        setor: input.setor,
        funcao: input.funcao,
        statusAtivo: input.statusAtivo,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "funcionarios",
      operacao: "UPDATE",
      registroId: matricula,
      dadosAntes: before,
      dadosDepois: updated,
    });
    await this.invalidateDashboardCaches();

    return updated;
  }

  async listItens(includeInactive = false) {
    return prisma.item.findMany({
      where: includeInactive ? undefined : { statusAtivo: true },
      orderBy: [{ codigo: "asc" }],
    });
  }

  async createItem(input: {
    codigo: string;
    descricao: string;
    status?: StatusItem;
    operador: string;
  }) {
    const created = await prisma.item.create({
      data: {
        codigo: input.codigo,
        descricao: input.descricao,
        status: input.status ?? "disponivel",
        statusAtivo: true,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "itens",
      operacao: "INSERT",
      registroId: input.codigo,
      dadosAntes: null,
      dadosDepois: created,
    });
    await this.invalidateDashboardCaches();

    return created;
  }

  async updateItem(
    codigo: string,
    input: { descricao?: string; status?: StatusItem; statusAtivo?: boolean; operador: string },
  ) {
    const before = await prisma.item.findUnique({ where: { codigo } });

    if (!before) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item nao encontrado");
    }

    if (before.status === "emprestado" && input.statusAtivo === false) {
      const holder = before.solicitanteMatricula
        ? await prisma.funcionario.findUnique({
            where: { matricula: before.solicitanteMatricula },
            select: { matricula: true, nome: true },
          })
        : null;

      const detalhes = holder ? `${holder.matricula} - ${holder.nome}` : "desconhecido";
      throw new AppError(409, "ITEM_EMPRESTADO", `Item emprestado para ${detalhes}`);
    }

    const shouldForceInactive = input.statusAtivo === false;

    const updated = await prisma.item.update({
      where: { codigo },
      data: {
        descricao: input.descricao,
        status: shouldForceInactive ? "inativo" : input.status,
        statusAtivo: input.statusAtivo,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "itens",
      operacao: "UPDATE",
      registroId: codigo,
      dadosAntes: before,
      dadosDepois: updated,
    });
    await this.invalidateDashboardCaches();

    return updated;
  }

  async listCredenciais() {
    return prisma.credencial.findMany({
      orderBy: [{ usuario: "asc" }],
      select: {
        id: true,
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
        criadoEm: true,
        criadoPor: true,
        atualizadoPor: true,
        atualizadoEm: true,
      },
    });
  }

  async createCredencial(input: {
    usuario: string;
    senha: string;
    perfil: "setor" | "admin";
    nomeCompleto: string;
    operador: string;
  }) {
    const senhaHash = await bcrypt.hash(input.senha, env.BCRYPT_ROUNDS);

    const created = await prisma.credencial.create({
      data: {
        usuario: input.usuario,
        senhaHash,
        perfil: input.perfil === "admin" ? Perfil.admin : Perfil.setor,
        nomeCompleto: input.nomeCompleto,
        ativo: true,
        deveAlterarSenha: true,
        criadoPor: input.operador,
      },
      select: {
        id: true,
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "credenciais",
      operacao: "INSERT",
      registroId: input.usuario,
      dadosAntes: null,
      dadosDepois: created,
    });

    return created;
  }

  async updateCredencial(
    usuario: string,
    input: {
      nomeCompleto?: string;
      perfil?: "setor" | "admin";
      ativo?: boolean;
      senha?: string;
      deveAlterarSenha?: boolean;
      operador: string;
    },
  ) {
    const before = await prisma.credencial.findUnique({
      where: { usuario },
      select: {
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    if (!before) {
      throw new AppError(404, "CREDENCIAL_NOT_FOUND", "Credencial nao encontrada");
    }

    const senhaHash = input.senha ? await bcrypt.hash(input.senha, env.BCRYPT_ROUNDS) : undefined;

    const updated = await prisma.credencial.update({
      where: { usuario },
      data: {
        nomeCompleto: input.nomeCompleto,
        perfil: input.perfil ? (input.perfil === "admin" ? Perfil.admin : Perfil.setor) : undefined,
        ativo: input.ativo,
        senhaHash,
        deveAlterarSenha: input.deveAlterarSenha,
        atualizadoPor: input.operador,
        atualizadoEm: new Date(),
      },
      select: {
        id: true,
        usuario: true,
        perfil: true,
        nomeCompleto: true,
        ativo: true,
        deveAlterarSenha: true,
      },
    });

    await this.audit({
      operador: input.operador,
      entidade: "credenciais",
      operacao: "UPDATE",
      registroId: usuario,
      dadosAntes: before,
      dadosDepois: updated,
    });

    return updated;
  }

  async getConfiguracoes() {
    return prisma.configuracao.findMany({ orderBy: [{ chave: "asc" }] });
  }

  async setMaxKitsPorFuncionario(valor: number, operador: string) {
    const before = await prisma.configuracao.findUnique({ where: { chave: "MAX_KITS_POR_FUNCIONARIO" } });

    const updated = await prisma.configuracao.upsert({
      where: { chave: "MAX_KITS_POR_FUNCIONARIO" },
      update: {
        valor: String(valor),
        atualizadoPor: operador,
        atualizadoEm: new Date(),
      },
      create: {
        chave: "MAX_KITS_POR_FUNCIONARIO",
        valor: String(valor),
        atualizadoPor: operador,
        atualizadoEm: new Date(),
      },
    });

    await this.audit({
      operador,
      entidade: "configuracoes",
      operacao: "UPDATE",
      registroId: "MAX_KITS_POR_FUNCIONARIO",
      dadosAntes: before,
      dadosDepois: updated,
    });
    await this.invalidateDashboardCaches();

    return updated;
  }

  async listAuditoria(limit = 100) {
    return prisma.auditoria.findMany({
      orderBy: [{ timestamp: "desc" }],
      take: limit,
    });
  }

  private async audit(input: {
    operador: string;
    entidade: string;
    operacao: string;
    registroId: string;
    dadosAntes: unknown;
    dadosDepois: unknown;
  }) {
    await prisma.auditoria.create({
      data: {
        operador: input.operador,
        entidade: input.entidade,
        operacao: input.operacao,
        registroId: input.registroId,
        dadosAntes:
          input.dadosAntes === null
            ? Prisma.JsonNull
            : (input.dadosAntes as Prisma.InputJsonValue),
        dadosDepois:
          input.dadosDepois === null
            ? Prisma.JsonNull
            : (input.dadosDepois as Prisma.InputJsonValue),
      },
    });
  }

  private async invalidateDashboardCaches() {
    await dashboardService.invalidateCache();
    await dashboardService.invalidateFilterCache();
  }
}
