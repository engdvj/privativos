#!/usr/bin/env node

/**
 * Script para limpar operações pendentes no Redis
 * Uso: node limpar-operacoes.mjs [matricula]
 *
 * Se matricula for fornecida, limpa apenas as operações dessa matrícula.
 * Se não, limpa TODAS as operações pendentes.
 */

import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const matricula = process.argv[2];

const redis = createClient({ url: redisUrl });

redis.on('error', (err) => {
  console.error('❌ Erro ao conectar no Redis:', err);
  process.exit(1);
});

await redis.connect();
console.log('✅ Conectado ao Redis');

try {
  if (matricula) {
    // Limpar apenas uma matrícula específica
    const keysEmprestimo = `vqueue:${matricula}:emprestimo`;
    const keysDevolucao = `vqueue:${matricula}:devolucao`;

    const deletedEmp = await redis.del(keysEmprestimo);
    const deletedDev = await redis.del(keysDevolucao);

    console.log(`\n📋 Operações limpas para matrícula ${matricula}:`);
    console.log(`   - Empréstimos: ${deletedEmp}`);
    console.log(`   - Devoluções: ${deletedDev}`);

    if (deletedEmp + deletedDev === 0) {
      console.log(`\n⚠️  Nenhuma operação pendente encontrada para a matrícula ${matricula}`);
    } else {
      console.log(`\n✅ Total de operações limpas: ${deletedEmp + deletedDev}`);
    }
  } else {
    // Limpar todas as operações pendentes
    const pattern = 'vqueue:*';
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      console.log('\n✅ Nenhuma operação pendente encontrada');
    } else {
      console.log(`\n📋 Encontradas ${keys.length} operações pendentes:`);
      for (const key of keys) {
        console.log(`   - ${key}`);
      }

      const deleted = await redis.del(keys);
      console.log(`\n✅ Total de operações limpas: ${deleted}`);
    }
  }
} catch (error) {
  console.error('❌ Erro:', error);
  process.exit(1);
} finally {
  await redis.quit();
  console.log('\n🔌 Desconectado do Redis');
}
