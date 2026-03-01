ALTER TABLE "solicitacoes"
ADD COLUMN "origem_operacao" VARCHAR(20) NOT NULL DEFAULT 'colaborador',
ADD COLUMN "setor_solicitante" VARCHAR(100);

ALTER TABLE "devolucoes"
ADD COLUMN "origem_operacao" VARCHAR(20) NOT NULL DEFAULT 'colaborador',
ADD COLUMN "setor_solicitante" VARCHAR(100);

CREATE INDEX "idx_solicitacoes_origem_operacao" ON "solicitacoes"("origem_operacao");
CREATE INDEX "idx_solicitacoes_setor_solicitante" ON "solicitacoes"("setor_solicitante");
CREATE INDEX "idx_devolucoes_origem_operacao" ON "devolucoes"("origem_operacao");
CREATE INDEX "idx_devolucoes_setor_solicitante" ON "devolucoes"("setor_solicitante");
