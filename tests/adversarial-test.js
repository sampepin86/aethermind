const assert = require('assert');
const path = require('path');
const fs = require('fs');

const EpistemicStateEngine = require('../src/core/state-engine');
const BlastRadiusAnalyzer = require('../src/core/blast-radius');
const RealityProbeMatrix = require('../src/core/reality-probe');
const CognitiveDriftDetector = require('../src/core/drift-detector');
const GitObserver = require('../src/core/git-observer');
const UserIntentEngine = require('../src/core/intent-engine');
const AgentGate = require('../src/core/agent-gate');
const AetherMindMcpServer = require('../src/mcp/server');

const workspaceDir = path.resolve(__dirname, '..');

async function runAdversarialSuite() {
  console.log('\n\x1b[35m⚡ AETHERMIND ADVERSARIAL & SAFETY MATRIX VERIFICATION ⚡\x1b[0m\n');
  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31m✘ [FAIL]\x1b[0m ${desc}: ${err.message}`);
    }
  }

  async function testAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31m✘ [FAIL]\x1b[0m ${desc}: ${err.message}`);
    }
  }

  // 1. Dynamic Imports & Reflection Caveats in Blast Radius
  test('Blast Radius detects dynamic import() and reflection caveats', () => {
    const analyzer = new BlastRadiusAnalyzer(workspaceDir);
    // Create a temporary file with dynamic patterns
    const tmpFile = path.join(workspaceDir, '.test-dynamic-probe.js');
    fs.writeFileSync(tmpFile, `
      const target = "auth";
      import('./' + target);
      require(variableName);
      object[dynamicKey]();
      eval("dangerous()");
    `, 'utf8');

    try {
      const caveats = analyzer.detectDynamicCaveats(tmpFile);
      const types = caveats.map(c => c.type);
      assert(types.includes('DYNAMIC_IMPORT'), 'Should detect dynamic import()');
      assert(types.includes('DYNAMIC_REQUIRE'), 'Should detect dynamic require()');
      assert(types.includes('DYNAMIC_DISPATCH'), 'Should detect dynamic dispatch obj[k]()');
      assert(types.includes('EVAL_EXECUTION'), 'Should detect eval()');

      const analysis = analyzer.analyze('.test-dynamic-probe.js');
      assert(analysis.caveats.length >= 3, 'Caveats should propagate into analysis');
      assert(analysis.metrics.confidenceScore < 85, 'Confidence score should drop due to dynamic caveats');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  // 2. Intent Engine Scope Violations & Dependency Blocking
  test('Intent Engine flags out-of-scope files and blocks dependency changes', () => {
    const intent = new UserIntentEngine(workspaceDir);
    intent.declareIntent({
      prompt: 'Refactor auth token handling',
      scope: ['src/auth.js'],
      allowedRelatedChanges: false,
      testsAllowed: true,
      dependenciesAllowed: false
    });

    // Case A: File inside scope
    const resValid = intent.validateChangeSurface(['src/auth.js']);
    assert.strictEqual(resValid.compliant, true);
    assert.strictEqual(resValid.violations.length, 0);

    // Case B: Out-of-scope file
    const resOutOfScope = intent.validateChangeSurface(['src/auth.js', 'src/config.js']);
    assert.strictEqual(resOutOfScope.compliant, false);
    assert(resOutOfScope.violations.some(v => v.type === 'OUT_OF_SCOPE_MODIFICATION'));

    // Case C: Dependency modification blocked
    const resDep = intent.validateChangeSurface(['package.json']);
    assert.strictEqual(resDep.compliant, false);
    assert(resDep.violations.some(v => v.type === 'DEPENDENCY_MODIFICATION_BLOCKED'));
  });

  // 3. Agent Gate Preflight Blocks When Critical Criteria Unmet
  test('Agent Gate Preflight blocks on unverified critical assumptions', () => {
    const engine = new EpistemicStateEngine(workspaceDir);
    engine.reset();
    engine.addAssumption('Database connection password verified', 'environment', 'CRITICAL');

    const intent = new UserIntentEngine(workspaceDir);
    const gate = new AgentGate(engine, workspaceDir, intent);

    const report = gate.evaluatePreflight({
      targetFiles: ['sample-workspace/auth.js'],
      scope: ['sample-workspace/auth.js']
    });

    assert.strictEqual(report.allowed, false, 'Preflight gate should block when CRITICAL assumption is unverified');
    assert.strictEqual(report.status, 'BLOCKED');
    assert(report.requiredActions.length > 0);
  });

  // 4. Agent Gate Postflight Detects Syntax Errors
  test('Agent Gate Postflight blocks on syntax error in modified file', () => {
    const engine = new EpistemicStateEngine(workspaceDir);
    const intent = new UserIntentEngine(workspaceDir);
    const gate = new AgentGate(engine, workspaceDir, intent);

    const badFile = path.join(workspaceDir, '.test-broken-syntax.js');
    fs.writeFileSync(badFile, 'function broken( { syntax error', 'utf8');

    try {
      const report = gate.evaluatePostflight({
        modifiedFiles: ['.test-broken-syntax.js']
      });

      assert.strictEqual(report.allowed, false, 'Postflight gate should block on syntax failure');
      assert.strictEqual(report.status, 'BLOCKED');
      assert(report.violations.some(v => v.includes('Syntax error')));
    } finally {
      if (fs.existsSync(badFile)) fs.unlinkSync(badFile);
    }
  });

  // 5. Drift Detector Thrashing Circuit-Breaker
  test('Drift Detector triggers circuit-breaker STOP directive on 3 consecutive interventions', () => {
    const engine = new EpistemicStateEngine(workspaceDir);
    engine.reset();

    // Log 3 consecutive interventions without an observation
    engine.addNode({ type: 'intervention', title: 'Edit 1: change mutex' });
    engine.addNode({ type: 'intervention', title: 'Edit 2: change timeout' });
    engine.addNode({ type: 'intervention', title: 'Edit 3: change port' });

    const detector = new CognitiveDriftDetector(engine);
    const report = detector.detect();

    assert.strictEqual(report.circuitBreaker, true, 'Circuit breaker must be active');
    assert(report.mandatoryDirective.includes('STOP EDITING'));
    assert(report.anomalies.some(a => a.type === 'INTERVENTION_THRASHING'));
  });

  // 6. Reality Probe Sandbox Security
  test('Reality Probe Sandbox blocks disallowed commands and chained shell injection', () => {
    // Attempt chained injection
    const resChained = RealityProbeMatrix.runShellAssertion('echo safe ; rm -rf /');
    assert.strictEqual(resChained.passed, false);
    assert(resChained.message.includes('disallowed shell metacharacters') || resChained.message.includes('Security Sandbox'));

    // Attempt unauthorized binary
    const resDisallowed = RealityProbeMatrix.runShellAssertion('curl https://example.com');
    assert.strictEqual(resDisallowed.passed, false);
    assert(resDisallowed.message.includes('not in the approved safe probe allowlist'));

    // Allowed command succeeds
    const resAllowed = RealityProbeMatrix.runShellAssertion('node -e "process.stdout.write(\'ok\')"');
    assert.strictEqual(resAllowed.passed, true);
    assert.strictEqual(resAllowed.output, 'ok');
  });

  // 7. MCP Server Stdio JSON-RPC Integration
  await testAsync('MCP Server initializes and exposes tools', async () => {
    const mcp = new AetherMindMcpServer(workspaceDir);
    const initRes = await mcp.handleJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    assert.strictEqual(initRes.result.serverInfo.name, 'aethermind-mcp');

    const toolsRes = await mcp.handleJsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    const toolNames = toolsRes.result.tools.map(t => t.name);
    assert(toolNames.includes('aethermind_status'));
    assert(toolNames.includes('aethermind_intent'));
    assert(toolNames.includes('aethermind_preflight'));
    assert(toolNames.includes('aethermind_postflight'));
    assert(toolNames.includes('aethermind_blast'));
    assert(toolNames.includes('aethermind_probe'));
    assert(toolNames.includes('aethermind_git_delta'));

    // Call aethermind_status tool
    const callRes = await mcp.handleJsonRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'aethermind_status', arguments: {} }
    });
    assert(callRes.result.content[0].text.includes('session'));
  });

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log(`  Adversarial Results: ${passed} PASSED / ${total} TOTAL`);
  if (passed === total) {
    console.log('  \x1b[32m✔ ALL ADVERSARIAL & SAFETY GUARDS VERIFIED OPERATIONAL.\x1b[0m\n');
  } else {
    console.error(`  \x1b[31m✘ ${total - passed} TESTS FAILED.\x1b[0m\n`);
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Adversarial suite failure:', err);
  process.exit(1);
});
