const express = require('express');
const path = require('path');
const BlastRadiusAnalyzer = require('../core/blast-radius');
const RealityProbeMatrix = require('../core/reality-probe');
const CognitiveDriftDetector = require('../core/drift-detector');

function createApiRoutes(stateEngine, workspaceDir) {
  const router = express.Router();
  const blastAnalyzer = new BlastRadiusAnalyzer(workspaceDir);
  const driftDetector = new CognitiveDriftDetector(stateEngine);

  router.get('/state', (req, res) => {
    res.json(stateEngine.getState());
  });

  router.post('/node', (req, res) => {
    const { type, title, details, status, confidence, parentId, metadata } = req.body;
    if (!title || !type) {
      return res.status(400).json({ error: 'Missing title or type' });
    }
    const node = stateEngine.addNode({ type, title, details, status, confidence, parentId, metadata });
    res.status(201).json(node);
  });

  router.patch('/node/:id', (req, res) => {
    const { status, confidence, resolutionNotes } = req.body;
    const node = stateEngine.updateNodeStatus(req.params.id, status, confidence, resolutionNotes);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  });

  router.post('/assumption', (req, res) => {
    const { premise, category, riskLevel } = req.body;
    if (!premise) return res.status(400).json({ error: 'Premise is required' });
    const asm = stateEngine.addAssumption(premise, category, riskLevel);
    res.status(201).json(asm);
  });

  router.post('/assumption/:id/verify', (req, res) => {
    const { passed, proof } = req.body;
    const asm = stateEngine.verifyAssumption(req.params.id, passed === true, proof || '');
    if (!asm) return res.status(404).json({ error: 'Assumption not found' });
    res.json(asm);
  });

  router.get('/blast', (req, res) => {
    const targetFile = req.query.file || 'server.js';
    const targetSymbol = req.query.symbol || null;
    const analysis = blastAnalyzer.analyze(targetFile, targetSymbol);
    res.json(analysis);
  });

  router.get('/drift', (req, res) => {
    const report = driftDetector.detect();
    res.json(report);
  });

  router.post('/probe', async (req, res) => {
    const { probeType, target, options } = req.body;
    let result = null;
    try {
      if (probeType === 'port') {
        result = await RealityProbeMatrix.checkPort(parseInt(target, 10));
      } else if (probeType === 'command') {
        result = RealityProbeMatrix.checkCommand(target);
      } else if (probeType === 'syntax') {
        result = RealityProbeMatrix.checkSyntax(path.resolve(workspaceDir, target));
      } else if (probeType === 'env') {
        result = RealityProbeMatrix.checkEnvVar(target);
      } else if (probeType === 'exec') {
        result = RealityProbeMatrix.runShellAssertion(target, options?.regex);
      } else {
        return res.status(400).json({ error: `Unknown probeType: ${probeType}` });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system-health', async (req, res) => {
    const health = await RealityProbeMatrix.runSystemHealthCheck(workspaceDir);
    res.json(health);
  });

  router.post('/reset', (req, res) => {
    stateEngine.reset();
    res.json({ message: 'State reset successfully', state: stateEngine.getState() });
  });

  router.post('/demo', (req, res) => {
    loadDemoSimulation(stateEngine);
    res.json({ message: 'Demonstration trajectory loaded', state: stateEngine.getState() });
  });

  return router;
}

function loadDemoSimulation(stateEngine) {
  stateEngine.reset();

  const h1 = stateEngine.addNode({
    type: 'hypothesis',
    title: 'H1: Database Connection Pool Exhaustion under concurrency',
    details: 'Postgres pool drops sockets after 50 requests due to unclosed transaction blocks.',
    status: 'refuted',
    confidence: 0.40
  });

  const o1 = stateEngine.addNode({
    type: 'observation',
    title: 'Observation: Connection Pool Telemetry',
    details: 'Active pool connections steady at 6/20 during failure spike. Root cause is not pool starvation.',
    status: 'confirmed',
    confidence: 0.99,
    parentId: h1.id
  });

  const h2 = stateEngine.addNode({
    type: 'hypothesis',
    title: 'H2: Deadlock in Token Refresh Interceptor',
    details: 'Async mutex lock in auth middleware fails to resolve when concurrent requests hit /api/user.',
    status: 'confirmed',
    confidence: 0.95,
    parentId: h1.id
  });

  const i1 = stateEngine.addNode({
    type: 'intervention',
    title: 'Intervention: Replace lock with Atomic CAS Token Cache',
    details: 'Refactored auth.js to use Redis atomic SETNX with 1500ms lease instead of in-memory async mutex.',
    status: 'confirmed',
    confidence: 0.92,
    parentId: h2.id
  });

  const o2 = stateEngine.addNode({
    type: 'observation',
    title: 'Observation: Stress Test 1,000 req/s',
    details: 'P99 latency plummeted from 4,820ms to 42ms. Zero 504 gateway timeouts recorded.',
    status: 'confirmed',
    confidence: 0.99,
    parentId: i1.id
  });

  const h3 = stateEngine.addNode({
    type: 'hypothesis',
    title: 'H3: Secondary Memory Leak in Telemetry Logger Buffer',
    details: 'Unbounded array in logger.js retains raw payload strings across long-lived agent sub-tasks.',
    status: 'active',
    confidence: 0.78,
    parentId: i1.id
  });

  // Assumptions
  const a1 = stateEngine.addAssumption('Redis server is listening on port 6379 with auth enabled', 'environment', 'HIGH');
  stateEngine.verifyAssumption(a1.id, true, 'Reality probe confirmed TCP handshake to 127.0.0.1:6379');

  const a2 = stateEngine.addAssumption('Node v22 supports structuredClone natively without polyfill', 'dependency', 'MEDIUM');
  stateEngine.verifyAssumption(a2.id, true, 'Runtime check: typeof structuredClone === "function"');

  const a3 = stateEngine.addAssumption('Worker pool process max memory capped at 512MB by container policy', 'environment', 'CRITICAL');
  // Left unverified for visual radar demonstration!

  stateEngine.recordTimelineEvent('demo_loaded', 'Synthetic multi-stage agent cognitive flight trajectory loaded', { steps: 5 });
}

module.exports = { createApiRoutes, loadDemoSimulation };
