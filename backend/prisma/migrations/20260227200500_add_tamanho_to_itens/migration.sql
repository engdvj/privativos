-- AlterTable
ALTER TABLE "itens"
ADD COLUMN "tamanho" VARCHAR(20) NOT NULL DEFAULT 'UNICO';

-- CreateIndex
CREATE INDEX "idx_itens_tamanho_status" ON "itens"("tamanho", "status");
