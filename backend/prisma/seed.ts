import bcrypt from "bcrypt";
import { PrismaClient, Perfil } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!password) {
    throw new Error("ADMIN_SEED_PASSWORD is required to run the seed.");
  }

  const senhaHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS ?? 12));

  await prisma.configuracao.upsert({
    where: { chave: "MAX_KITS_POR_FUNCIONARIO" },
    update: {
      valor: "2",
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
    create: {
      chave: "MAX_KITS_POR_FUNCIONARIO",
      valor: "2",
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
  });

  await prisma.credencial.upsert({
    where: { usuario: "admin" },
    update: {
      senhaHash,
      perfil: Perfil.superadmin,
      nomeCompleto: "Administrador Padrao",
      ativo: true,
      deveAlterarSenha: true,
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
    create: {
      usuario: "admin",
      senhaHash,
      perfil: Perfil.superadmin,
      nomeCompleto: "Administrador Padrao",
      ativo: true,
      deveAlterarSenha: true,
      criadoPor: "sistema",
    },
  });

  await prisma.setor.upsert({
    where: { nome: "Almoxarifado" },
    update: {
      statusAtivo: true,
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
    create: {
      nome: "Almoxarifado",
      statusAtivo: true,
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
  });

  await prisma.funcao.upsert({
    where: { nome: "Operador" },
    update: {
      statusAtivo: true,
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
    create: {
      nome: "Operador",
      statusAtivo: true,
      atualizadoPor: "sistema",
      atualizadoEm: new Date(),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
