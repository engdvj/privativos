import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { Perfil } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import type { PerfilAcesso, SessionPayload, SolicitanteSessionPayload } from "../types/session.js";

export class AuthService {
  async login(input: { usuario: string; senha: string }) {
    const credencial = await prisma.credencial.findFirst({
      where: {
        usuario: input.usuario,
        ativo: true,
      },
      select: {
        usuario: true,
        senhaHash: true,
        perfil: true,
        nomeCompleto: true,
      },
    });

    if (!credencial) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais invalidas");
    }

    const senhaOk = await bcrypt.compare(input.senha, credencial.senhaHash);

    if (!senhaOk) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais invalidas");
    }

    const token = randomUUID();
    const perfil: PerfilAcesso =
      credencial.perfil === Perfil.superadmin
        ? "superadmin"
        : credencial.perfil === Perfil.admin
          ? "admin"
          : "setor";
    const session: SessionPayload = {
      usuario: credencial.usuario,
      perfil,
      nomeCompleto: credencial.nomeCompleto,
    };

    await redis.set(this.sessionKey(token), JSON.stringify(session), "EX", env.SESSION_TTL_SECONDS);

    return {
      token,
      perfil: session.perfil,
      nome: session.nomeCompleto,
    };
  }

  async criarSessaoSolicitante(input: { matricula: string }) {
    const funcionario = await prisma.funcionario.findFirst({
      where: {
        matricula: input.matricula,
        statusAtivo: true,
      },
      select: {
        matricula: true,
        nome: true,
      },
    });

    if (!funcionario) {
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionario nao encontrado");
    }

    const token = randomUUID();
    const session: SolicitanteSessionPayload = {
      matricula: funcionario.matricula,
      nomeFuncionario: funcionario.nome,
    };

    await redis.set(this.solicitanteSessionKey(token), JSON.stringify(session), "EX", 3600);

    return {
      token,
      nome_funcionario: session.nomeFuncionario,
      matricula: session.matricula,
    };
  }

  async validarSessao(token: string) {
    const [adminSetorRaw, solicitanteRaw] = await Promise.all([
      redis.get(this.sessionKey(token)),
      redis.get(this.solicitanteSessionKey(token)),
    ]);

    if (adminSetorRaw) {
      return {
        tipo: "setor_admin" as const,
        dados: JSON.parse(adminSetorRaw) as SessionPayload,
      };
    }

    if (solicitanteRaw) {
      return {
        tipo: "solicitante" as const,
        dados: JSON.parse(solicitanteRaw) as SolicitanteSessionPayload,
      };
    }

    return null;
  }

  async logout(token: string) {
    await Promise.all([
      redis.del(this.sessionKey(token)),
      redis.del(this.solicitanteSessionKey(token)),
    ]);
  }

  private sessionKey(token: string) {
    return `sess:${token}`;
  }

  private solicitanteSessionKey(token: string) {
    return `sess:sol:${token}`;
  }
}
