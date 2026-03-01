-- CreateTable
CREATE TABLE "setor_unidades" (
    "id" SERIAL NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "unidade_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setor_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "setor_unidades_setor_id_unidade_id_key"
ON "setor_unidades"("setor_id", "unidade_id");

-- CreateIndex
CREATE INDEX "idx_setor_unidades_setor" ON "setor_unidades"("setor_id");

-- CreateIndex
CREATE INDEX "idx_setor_unidades_unidade" ON "setor_unidades"("unidade_id");

-- Backfill setor -> unidade links from existing employee associations
INSERT INTO "setor_unidades" ("setor_id", "unidade_id")
SELECT DISTINCT fs."setor_id", fu."unidade_id"
FROM "funcionario_setores" fs
JOIN "funcionario_unidades" fu ON fu."funcionario_matricula" = fs."funcionario_matricula"
ON CONFLICT ("setor_id", "unidade_id") DO NOTHING;

-- Ensure every setor has at least one unidade linked
INSERT INTO "setor_unidades" ("setor_id", "unidade_id")
SELECT s."id", u."id"
FROM "setores" s
CROSS JOIN "unidades" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "setor_unidades" su
  WHERE su."setor_id" = s."id"
)
ON CONFLICT ("setor_id", "unidade_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "setor_unidades" ADD CONSTRAINT "setor_unidades_setor_id_fkey"
FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor_unidades" ADD CONSTRAINT "setor_unidades_unidade_id_fkey"
FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
