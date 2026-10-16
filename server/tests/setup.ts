/**
 * Os testes de integração rodam contra um PostgreSQL real.
 * Aponte DATABASE_URL para um banco de testes (veja README, seção "Testes").
 */
process.env.NODE_ENV = 'test';
process.env.APP_SECRET ??= 'segredo-de-teste-local-1234567890';
process.env.RATE_LIMIT_LOGIN_MAX ??= '1000';
process.env.RATE_LIMIT_PUBLIC_MAX ??= '100000';