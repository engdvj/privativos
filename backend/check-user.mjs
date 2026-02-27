import { prisma } from './src/lib/prisma.js';

const creds = await prisma.credencial.findMany({
  where: {
    OR: [
      { usuario: { contains: 'maria' } },
      { nome: { contains: 'Maria' } }
    ]
  },
  select: {
    usuario: true,
    nome: true,
    perfil: true,
    statusAtivo: true
  }
});

console.log('Credenciais encontradas:');
console.log(JSON.stringify(creds, null, 2));

await prisma.$disconnect();
