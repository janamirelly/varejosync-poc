// backend/src/db/txLock.js
let chain = Promise.resolve();

/**
 * withTxLock(fn)
 * Serializa blocos críticos (transações) numa única conexão sqlite.
 * fn deve retornar Promise.
 */
function withTxLock(fn) {
  const run = chain.then(() => fn());
  chain = run.catch(() => {}); // mantém a fila viva mesmo com erro
  return run;
}

module.exports = { withTxLock };
