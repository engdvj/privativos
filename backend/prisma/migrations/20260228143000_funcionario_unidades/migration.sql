-- CreateTable
CREATE TABLE "unidades" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "status_ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" VARCHAR(150),
    "atualizado_em" TIMESTAMPTZ(6),

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_nome_key" ON "unidades"("nome");

-- Add unidade column to funcionarios (principal)
ALTER TABLE "funcionarios" ADD COLUMN "unidade" VARCHAR(100);

-- Backfill unidade principal for existing funcionarios
UPDATE "funcionarios"
SET "unidade" = 'Unidade Geral'
WHERE "unidade" IS NULL OR BTRIM("unidade") = '';

ALTER TABLE "funcionarios" ALTER COLUMN "unidade" SET NOT NULL;

-- Backfill missing unidades referenced by funcionarios
INSERT INTO "unidades" ("nome", "status_ativo", "criado_em", "atualizado_por", "atualizado_em")
SELECT DISTINCT f."unidade", true, CURRENT_TIMESTAMP, 'migracao', CURRENT_TIMESTAMP
FROM "funcionarios" f
LEFT JOIN "unidades" u ON u."nome" = f."unidade"
WHERE u."id" IS NULL;

-- CreateTable
CREATE TABLE "funcionario_unidades" (
    "id" SERIAL NOT NULL,
    "funcionario_matricula" VARCHAR(20) NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funcionario_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_unidades_funcionario_matricula_unidade_id_key"
ON "funcionario_unidades"("funcionario_matricula", "unidade_id");

-- CreateIndex
CREATE INDEX "idx_funcionario_unidades_funcionario" ON "funcionario_unidades"("funcionario_matricula");

-- CreateIndex
CREATE INDEX "idx_funcionario_unidades_unidade" ON "funcionario_unidades"("unidade_id");

-- Backfill funcionario -> unidade links
INSERT INTO "funcionario_unidades" ("funcionario_matricula", "unidade_id")
SELECT f."matricula", u."id"
FROM "funcionarios" f
JOIN "unidades" u ON u."nome" = f."unidade"
ON CONFLICT ("funcionario_matricula", "unidade_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "funcionario_unidades" ADD CONSTRAINT "funcionario_unidades_funcionario_matricula_fkey"
FOREIGN KEY ("funcionario_matricula") REFERENCES "funcionarios"("matricula") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_unidades" ADD CONSTRAINT "funcionario_unidades_unidade_id_fkey"
FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
