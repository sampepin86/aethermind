// Mock database client
async function queryDb(sql, params = []) {
  return { id: 101, email: params[0] || 'user@example.com', role: 'admin' };
}

async function connectPool() {
  return { status: 'connected', poolSize: 20 };
}

module.exports = {
  queryDb,
  connectPool
};
