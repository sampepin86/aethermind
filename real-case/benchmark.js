const { PipelineWorker } = require('./worker');

async function runBenchmark() {
  console.log('\n🚀 Starting Concurrent Pipeline Stress Test...');
  console.log('Sending 100 simultaneous requests (50 unique IDs x 2 concurrent sends)...');

  const worker = new PipelineWorker();
  const startTime = Date.now();

  const requests = [];
  // 50 unique items, each fired twice concurrently to test race conditions
  for (let i = 1; i <= 50; i++) {
    const payload = { id: `event_${i}`, userId: `usr_${i * 10}`, amount: i * 5.5 };
    requests.push(worker.ingest(payload));
    requests.push(worker.ingest(payload)); // identical payload sent in the same batch tick
  }

  // Fire all 100 concurrently
  const results = await Promise.all(requests);
  const elapsed = Date.now() - startTime;

  const metrics = worker.getMetrics();
  const records = worker.storage.readAllRecords();
  const storedIds = records.map(r => r.id);
  const uniqueStoredIds = new Set(storedIds);

  const duplicateLeaks = storedIds.length - uniqueStoredIds.size;

  console.log(`\n── Stress Test Finished in ${elapsed}ms ──`);
  console.log(`Total Requests Processed: ${results.length}`);
  console.log(`Accepted by Worker:       ${metrics.processed}`);
  console.log(`Rejected as Duplicates:   ${metrics.duplicatesDetected}`);
  console.log(`Stored in Journal:        ${metrics.storedRecords}`);
  console.log(`Unique Records in Store:  ${uniqueStoredIds.size}`);
  console.log(`Duplicate Leaks to Disk:  ${duplicateLeaks > 0 ? `\x1b[31m${duplicateLeaks} LEAKED DUPLICATES!\x1b[0m` : `\x1b[32m0 (PERFECT DEDUPLICATION)\x1b[0m`}`);

  if (duplicateLeaks > 0) {
    console.error(`\n\x1b[31m✘ CRITICAL FAILURE: Concurrency race condition allowed duplicate records into journal!\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\n\x1b[32m✔ SUCCESS: 100% deduplication accuracy under high concurrency.\x1b[0m`);
    process.exit(0);
  }
}

runBenchmark().catch(err => {
  console.error('Fatal error in benchmark:', err);
  process.exit(1);
});
