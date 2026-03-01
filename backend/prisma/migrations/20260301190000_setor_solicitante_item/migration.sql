ALTER TABLE "itens"
ADD COLUMN "setor_solicitante" VARCHAR(100);

CREATE INDEX "idx_itens_setor_solicitante" ON "itens"("setor_solicitante");
