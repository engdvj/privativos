import { randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";
import { AppError } from "../errors/app-error.js";
import { sseManager } from "../sse/sse-manager.js";

export type TipoOperacao = "emprestimo" | "devolucao";

export interface QueuePayload {
  codigo: string;
  operador_nome: string;
  quantidade: number;
  tamanho?: string | null;
  item_codigos: string[];
  criado_em: string;
}

export class ValidationQueueService {
  async gerarCodigo(input: {
    matricula: string;
    tipo: TipoOperacao;
    quantidade: number;
    tamanho?: string;
    itemCodigos?: string[];
    operadorNome: string;
  }) {
    const pendingKey = this.queueKey(input.matricula, input.tipo);
    const alreadyPending = await redis.exists(pendingKey);

    if (alreadyPending) {
      throw new AppError(
        409,
        "PENDING_OPERATION_ALREADY_EXISTS",
        "Ja existe operacao pendente para a matricula e tipo informados",
      );
    }

    const codigo = randomInt(100000, 1000000).toString();
    const payload: QueuePayload = {
      codigo,
      operador_nome: input.operadorNome,
      quantidade: input.quantidade,
      tamanho: input.tamanho ?? null,
      item_codigos: [...new Set(input.itemCodigos ?? [])],
      criado_em: new Date().toISOString(),
    };

    return this.persistAndNotify(input.matricula, input.tipo, payload);
  }

  async consumirCodigo(input: {
    matricula: string;
    tipo: TipoOperacao;
    codigo: string;
  }) {
    const key = this.queueKey(input.matricula, input.tipo);
    const raw = await redis.get(key);

    if (!raw) {
      throw new AppError(409, "CODE_EXPIRED", "Codigo expirado ou inexistente");
    }

    const payload = JSON.parse(raw) as QueuePayload;

    if (payload.codigo !== input.codigo) {
      throw new AppError(409, "INVALID_CODE", "Codigo invalido");
    }

    return payload;
  }

  async cancelar(input: { matricula: string; tipo: TipoOperacao }) {
    const key = this.queueKey(input.matricula, input.tipo);
    const raw = await redis.get(key);

    if (!raw) {
      throw new AppError(404, "NO_PENDING_OPERATION", "Nao existe operacao pendente");
    }

    await redis.del(key);

    const result = {
      sucesso: false,
      mensagem: "Operacao cancelada",
      timestamp: new Date().toISOString(),
    };

    await redis.set(this.resultKey(input.matricula), JSON.stringify(result), "EX", 60);
    sseManager.emit(input.matricula, "operation_cancelled", result);

    return { sucesso: true };
  }

  async getPendingByMatricula(matricula: string) {
    const [emprestimoRaw, devolucaoRaw] = await Promise.all([
      redis.get(this.queueKey(matricula, "emprestimo")),
      redis.get(this.queueKey(matricula, "devolucao")),
    ]);

    if (emprestimoRaw) {
      return { tipo: "emprestimo" as const, payload: JSON.parse(emprestimoRaw) as QueuePayload };
    }

    if (devolucaoRaw) {
      return { tipo: "devolucao" as const, payload: JSON.parse(devolucaoRaw) as QueuePayload };
    }

    return null;
  }

  async statusSetor(matricula: string) {
    const pending = await this.getPendingByMatricula(matricula);
    if (!pending) {
      return { status: "sem_pendencia", codigo_ativo: false };
    }

    return {
      status: "aguardando_confirmacao",
      codigo_ativo: true,
      tipo: pending.tipo,
    };
  }

  async registrarResultado(matricula: string, sucesso: boolean, mensagem: string) {
    const payload = {
      sucesso,
      mensagem,
      timestamp: new Date().toISOString(),
    };

    await redis.set(this.resultKey(matricula), JSON.stringify(payload), "EX", 60);
    sseManager.emit(matricula, sucesso ? "operation_confirmed" : "operation_cancelled", payload);
  }

  async limparOperacao(matricula: string, tipo: TipoOperacao) {
    await redis.del(this.queueKey(matricula, tipo));
  }

  private async persistAndNotify(matricula: string, tipo: TipoOperacao, payload: QueuePayload) {
    await redis.set(
      this.queueKey(matricula, tipo),
      JSON.stringify(payload),
      "EX",
      env.VALIDATION_TTL_SECONDS,
    );

    sseManager.emit(matricula, "code_generated", {
      codigo: payload.codigo,
      tipo,
      quantidade: payload.quantidade,
      tamanho: payload.tamanho ?? null,
      item_codigos: payload.item_codigos,
    });

    return { codigo: payload.codigo };
  }

  private queueKey(matricula: string, tipo: TipoOperacao) {
    return `vqueue:${matricula}:${tipo}`;
  }

  private resultKey(matricula: string) {
    return `vresult:${matricula}`;
  }
}
