const { Deduplicator } = require('./dedup');
const { JournalStorage } = require('./storage');

class PipelineWorker {
  constructor() {
    this.dedup = new Deduplicator();
    this.storage = new JournalStorage();
    this.processedCount = 0;
    this.duplicateCount = 0;
  }

  async ingest(payload) {
    const { isDuplicate, hash } = await this.dedup.checkAndAcquire(payload);
    if (isDuplicate) {
      this.duplicateCount++;
      return { status: 'rejected_duplicate', hash };
    }

    await this.storage.appendRecord({ ...payload, hash, ingestedAt: new Date().toISOString() });
    this.processedCount++;
    return { status: 'accepted', hash };
  }

  getMetrics() {
    return {
      processed: this.processedCount,
      duplicatesDetected: this.duplicateCount,
      storedRecords: this.storage.getRecordCount()
    };
  }
}

module.exports = { PipelineWorker };
