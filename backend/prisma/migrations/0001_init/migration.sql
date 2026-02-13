-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('setor', 'admin');

-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('disponivel', 'emprestado', 'inativo');

-- CreateTable
CREATE TABLE "funcionarios" (
    "id" SERIAL NOT NULL,
    "matricula" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "setor" VARCHAR(100) NOT NULL,
    "funcao" VARCHAR(100) NOT NULL,
    "status_ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" VARCHAR(150),
    "atualizado_em" TIMESTAMPTZ(6),

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descricao" VARCHAR(200) NOT NULL,
    "status" "StatusItem" NOT NULL,
    "solicitante_matricula" VARCHAR(20),
    "data_emprestimo" TIMESTAMPTZ(6),
    "status_ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" VARCHAR(150),
    "atualizado_em" TIMESTAMPTZ(6),

    CONSTRAINT "itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matricula" VARCHAR(20) NOT NULL,
    "nome_funcionario" VARCHAR(150) NOT NULL,
    "item_codigo" VARCHAR(50) NOT NULL,
    "operador_nome" VARCHAR(150) NOT NULL,

    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucoes" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matricula" VARCHAR(20) NOT NULL,
    "nome_funcionario" VARCHAR(150) NOT NULL,
    "item_codigo" VARCHAR(50) NOT NULL,
    "operador_nome" VARCHAR(150) NOT NULL,

    CONSTRAINT "devolucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credenciais" (
    "id" SERIAL NOT NULL,
    "usuario" VARCHAR(100) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "nome_completo" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deve_alterar_senha" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" VARCHAR(150) NOT NULL,
    "atualizado_por" VARCHAR(150),
    "atualizado_em" TIMESTAMPTZ(6),

    CONSTRAINT "credenciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "chave" VARCHAR(100) NOT NULL,
    "valor" VARCHAR(255) NOT NULL,
    "atualizado_por" VARCHAR(150),
    "atualizado_em" TIMESTAMPTZ(6),

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operador" VARCHAR(150) NOT NULL,
    "entidade" VARCHAR(50) NOT NULL,
    "operacao" VARCHAR(20) NOT NULL,
    "registro_id" VARCHAR(100) NOT NULL,
    "dados_antes" JSONB,
    "dados_depois" JSONB,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcionarios_matricula_key" ON "funcionarios"("matricula");

-- CreateIndex
CREATE INDEX "idx_funcionarios_matricula" ON "funcionarios"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "itens_codigo_key" ON "itens"("codigo");

-- CreateIndex
CREATE INDEX "idx_itens_status" ON "itens"("status");

-- CreateIndex
CREATE INDEX "idx_itens_solicitante" ON "itens"("solicitante_matricula");

-- CreateIndex
CREATE INDEX "idx_solicitacoes_matricula" ON "solicitacoes"("matricula");

-- CreateIndex
CREATE INDEX "idx_solicitacoes_timestamp" ON "solicitacoes"("timestamp");

-- CreateIndex
CREATE INDEX "idx_devolucoes_matricula" ON "devolucoes"("matricula");

-- CreateIndex
CREATE INDEX "idx_devolucoes_timestamp" ON "devolucoes"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "credenciais_usuario_key" ON "credenciais"("usuario");

-- AddForeignKey
ALTER TABLE "itens" ADD CONSTRAINT "itens_solicitante_matricula_fkey" FOREIGN KEY ("solicitante_matricula") REFERENCES "funcionarios"("matricula") ON DELETE SET NULL ON UPDATE CASCADE;

