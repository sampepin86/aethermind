const { PipelineWorker } = require('./worker');
const assert = require('assert');

async function testConcurrentDeduplication() {
  const worker = new PipelineWorker();
  const requests = [];

  // 25 concurrent collision pairs
  for (let i = 1; i <= 25; i++) {
    const payload = { id: `test_event_${i}`, val: i };
    requests.push(worker.ingest(payload));
    requests.push(worker.ingest(payload));
  }

  await Promise.all(requests);
  const records = worker.storage.readAllRecords();
  const storedIds = records.map(r => r.id);
  const uniqueStoredIds = new Set(storedIds);

  assert.strictEqual(storedIds.length, uniqueStoredIds.size, 'Zero duplicate records should leak to storage');
  assert.strictEqual(storedIds.length, 25, 'Exactly 25 unique records should be stored');
  console.log('✔ Concurrent deduplication regression test passed.');
}

testConcurrentDeduplication().catch(err => {
  console.error('Regression test failed:', err);
  process.exit(1);
});
