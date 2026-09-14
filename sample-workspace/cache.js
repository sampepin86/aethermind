const store = new Map();

async function getCachedToken(key) {
  return store.get(key) || null;
}

async function setCachedToken(key, value, ttlSeconds) {
  store.set(key, value);
  return true;
}

async function clearCache() {
  store.clear();
}

module.exports = {
  getCachedToken,
  setCachedToken,
  clearCache
};
