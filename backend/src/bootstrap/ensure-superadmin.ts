import bcrypt from "bcrypt";
import { Perfil } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const BOOTSTRAP_ACTOR = "bootstrap.superadmin";

export async function ensureSuperadmin() {
  const senhaHash = await bcrypt.hash(env.BOOTSTRAP_SUPERADMIN_PASSWORD, env.BCRYPT_ROUNDS);

  await prisma.credencial.upsert({
    where: { usuario: env.BOOTSTRAP_SUPERADMIN_USER },
    update: {
      senhaHash,
      perfil: Perfil.superadmin,
      nomeCompleto: env.BOOTSTRAP_SUPERADMIN_NAME,
      ativo: true,
      deveAlterarSenha: false,
      atualizadoPor: BOOTSTRAP_ACTOR,
      atualizadoEm: new Date(),
    },
    create: {
      usuario: env.BOOTSTRAP_SUPERADMIN_USER,
      senhaHash,
      perfil: Perfil.superadmin,
      nomeCompleto: env.BOOTSTRAP_SUPERADMIN_NAME,
      ativo: true,
      deveAlterarSenha: false,
      criadoPor: BOOTSTRAP_ACTOR,
    },
  });
}
