const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');
const assert = require('assert');

const createAppServer = require('../src/server/app');
const path = require('path');

const PORT = 54321;
const BASE_URL = `http://localhost:${PORT}`;
const workspaceDir = path.resolve(__dirname, '..');

async function request(reqPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = body;
        try { parsed = JSON.parse(body); } catch (e) {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n\x1b[36m⚡ AETHERMIND AUTOMATED SYSTEM & E2E VERIFICATION ⚡\x1b[0m\n');
  const { server } = createAppServer(workspaceDir, PORT);
  await new Promise(r => server.listen(PORT, r));

  let passed = 0;
  let total = 0;

  function check(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31m✘ [FAIL]\x1b[0m ${desc}: ${err.message}`);
    }
  }

  async function checkAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31m✘ [FAIL]\x1b[0m ${desc}: ${err.message}`);
    }
  }

  // 1. Static Asset Delivery
  await checkAsync('Static HTML entry point delivered with HTTP 200', async () => {
    const res = await request('/');
    assert.strictEqual(res.status, 200);
    assert(res.data.includes('AETHERMIND'));
  });

  await checkAsync('CSS Design System delivered with HTTP 200', async () => {
    const res = await request('/styles.css');
    assert.strictEqual(res.status, 200);
    assert(res.data.includes('--cyan-core'));
  });

  await checkAsync('Client-side JavaScript controller delivered with HTTP 200', async () => {
    const res = await request('/app.js');
    assert.strictEqual(res.status, 200);
    assert(res.data.includes('EpistemicNeuralGraph'));
  });

  // 2. REST API Endpoints
  await checkAsync('GET /api/state returns epistemic state structure', async () => {
    const res = await request('/api/state');
    assert.strictEqual(res.status, 200);
    assert(res.data.session && res.data.session.id);
    assert(Array.isArray(res.data.nodes));
    assert(Array.isArray(res.data.timeline));
  });

  let createdNodeId = null;
  await checkAsync('POST /api/node registers new hypothesis', async () => {
    const res = await request('/api/node', {
      method: 'POST',
      body: {
        type: 'hypothesis',
        title: 'E2E Test: Mutex lock timeout in event loop',
        details: 'Verification of asynchronous mutex locking under simulated burst.',
        confidence: 0.88
      }
    });
    assert.strictEqual(res.status, 201);
    assert(res.data.id);
    createdNodeId = res.data.id;
  });

  await checkAsync('PATCH /api/node/:id updates status and confidence', async () => {
    assert(createdNodeId);
    const res = await request(`/api/node/${createdNodeId}`, {
      method: 'PATCH',
      body: {
        status: 'confirmed',
        confidence: 0.96,
        resolutionNotes: 'Empirical load test verified deadlock resolution.'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'confirmed');
    assert.strictEqual(res.data.confidence, 0.96);
  });

  let createdAsmId = null;
  await checkAsync('POST /api/assumption registers ghost assumption', async () => {
    const res = await request('/api/assumption', {
      method: 'POST',
      body: {
        premise: 'E2E: Ephemeral file storage accessible in /tmp',
        category: 'environment',
        riskLevel: 'HIGH'
      }
    });
    assert.strictEqual(res.status, 201);
    assert(res.data.id);
    createdAsmId = res.data.id;
  });

  await checkAsync('POST /api/assumption/:id/verify verifies assumption with proof', async () => {
    assert(createdAsmId);
    const res = await request(`/api/assumption/${createdAsmId}/verify`, {
      method: 'POST',
      body: {
        passed: true,
        proof: 'File written and stat verified successfully'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.verified, true);
  });

  // 3. Blast Radius Engine
  await checkAsync('GET /api/blast computes dependencies, callers and risk', async () => {
    const res = await request('/api/blast?file=sample-workspace/auth.js');
    assert.strictEqual(res.status, 200);
    assert(res.data.metrics);
    assert(typeof res.data.metrics.riskScore === 'number');
    assert(res.data.target.detectedExports.includes('AuthService'));
    assert(res.data.directConsumers.some(c => c.file.includes('server.js')));
    assert(res.data.testSuites.some(t => t.file.includes('auth.test.js')));
  });

  // 4. Reality Probe Matrix
  await checkAsync('POST /api/probe [port] detects port status', async () => {
    const res = await request('/api/probe', {
      method: 'POST',
      body: { probeType: 'port', target: PORT }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.passed, false); // Port 4200 is currently active, so occupied
  });

  await checkAsync('POST /api/probe [syntax] validates JS AST', async () => {
    const res = await request('/api/probe', {
      method: 'POST',
      body: { probeType: 'syntax', target: 'sample-workspace/auth.js' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.passed, true);
  });

  await checkAsync('POST /api/probe [env] inspects environment variables', async () => {
    const res = await request('/api/probe', {
      method: 'POST',
      body: { probeType: 'env', target: 'PATH' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.passed, true);
  });

  // 5. Cognitive Drift & Loop Safeguard
  await checkAsync('GET /api/drift evaluates epistemic coherence and thrashing', async () => {
    const res = await request('/api/drift');
    assert.strictEqual(res.status, 200);
    assert(typeof res.data.driftIndex === 'number');
    assert(res.data.driftStatus);
  });

  // 6. WebSocket Live Telemetry Stream
  await checkAsync('WebSocket connection receives real-time broadcast on state mutation', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}`);
      let initialReceived = false;

      ws.on('open', () => {
        // Trigger state mutation via HTTP
        request('/api/node', {
          method: 'POST',
          body: {
            type: 'observation',
            title: 'WebSocket Realtime Pulse Verification',
            details: 'Testing reactive telemetry delivery'
          }
        });
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'INITIAL_STATE') {
          initialReceived = true;
        } else if (msg.type === 'STATE_UPDATE') {
          assert(msg.payload.nodes);
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket timed out waiting for update')), 4000);
    });
  });

  // 7. CLI Subcommand Executions
  check('CLI "status" command runs cleanly', () => {
    const out = execSync('node bin/aethermind.js status', { encoding: 'utf8' });
    assert(out.includes('Cognitive State Overview'));
    assert(out.includes('Coherence Index'));
  });

  check('CLI "blast" command runs cleanly and parses symbols', () => {
    const out = execSync('node bin/aethermind.js blast sample-workspace/auth.js AuthService', { encoding: 'utf8' });
    assert(out.includes('Scanning Blast Radius for'));
    assert(out.includes('AuthService'));
    assert(out.includes('sample-workspace/server.js'));
  });

  check('CLI "audit" command runs cleanly and checks loops', () => {
    const out = execSync('node bin/aethermind.js audit', { encoding: 'utf8' });
    assert(out.includes('Cognitive Drift & Reality Coherence Audit'));
  });

  check('CLI "probe" health command executes system check', () => {
    const out = execSync('node bin/aethermind.js probe', { encoding: 'utf8' });
    assert(out.includes('System Health Probe'));
    assert(out.includes('Node Runtime'));
  });

  // Close server
  server.close();

  // Summary
  console.log(`\n\x1b[36m──────────────────────────────────────────────────────────────────\x1b[0m`);
  console.log(`  \x1b[1mTest Results:\x1b[0m \x1b[32m${passed} PASSED\x1b[0m / \x1b[${passed === total ? '32' : '31'}m${total} TOTAL\x1b[0m`);
  if (passed === total) {
    console.log(`  \x1b[32m✔ ALL SYSTEMS NOMINAL: AetherMind is fully operational.\x1b[0m\n`);
  } else {
    console.log(`  \x1b[31m✘ Some tests failed.\x1b[0m\n`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('\x1b[31mFatal test error:\x1b[0m', err);
  process.exit(1);
});
