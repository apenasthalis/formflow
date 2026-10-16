/** Gera chaves aleatórias usadas para idempotência de submissões e drafts. */

function randomPart(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Chave de idempotência (16–80 caracteres, A–Z a–z, 0–9, - e _).
 * Gerada uma única vez por sessão de resposta: reenvios usam a mesma chave,
 * então o servidor nunca cria duas submissões para o mesmo envio.
 */
export function createIdempotencyKey(): string {
  return `ff_${Date.now().toString(36)}_${randomPart()}`;
}