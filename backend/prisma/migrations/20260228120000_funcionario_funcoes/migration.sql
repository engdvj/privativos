-- CreateTable
CREATE TABLE "funcionario_funcoes" (
    "id" SERIAL NOT NULL,
    "funcionario_matricula" VARCHAR(20) NOT NULL,
    "funcao_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funcionario_funcoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_funcoes_funcionario_matricula_funcao_id_key" ON "funcionario_funcoes"("funcionario_matricula", "funcao_id");

-- CreateIndex
CREATE INDEX "idx_funcionario_funcoes_funcionario" ON "funcionario_funcoes"("funcionario_matricula");

-- CreateIndex
CREATE INDEX "idx_funcionario_funcoes_funcao" ON "funcionario_funcoes"("funcao_id");

-- Backfill missing funcoes referenced by funcionarios
INSERT INTO "funcoes" ("nome", "status_ativo", "criado_em", "atualizado_por", "atualizado_em")
SELECT DISTINCT f."funcao", true, CURRENT_TIMESTAMP, 'migracao', CURRENT_TIMESTAMP
FROM "funcionarios" f
LEFT JOIN "funcoes" fn ON fn."nome" = f."funcao"
WHERE fn."id" IS NULL;

-- Backfill funcionario -> funcao links
INSERT INTO "funcionario_funcoes" ("funcionario_matricula", "funcao_id")
SELECT f."matricula", fn."id"
FROM "funcionarios" f
JOIN "funcoes" fn ON fn."nome" = f."funcao"
ON CONFLICT ("funcionario_matricula", "funcao_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "funcionario_funcoes" ADD CONSTRAINT "funcionario_funcoes_funcionario_matricula_fkey"
FOREIGN KEY ("funcionario_matricula") REFERENCES "funcionarios"("matricula") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_funcoes" ADD CONSTRAINT "funcionario_funcoes_funcao_id_fkey"
FOREIGN KEY ("funcao_id") REFERENCES "funcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
