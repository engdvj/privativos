-- AlterTable
ALTER TABLE "itens"
ADD COLUMN "tipo" VARCHAR(100) NOT NULL DEFAULT 'Sem tipo',
ALTER COLUMN "descricao" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_itens_tipo_tamanho_status_ativo"
ON "itens"("tipo", "tamanho", "status", "status_ativo");
