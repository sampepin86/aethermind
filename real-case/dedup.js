const crypto = require('crypto');

class Deduplicator {
  constructor(windowMs = 5000) {
    this.windowMs = windowMs;
    this.seen = new Map(); // id -> timestamp
    this.inFlightReservations = new Set(); // Atomic reservation lock
  }

  async checkAndAcquire(payload) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    
    // ATOMIC RESERVATION (Prevents check-then-act race conditions)
    // Synchronous check & reservation eliminates concurrent race window
    if (this.seen.has(hash) || this.inFlightReservations.has(hash)) {
      return { isDuplicate: true, hash };
    }

    // Atomically claim the slot before entering asynchronous processing
    this.inFlightReservations.add(hash);

    try {
      // Simulate asynchronous metadata lookup
      await new Promise(r => setTimeout(r, 5));

      // Mark permanently seen in cache
      this.seen.set(hash, Date.now());
      return { isDuplicate: false, hash };
    } finally {
      // Release in-flight reservation
      this.inFlightReservations.delete(hash);
    }
  }

  getCacheSize() {
    return this.seen.size;
  }
}

module.exports = { Deduplicator };
