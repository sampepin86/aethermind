const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const BlastRadiusAnalyzer = require('../src/core/blast-radius');
const PolicyEngine = require('../src/core/policy-engine');
const AgentGate = require('../src/core/agent-gate');
const EpistemicStateEngine = require('../src/core/state-engine');
const UserIntentEngine = require('../src/core/intent-engine');

console.log('🧪 Running AetherMind Adversarial & Blast-Matrix Test Suite...\n');

// Create temporary fixture directory for rigorous matrix testing
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethermind-blast-matrix-'));

try {
  // Setup directory structure
  // fixture/
  //   packages/
  //     auth/
  //       token.ts
  //       reexport.js
  //       broken.js
  //     billing/
  //       invoice.jsx
  //       circularA.js
  //       circularB.js
  //     isolated/
  //       standalone.js
  //   tests/
  //     token.test.js
  fs.mkdirSync(path.join(tempDir, 'packages', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'packages', 'billing'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'packages', 'isolated'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });

  // 1. Target file (TypeScript)
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'auth', 'token.ts'),
    `export function generateToken(user: string): string {\n  return 'tok_' + user;\n}\nexport const TOKEN_EXPIRY = 3600;\n`
  );

  // 2. Direct caller (JSX)
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'billing', 'invoice.jsx'),
    `import { generateToken } from '../auth/token';\nexport function InvoiceCard() { const t = generateToken('sam'); return <div>{t}</div>; }\n`
  );

  // 3. Re-exporter
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'auth', 'reexport.js'),
    `export * from './token';\n`
  );

  // 4. Transitive caller (imports reexport.js)
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'billing', 'payment.js'),
    `const auth = require('../auth/reexport');\nmodule.exports = { pay: () => auth.generateToken('user') };\n`
  );

  // 5. Circular dependencies (circularA <-> circularB)
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'billing', 'circularA.js'),
    `const b = require('./circularB');\nmodule.exports = { a: () => b.b() };\n`
  );
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'billing', 'circularB.js'),
    `const a = require('./circularA');\nmodule.exports = { b: () => a.a() };\n`
  );

  // 6. Completely isolated file (TRUE NEGATIVE)
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'isolated', 'standalone.js'),
    `// Completely decoupled isolated module\nfunction helper() { return 42; }\nmodule.exports = { helper };\n`
  );

  // 7. Dynamic caveats file
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'auth', 'dynamic.js'),
    `const mod = './token';\nconst dynamicMod = require(mod);\nimport('./token').then(m => m.generateToken());\neval('console.log(1)');\nobj['customMethod']();\n`
  );

  // 8. Broken syntax file
  fs.writeFileSync(
    path.join(tempDir, 'packages', 'auth', 'broken.js'),
    `function unclosed() { if (true) { return // missing closing braces\n`
  );

  // 9. Coupled test suite
  fs.writeFileSync(
    path.join(tempDir, 'tests', 'token.test.js'),
    `const { generateToken } = require('../packages/auth/token');\ntest('generates token', () => expect(generateToken('a')).toBeTruthy());\n`
  );

  const analyzer = new BlastRadiusAnalyzer(tempDir);

  // --- TEST 1: True Positive Caller Detection ---
  console.log('Test 1: True Positive Caller Detection');
  const blastToken = analyzer.analyze('packages/auth/token.ts');
  const directFiles = blastToken.directConsumers.map(c => c.file);
  assert(directFiles.includes('packages/billing/invoice.jsx'), 'Should detect packages/billing/invoice.jsx as direct caller');
  assert(directFiles.includes('packages/auth/reexport.js'), 'Should detect packages/auth/reexport.js as direct caller');
  console.log('  ✔ Correctly detected direct callers across relative TypeScript/JSX boundaries.');

  // --- TEST 2: True Negative Isolation Test ---
  console.log('Test 2: True Negative Isolation (Zero False Positives)');
  const blastStandalone = analyzer.analyze('packages/isolated/standalone.js');
  assert.strictEqual(blastStandalone.directConsumers.length, 0, 'Isolated file must have 0 direct consumers');
  assert.strictEqual(blastStandalone.indirectConsumers.length, 0, 'Isolated file must have 0 indirect consumers');
  assert.strictEqual(blastStandalone.testSuites.length, 0, 'Isolated file must have 0 test suites');
  assert.strictEqual(blastStandalone.metrics.riskScore, 0, 'Isolated file must have risk score 0');
  console.log('  ✔ Isolated file has 0 callers, 0 false positives, and 0 risk score.');

  // --- TEST 3: Transitive Dependents (Indirect Consumers) ---
  console.log('Test 3: Transitive (Indirect) Consumer Detection');
  const indirectFiles = blastToken.indirectConsumers.map(c => c.file);
  assert(indirectFiles.includes('packages/billing/payment.js'), 'Should detect payment.js as indirect consumer via reexport');
  console.log('  ✔ Correctly identified transitive downstream dependent via re-export.');

  // --- TEST 4: Circular Dependency Resilience ---
  console.log('Test 4: Circular Dependency Resilience');
  const blastCircA = analyzer.analyze('packages/billing/circularA.js');
  assert(blastCircA.directConsumers.some(c => c.file.includes('circularB.js')), 'circularB should be direct consumer of circularA');
  // Must terminate cleanly without stack overflow
  console.log('  ✔ Circular dependency handled cleanly without recursion loops.');

  // --- TEST 5: Dynamic Reflection Caveats Detection ---
  console.log('Test 5: Dynamic Reflection Caveats & Confidence Degradation');
  const blastDynamic = analyzer.analyze('packages/auth/dynamic.js');
  assert(blastDynamic.caveats.length >= 3, 'Must detect at least 3 dynamic reflection caveats');
  const caveatTypes = blastDynamic.caveats.map(c => c.type);
  assert(caveatTypes.includes('DYNAMIC_IMPORT'), 'Must detect dynamic import()');
  assert(caveatTypes.includes('DYNAMIC_REQUIRE'), 'Must detect dynamic require()');
  assert(caveatTypes.includes('EVAL_EXECUTION'), 'Must detect eval() execution');
  assert(blastDynamic.metrics.confidenceScore < 90, 'Confidence score must degrade due to dynamic caveats');
  console.log(`  ✔ Dynamic caveats flagged: [${caveatTypes.join(', ')}], confidence reduced to ${blastDynamic.metrics.confidenceScore}%.`);

  // --- TEST 6: Broken Syntax Tolerance ---
  console.log('Test 6: Broken Syntax Tolerance');
  // Broken syntax in workspace must not crash analysis
  const blastBroken = analyzer.analyze('packages/auth/broken.js');
  assert(blastBroken !== null, 'Analyzer should not throw on broken syntax');
  console.log('  ✔ Tolerated unparseable files without unhandled crash.');

  // --- TEST 7: Test Suite Association ---
  console.log('Test 7: Coupled Test Suite Association');
  assert(blastToken.testSuites.some(t => t.file.includes('token.test.js')), 'Should associate tests/token.test.js');
  console.log('  ✔ Bound coupled test suite to modified token target.');

  // --- TEST 8: Agent Gate Edit-Gate Strictness ---
  console.log('Test 8: Agent Gate Edit-Gate Enforcement');
  const stateEngine = new EpistemicStateEngine(tempDir);
  const intentEngine = new UserIntentEngine(tempDir);
  const policyEngine = new PolicyEngine(tempDir, { strictScope: true, requireBlastCheck: true });
  const gate = new AgentGate(stateEngine, tempDir, intentEngine, policyEngine);

  // Attempt edit without preflight / blast scan
  const unverifiedEdit = gate.evaluateEditGate({ file: 'packages/auth/token.ts' });
  assert.strictEqual(unverifiedEdit.allowed, false, 'Edit must be blocked if blast radius not scanned');
  assert.strictEqual(unverifiedEdit.reason, 'blast_radius_not_checked');
  assert(unverifiedEdit.required.includes('blast'), 'Must require blast scan');
  console.log('  ✔ Edit-gate strictly blocked edit until blast radius is checked.');

  // Set explicit intent scope
  intentEngine.declareIntent({
    prompt: 'Update billing system',
    scope: ['packages/billing']
  });

  // Attempt edit outside declared scope
  gate.checkedBlastFiles.add('packages/auth/token.ts');
  const outOfScopeEdit = gate.evaluateEditGate({ file: 'packages/auth/token.ts' });
  assert.strictEqual(outOfScopeEdit.allowed, false, 'Edit must be blocked if outside declared scope');
  assert.strictEqual(outOfScopeEdit.reason, 'strictScope');
  console.log('  ✔ Edit-gate blocked out-of-scope file modification.');

  // Allowed edit within scope
  gate.checkedBlastFiles.add('packages/billing/invoice.jsx');
  const inScopeEdit = gate.evaluateEditGate({ file: 'packages/billing/invoice.jsx' });
  assert.strictEqual(inScopeEdit.allowed, true, 'Edit must be allowed within declared scope');
  console.log('  ✔ Edit-gate permitted in-scope target.');

  // --- TEST 9: Test-Gate Missing Suite Verification ---
  console.log('Test 9: Test-Gate Coupled Suite Verification');
  const testGateResult = gate.evaluateTestGate({
    modifiedFiles: ['packages/auth/token.ts'],
    executedTests: [] // none run
  });
  assert(testGateResult.missingTests.some(t => t.includes('token.test.js')), 'Test-gate must flag missing token.test.js');
  console.log('  ✔ Test-gate correctly flagged unexecuted coupled test suite.');

  console.log('\n🎉 ALL 9 ADVERSARIAL BLAST-MATRIX TESTS PASSED NOMINALLY!\n');
} finally {
  // Clean up fixture files
  fs.rmSync(tempDir, { recursive: true, force: true });
}
