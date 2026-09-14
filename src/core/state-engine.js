const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class EpistemicStateEngine extends EventEmitter {
  constructor(workspaceDir = process.cwd()) {
    super();
    this.workspaceDir = workspaceDir;
    this.dataDir = path.join(this.workspaceDir, '.aethermind');
    this.dataFile = path.join(this.dataDir, 'telemetry.json');
    this.state = {
      session: {
        id: 'session_' + Date.now().toString(36),
        startedAt: new Date().toISOString(),
        agentName: 'AetherMind Cognitive Co-Processor',
        goal: 'Cognitive Reality Verification & Blast-Radius Mitigation'
      },
      metrics: {
        entropyScore: 12, // 0 to 100
        coherenceIndex: 94, // 0 to 100
        activeHypothesesCount: 1,
        verifiedAssumptionsCount: 0,
        unverifiedAssumptionsCount: 0,
        blastRiskAverage: 'LOW',
        actionStepsTotal: 0
      },
      nodes: [],
      edges: [],
      timeline: [],
      assumptions: [],
      filesTracked: {} // filepath -> { readAt, hash, mtime, lastModifiedBy }
    };

    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (fs.existsSync(this.dataFile)) {
      try {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        this.state = JSON.parse(raw);
        this.lastDiskMtime = fs.statSync(this.dataFile).mtimeMs;
      } catch (e) {
        this.saveState();
      }
    } else {
      this.bootstrapInitialState();
      this.saveState();
    }
  }

  reloadIfDiskNewer() {
    if (fs.existsSync(this.dataFile)) {
      try {
        const mtime = fs.statSync(this.dataFile).mtimeMs;
        if (!this.lastDiskMtime || mtime > this.lastDiskMtime) {
          const raw = fs.readFileSync(this.dataFile, 'utf8');
          this.state = JSON.parse(raw);
          this.lastDiskMtime = mtime;
        }
      } catch (e) {}
    }
  }

  bootstrapInitialState() {
    const rootHypothesis = {
      id: 'node_init_1',
      type: 'hypothesis',
      title: 'Root Hypothesis: Operational Target Coherence',
      details: 'Agent is monitoring code execution and epistemic drift in the active workspace.',
      status: 'confirmed',
      confidence: 0.98,
      timestamp: new Date().toISOString(),
      parentId: null,
      metadata: { initial: true }
    };
    this.state.nodes.push(rootHypothesis);
    this.recordTimelineEvent('session_start', 'Telemetry session initialized', { rootId: rootHypothesis.id });
  }

  saveState() {
    try {
      this.recalculateMetrics();
      fs.writeFileSync(this.dataFile, JSON.stringify(this.state, null, 2), 'utf8');
      this.emit('update', this.state);
    } catch (err) {
      console.error('Failed to persist telemetry:', err.message);
    }
  }

  addNode({ type, title, details, status = 'active', confidence = 0.85, parentId = null, metadata = {} }) {
    const id = 'node_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const node = {
      id,
      type, // 'hypothesis' | 'intervention' | 'observation' | 'assumption' | 'drift_warning'
      title,
      details,
      status, // 'active' | 'confirmed' | 'refuted' | 'stale'
      confidence: Math.max(0, Math.min(1, confidence)),
      timestamp: new Date().toISOString(),
      parentId,
      metadata
    };

    this.state.nodes.push(node);

    if (parentId && this.state.nodes.some(n => n.id === parentId)) {
      this.state.edges.push({
        id: 'edge_' + Date.now().toString(36),
        source: parentId,
        target: id,
        relationship: type === 'observation' ? 'supports' : 'branched_from',
        timestamp: new Date().toISOString()
      });
    }

    this.recordTimelineEvent('node_created', `Added ${type.toUpperCase()}: ${title}`, { nodeId: id, type });
    this.saveState();
    return node;
  }

  updateNodeStatus(nodeId, status, confidence = null, resolutionNotes = '') {
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    node.status = status;
    if (confidence !== null) node.confidence = confidence;
    if (resolutionNotes) {
      node.metadata = node.metadata || {};
      node.metadata.resolutionNotes = resolutionNotes;
    }
    node.updatedAt = new Date().toISOString();

    this.recordTimelineEvent('node_updated', `Node ${node.title} marked as ${status}`, { nodeId, status });
    this.saveState();
    return node;
  }

  addAssumption(premise, category = 'environment', riskLevel = 'MEDIUM') {
    const id = 'asm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5);
    const assumption = {
      id,
      premise,
      category, // 'environment' | 'dependency' | 'logic' | 'data'
      riskLevel, // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      verified: false,
      verificationMethod: null,
      createdAt: new Date().toISOString()
    };
    this.state.assumptions.push(assumption);
    this.recordTimelineEvent('assumption_declared', `Premise: ${premise} (${riskLevel} risk)`, { id });
    this.saveState();
    return assumption;
  }

  verifyAssumption(assumptionId, passed, proof = '') {
    const asm = this.state.assumptions.find(a => a.id === assumptionId);
    if (!asm) return null;

    asm.verified = passed;
    asm.verifiedAt = new Date().toISOString();
    asm.proof = proof;

    this.recordTimelineEvent(
      passed ? 'assumption_verified' : 'assumption_failed',
      `Assumption ${passed ? 'VERIFIED' : 'FAILED'}: ${asm.premise}`,
      { assumptionId, passed, proof }
    );
    this.saveState();
    return asm;
  }

  recordFileObservation(filepath) {
    const fullPath = path.resolve(this.workspaceDir, filepath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      this.state.filesTracked[filepath] = {
        path: filepath,
        mtime: stats.mtimeMs,
        size: stats.size,
        readAt: new Date().toISOString()
      };
      this.saveState();
    }
  }

  checkContextStaleness() {
    const warnings = [];
    for (const [relPath, info] of Object.entries(this.state.filesTracked)) {
      const fullPath = path.resolve(this.workspaceDir, relPath);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs > info.mtime) {
          warnings.push({
            file: relPath,
            observedAt: info.readAt,
            diskModifiedAt: new Date(stats.mtimeMs).toISOString(),
            risk: 'HIGH',
            message: `File modified on disk after agent internal observation! Epistemic cache is invalid.`
          });
        }
      }
    }
    return warnings;
  }

  recordTimelineEvent(actionType, summary, payload = {}) {
    this.state.metrics.actionStepsTotal++;
    const event = {
      step: this.state.metrics.actionStepsTotal,
      timestamp: new Date().toISOString(),
      actionType,
      summary,
      payload
    };
    this.state.timeline.push(event);
    if (this.state.timeline.length > 500) {
      this.state.timeline.shift();
    }
  }

  recalculateMetrics() {
    const activeHypotheses = this.state.nodes.filter(n => n.type === 'hypothesis' && n.status === 'active');
    const refutedCount = this.state.nodes.filter(n => n.status === 'refuted').length;
    const totalNodes = this.state.nodes.length || 1;

    const unverifiedAsm = this.state.assumptions.filter(a => !a.verified).length;
    const verifiedAsm = this.state.assumptions.filter(a => a.verified).length;

    // Entropy calculation: increases with unverified assumptions, refuted hypotheses loops, and stale context
    let entropy = 10;
    entropy += unverifiedAsm * 9;
    entropy += refutedCount * 6;
    entropy += activeHypotheses.length * 4;
    entropy = Math.min(98, Math.max(5, entropy));

    const coherence = Math.max(5, 100 - Math.round(entropy * 0.85));

    this.state.metrics.entropyScore = entropy;
    this.state.metrics.coherenceIndex = coherence;
    this.state.metrics.activeHypothesesCount = activeHypotheses.length;
    this.state.metrics.unverifiedAssumptionsCount = unverifiedAsm;
    this.state.metrics.verifiedAssumptionsCount = verifiedAsm;
  }

  getState() {
    this.reloadIfDiskNewer();
    this.recalculateMetrics();
    return this.state;
  }

  reset() {
    this.state.nodes = [];
    this.state.edges = [];
    this.state.timeline = [];
    this.state.assumptions = [];
    this.state.filesTracked = {};
    this.state.metrics.actionStepsTotal = 0;
    this.bootstrapInitialState();
    this.saveState();
  }
}

module.exports = EpistemicStateEngine;
