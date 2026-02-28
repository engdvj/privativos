-- CreateTable
CREATE TABLE "funcionario_setores" (
    "id" SERIAL NOT NULL,
    "funcionario_matricula" VARCHAR(20) NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funcionario_setores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_setores_funcionario_matricula_setor_id_key" ON "funcionario_setores"("funcionario_matricula", "setor_id");

-- CreateIndex
CREATE INDEX "idx_funcionario_setores_funcionario" ON "funcionario_setores"("funcionario_matricula");

-- CreateIndex
CREATE INDEX "idx_funcionario_setores_setor" ON "funcionario_setores"("setor_id");

-- Backfill missing sectors referenced by funcionarios
INSERT INTO "setores" ("nome", "status_ativo", "criado_em", "atualizado_por", "atualizado_em")
SELECT DISTINCT f."setor", true, CURRENT_TIMESTAMP, 'migracao', CURRENT_TIMESTAMP
FROM "funcionarios" f
LEFT JOIN "setores" s ON s."nome" = f."setor"
WHERE s."id" IS NULL;

-- Backfill funcionario -> setor links
INSERT INTO "funcionario_setores" ("funcionario_matricula", "setor_id")
SELECT f."matricula", s."id"
FROM "funcionarios" f
JOIN "setores" s ON s."nome" = f."setor"
ON CONFLICT ("funcionario_matricula", "setor_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "funcionario_setores" ADD CONSTRAINT "funcionario_setores_funcionario_matricula_fkey"
FOREIGN KEY ("funcionario_matricula") REFERENCES "funcionarios"("matricula") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_setores" ADD CONSTRAINT "funcionario_setores_setor_id_fkey"
FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
