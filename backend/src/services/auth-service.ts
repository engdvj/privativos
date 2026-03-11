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
        temaPreferido: true,
      },
    });

    if (!credencial) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas");
    }

    const senhaOk = await bcrypt.compare(input.senha, credencial.senhaHash);

    if (!senhaOk) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas");
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
      tema_preferido: credencial.temaPreferido,
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
      throw new AppError(404, "FUNCIONARIO_NOT_FOUND", "Funcionário não encontrado");
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

  async obterPerfilUsuario(usuario: string) {
    const credencial = await prisma.credencial.findFirst({
      where: {
        usuario,
        ativo: true,
      },
      select: {
        usuario: true,
        nomeCompleto: true,
        perfil: true,
        deveAlterarSenha: true,
        temaPreferido: true,
      },
    });

    if (!credencial) {
      throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado");
    }

    return credencial;
  }

  async atualizarPerfil(input: {
    usuario: string;
    nomeCompleto?: string;
    senhaNova?: string;
  }) {
    const credencial = await prisma.credencial.findFirst({
      where: {
        usuario: input.usuario,
        ativo: true,
      },
    });

    if (!credencial) {
      throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado");
    }
    if (input.senhaNova && input.senhaNova.length < 6) {
      throw new AppError(400, "SENHA_FRACA", "Senha deve ter no mínimo 6 caracteres");
    }

    const dadosAtualizacao: {
      nomeCompleto?: string;
      senhaHash?: string;
      deveAlterarSenha?: boolean;
      atualizadoEm: Date;
      atualizadoPor: string;
    } = {
      atualizadoEm: new Date(),
      atualizadoPor: input.usuario,
    };

    if (input.nomeCompleto) {
      dadosAtualizacao.nomeCompleto = input.nomeCompleto;
    }

    if (input.senhaNova) {
      dadosAtualizacao.senhaHash = await bcrypt.hash(input.senhaNova, env.BCRYPT_ROUNDS);
      dadosAtualizacao.deveAlterarSenha = false;
    }

    const atualizado = await prisma.credencial.update({
      where: { usuario: input.usuario },
      data: dadosAtualizacao,
      select: {
        usuario: true,
        nomeCompleto: true,
        perfil: true,
        deveAlterarSenha: true,
        temaPreferido: true,
      },
    });

    // Atualiza a sessão no Redis com o novo nome
    if (input.nomeCompleto) {
      const sessoes = await redis.keys(`sess:*`);
      for (const key of sessoes) {
        const sessaoRaw = await redis.get(key);
        if (sessaoRaw) {
          const sessao = JSON.parse(sessaoRaw) as SessionPayload;
          if (sessao.usuario === input.usuario) {
            sessao.nomeCompleto = atualizado.nomeCompleto;
            const ttl = await redis.ttl(key);
            await redis.set(key, JSON.stringify(sessao), "EX", ttl > 0 ? ttl : env.SESSION_TTL_SECONDS);
          }
        }
      }
    }

    return atualizado;
  }

  async atualizarTema(usuario: string, tema: string) {
    if (tema !== "light" && tema !== "dark") {
      throw new AppError(400, "INVALID_THEME", "Tema inválido. Use 'light' ou 'dark'");
    }

    const credencial = await prisma.credencial.findFirst({
      where: {
        usuario,
        ativo: true,
      },
    });

    if (!credencial) {
      throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado");
    }

    await prisma.credencial.update({
      where: { usuario },
      data: {
        temaPreferido: tema,
        atualizadoEm: new Date(),
        atualizadoPor: usuario,
      },
    });

    return { tema_preferido: tema };
  }

  private sessionKey(token: string) {
    return `sess:${token}`;
  }

  private solicitanteSessionKey(token: string) {
    return `sess:sol:${token}`;
  }
}
