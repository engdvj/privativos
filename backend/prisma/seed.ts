import bcrypt from "bcrypt";
import { Perfil, PrismaClient, StatusItem } from "@prisma/client";

const prisma = new PrismaClient();
const DIA_MS = 24 * 60 * 60 * 1000;
const OPERADOR_SEED = "operador.seed";

type SetorSeed = {
  nome: string;
  unidades: string[];
};

type FuncionarioSeed = {
  matricula: string;
  nome: string;
  unidade: string;
  setor: string;
  funcao: string;
  unidades: string[];
  setores: string[];
  funcoes: string[];
};

type ItemSeed = {
  codigo: string;
  descricao: string;
  tipo: string;
  tamanho: string;
  status: StatusItem;
  solicitanteMatricula: string | null;
  setorSolicitante: string | null;
  dataEmprestimo: Date | null;
  statusAtivo: boolean;
};

const diasAtras = (dias: number) => new Date(Date.now() - dias * DIA_MS);

const getIdOrThrow = (mapa: Map<string, number>, chave: string, entidade: string) => {
  const id = mapa.get(chave);
  if (!id) {
    throw new Error(`Nao foi possivel localizar ${entidade}: ${chave}`);
  }

  return id;
};

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

  const unidades = ["Unidade Geral", "Unidade Centro", "Unidade Norte", "Unidade Sul", "Unidade Oeste"];

  const setores: SetorSeed[] = [
    { nome: "Almoxarifado", unidades: ["Unidade Geral", "Unidade Centro", "Unidade Norte", "Unidade Sul", "Unidade Oeste"] },
    { nome: "UTI", unidades: ["Unidade Centro", "Unidade Norte"] },
    { nome: "Enfermaria", unidades: ["Unidade Centro", "Unidade Norte", "Unidade Sul"] },
    { nome: "Centro Cirurgico", unidades: ["Unidade Centro", "Unidade Sul"] },
    { nome: "Farmacia", unidades: ["Unidade Geral", "Unidade Centro", "Unidade Norte", "Unidade Sul"] },
    { nome: "Laboratorio", unidades: ["Unidade Centro", "Unidade Oeste"] },
    { nome: "Pronto Atendimento", unidades: ["Unidade Norte", "Unidade Sul"] },
    { nome: "Administracao", unidades: ["Unidade Geral", "Unidade Oeste"] },
  ];

  const funcoes = [
    "Operador",
    "Enfermeiro",
    "Tecnico de Enfermagem",
    "Medico",
    "Farmaceutico",
    "Auxiliar Administrativo",
    "Analista de Laboratorio",
  ];

  const funcionarios: FuncionarioSeed[] = [
    {
      matricula: "10001",
      nome: "Ana Souza",
      unidade: "Unidade Centro",
      setor: "UTI",
      funcao: "Enfermeiro",
      unidades: ["Unidade Centro"],
      setores: ["UTI"],
      funcoes: ["Enfermeiro"],
    },
    {
      matricula: "10002",
      nome: "Bruno Lima",
      unidade: "Unidade Norte",
      setor: "Pronto Atendimento",
      funcao: "Tecnico de Enfermagem",
      unidades: ["Unidade Norte"],
      setores: ["Pronto Atendimento", "Enfermaria"],
      funcoes: ["Tecnico de Enfermagem"],
    },
    {
      matricula: "10003",
      nome: "Carla Mendes",
      unidade: "Unidade Centro",
      setor: "Centro Cirurgico",
      funcao: "Medico",
      unidades: ["Unidade Centro", "Unidade Sul"],
      setores: ["Centro Cirurgico"],
      funcoes: ["Medico"],
    },
    {
      matricula: "10004",
      nome: "Diego Alves",
      unidade: "Unidade Geral",
      setor: "Farmacia",
      funcao: "Farmaceutico",
      unidades: ["Unidade Geral", "Unidade Centro"],
      setores: ["Farmacia"],
      funcoes: ["Farmaceutico"],
    },
    {
      matricula: "10005",
      nome: "Elisa Rocha",
      unidade: "Unidade Oeste",
      setor: "Administracao",
      funcao: "Auxiliar Administrativo",
      unidades: ["Unidade Oeste", "Unidade Geral"],
      setores: ["Administracao"],
      funcoes: ["Auxiliar Administrativo"],
    },
    {
      matricula: "10006",
      nome: "Fabio Nunes",
      unidade: "Unidade Centro",
      setor: "Laboratorio",
      funcao: "Analista de Laboratorio",
      unidades: ["Unidade Centro", "Unidade Oeste"],
      setores: ["Laboratorio"],
      funcoes: ["Analista de Laboratorio"],
    },
    {
      matricula: "10007",
      nome: "Gabriela Pinto",
      unidade: "Unidade Sul",
      setor: "Enfermaria",
      funcao: "Enfermeiro",
      unidades: ["Unidade Sul"],
      setores: ["Enfermaria"],
      funcoes: ["Enfermeiro"],
    },
    {
      matricula: "10008",
      nome: "Helio Cardoso",
      unidade: "Unidade Centro",
      setor: "Almoxarifado",
      funcao: "Operador",
      unidades: ["Unidade Centro", "Unidade Geral"],
      setores: ["Almoxarifado"],
      funcoes: ["Operador"],
    },
    {
      matricula: "10009",
      nome: "Iara Castro",
      unidade: "Unidade Norte",
      setor: "UTI",
      funcao: "Medico",
      unidades: ["Unidade Norte", "Unidade Centro"],
      setores: ["UTI"],
      funcoes: ["Medico"],
    },
    {
      matricula: "10010",
      nome: "Joao Teixeira",
      unidade: "Unidade Sul",
      setor: "Pronto Atendimento",
      funcao: "Tecnico de Enfermagem",
      unidades: ["Unidade Sul"],
      setores: ["Pronto Atendimento"],
      funcoes: ["Tecnico de Enfermagem"],
    },
    {
      matricula: "10011",
      nome: "Kelly Ribeiro",
      unidade: "Unidade Geral",
      setor: "Almoxarifado",
      funcao: "Operador",
      unidades: ["Unidade Geral", "Unidade Oeste"],
      setores: ["Almoxarifado"],
      funcoes: ["Operador"],
    },
    {
      matricula: "10012",
      nome: "Lucas Freitas",
      unidade: "Unidade Oeste",
      setor: "Laboratorio",
      funcao: "Analista de Laboratorio",
      unidades: ["Unidade Oeste"],
      setores: ["Laboratorio"],
      funcoes: ["Analista de Laboratorio"],
    },
  ];

  for (const nome of unidades) {
    await prisma.unidade.upsert({
      where: { nome },
      update: {
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
      create: {
        nome,
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
    });
  }

  for (const setor of setores) {
    await prisma.setor.upsert({
      where: { nome: setor.nome },
      update: {
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
      create: {
        nome: setor.nome,
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
    });
  }

  for (const nome of funcoes) {
    await prisma.funcao.upsert({
      where: { nome },
      update: {
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
      create: {
        nome,
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
    });
  }

  const [unidadesDb, setoresDb, funcoesDb] = await Promise.all([
    prisma.unidade.findMany({ select: { id: true, nome: true } }),
    prisma.setor.findMany({ select: { id: true, nome: true } }),
    prisma.funcao.findMany({ select: { id: true, nome: true } }),
  ]);

  const unidadeIdByNome = new Map(unidadesDb.map((row) => [row.nome, row.id]));
  const setorIdByNome = new Map(setoresDb.map((row) => [row.nome, row.id]));
  const funcaoIdByNome = new Map(funcoesDb.map((row) => [row.nome, row.id]));

  await prisma.setorUnidade.createMany({
    data: setores.flatMap((setor) =>
      setor.unidades.map((unidadeNome) => ({
        setorId: getIdOrThrow(setorIdByNome, setor.nome, "setor"),
        unidadeId: getIdOrThrow(unidadeIdByNome, unidadeNome, "unidade"),
      })),
    ),
    skipDuplicates: true,
  });

  for (const funcionario of funcionarios) {
    await prisma.funcionario.upsert({
      where: { matricula: funcionario.matricula },
      update: {
        nome: funcionario.nome,
        unidade: funcionario.unidade,
        setor: funcionario.setor,
        funcao: funcionario.funcao,
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
      create: {
        matricula: funcionario.matricula,
        nome: funcionario.nome,
        unidade: funcionario.unidade,
        setor: funcionario.setor,
        funcao: funcionario.funcao,
        statusAtivo: true,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
    });
  }

  const matriculasFuncionarios = funcionarios.map((funcionario) => funcionario.matricula);
  await Promise.all([
    prisma.funcionarioUnidade.deleteMany({
      where: { funcionarioMatricula: { in: matriculasFuncionarios } },
    }),
    prisma.funcionarioSetor.deleteMany({
      where: { funcionarioMatricula: { in: matriculasFuncionarios } },
    }),
    prisma.funcionarioFuncao.deleteMany({
      where: { funcionarioMatricula: { in: matriculasFuncionarios } },
    }),
  ]);

  await prisma.funcionarioUnidade.createMany({
    data: funcionarios.flatMap((funcionario) =>
      [...new Set(funcionario.unidades)].map((unidadeNome) => ({
        funcionarioMatricula: funcionario.matricula,
        unidadeId: getIdOrThrow(unidadeIdByNome, unidadeNome, "unidade"),
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.funcionarioSetor.createMany({
    data: funcionarios.flatMap((funcionario) =>
      [...new Set(funcionario.setores)].map((setorNome) => ({
        funcionarioMatricula: funcionario.matricula,
        setorId: getIdOrThrow(setorIdByNome, setorNome, "setor"),
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.funcionarioFuncao.createMany({
    data: funcionarios.flatMap((funcionario) =>
      [...new Set(funcionario.funcoes)].map((funcaoNome) => ({
        funcionarioMatricula: funcionario.matricula,
        funcaoId: getIdOrThrow(funcaoIdByNome, funcaoNome, "funcao"),
      })),
    ),
    skipDuplicates: true,
  });

  const catalogoItens = [
    { tipo: "Avental", tamanhos: ["P", "M", "G", "GG"] },
    { tipo: "Luva Procedimento", tamanhos: ["P", "M", "G"] },
    { tipo: "Mascara", tamanhos: ["UNICO"] },
    { tipo: "Protetor Facial", tamanhos: ["UNICO"] },
    { tipo: "Bota", tamanhos: ["38", "39", "40", "41", "42"] },
    { tipo: "Capote", tamanhos: ["P", "M", "G"] },
  ];

  const itensSeed: ItemSeed[] = Array.from({ length: 48 }, (_, index) => {
    const catalogo = catalogoItens[index % catalogoItens.length];
    const tamanho = catalogo.tamanhos[index % catalogo.tamanhos.length];
    const codigo = `ITM-${String(index + 1).padStart(4, "0")}`;

    let status: StatusItem = "disponivel";
    if (index < 12) {
      status = "emprestado";
    } else if (index >= 44) {
      status = "inativo";
    }

    const solicitante = status === "emprestado" ? funcionarios[index % funcionarios.length] : null;

    return {
      codigo,
      descricao: `${catalogo.tipo} tamanho ${tamanho}`,
      tipo: catalogo.tipo,
      tamanho,
      status,
      solicitanteMatricula: solicitante?.matricula ?? null,
      setorSolicitante: solicitante?.setor ?? null,
      dataEmprestimo: solicitante ? diasAtras((index % 9) + 1) : null,
      statusAtivo: status !== "inativo",
    };
  });

  for (const item of itensSeed) {
    await prisma.item.upsert({
      where: { codigo: item.codigo },
      update: {
        descricao: item.descricao,
        tipo: item.tipo,
        tamanho: item.tamanho,
        status: item.status,
        solicitanteMatricula: item.solicitanteMatricula,
        setorSolicitante: item.setorSolicitante,
        dataEmprestimo: item.dataEmprestimo,
        statusAtivo: item.statusAtivo,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
      create: {
        codigo: item.codigo,
        descricao: item.descricao,
        tipo: item.tipo,
        tamanho: item.tamanho,
        status: item.status,
        solicitanteMatricula: item.solicitanteMatricula,
        setorSolicitante: item.setorSolicitante,
        dataEmprestimo: item.dataEmprestimo,
        statusAtivo: item.statusAtivo,
        atualizadoPor: "sistema",
        atualizadoEm: new Date(),
      },
    });
  }

  await prisma.solicitacao.deleteMany({
    where: { operadorNome: OPERADOR_SEED },
  });
  await prisma.devolucao.deleteMany({
    where: { operadorNome: OPERADOR_SEED },
  });

  const nomeByMatricula = new Map(funcionarios.map((funcionario) => [funcionario.matricula, funcionario.nome]));
  const solicitacoesData: {
    timestamp: Date;
    matricula: string;
    nomeFuncionario: string;
    itemCodigo: string;
    operadorNome: string;
    origemOperacao: string;
    setorSolicitante: string | null;
  }[] = [];
  const devolucoesData: typeof solicitacoesData = [];

  const itensEmprestados = itensSeed.filter((item) => item.status === "emprestado");
  for (const [index, item] of itensEmprestados.entries()) {
    if (!item.solicitanteMatricula || !item.dataEmprestimo) {
      continue;
    }

    solicitacoesData.push({
      timestamp: item.dataEmprestimo,
      matricula: item.solicitanteMatricula,
      nomeFuncionario: nomeByMatricula.get(item.solicitanteMatricula) ?? "Funcionario Seed",
      itemCodigo: item.codigo,
      operadorNome: OPERADOR_SEED,
      origemOperacao: index % 2 === 0 ? "colaborador" : "admin",
      setorSolicitante: item.setorSolicitante,
    });
  }

  const itensHistoricoComDevolucao = itensSeed.filter((item) => item.status === "disponivel").slice(0, 16);
  for (const [index, item] of itensHistoricoComDevolucao.entries()) {
    const funcionario = funcionarios[(index + 3) % funcionarios.length];
    const dataSolicitacao = diasAtras(60 - index * 2);
    const dataDevolucao = new Date(dataSolicitacao.getTime() + ((index % 5) + 1) * DIA_MS);
    const origemOperacao = index % 3 === 0 ? "setor" : "colaborador";

    solicitacoesData.push({
      timestamp: dataSolicitacao,
      matricula: funcionario.matricula,
      nomeFuncionario: funcionario.nome,
      itemCodigo: item.codigo,
      operadorNome: OPERADOR_SEED,
      origemOperacao,
      setorSolicitante: funcionario.setor,
    });

    devolucoesData.push({
      timestamp: dataDevolucao,
      matricula: funcionario.matricula,
      nomeFuncionario: funcionario.nome,
      itemCodigo: item.codigo,
      operadorNome: OPERADOR_SEED,
      origemOperacao,
      setorSolicitante: funcionario.setor,
    });
  }

  if (solicitacoesData.length > 0) {
    await prisma.solicitacao.createMany({ data: solicitacoesData });
  }

  if (devolucoesData.length > 0) {
    await prisma.devolucao.createMany({ data: devolucoesData });
  }

  console.log(
    `Seed concluido: ${unidades.length} unidades, ${setores.length} setores, ${funcoes.length} funcoes, ${funcionarios.length} funcionarios, ${itensSeed.length} itens, ${solicitacoesData.length} solicitacoes e ${devolucoesData.length} devolucoes.`,
  );
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
