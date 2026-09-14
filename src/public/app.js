// AetherMind v2.0 High-Readability Frontend Application Controller

let state = {
  session: {},
  metrics: {},
  nodes: [],
  edges: [],
  timeline: [],
  assumptions: []
};

let activeSelectedNode = null;
let neuralGraph = null;
let blastRadar = null;
let ws = null;
let currentAssumptionsFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initUIComponents();
  connectWebSocket();
  fetchInitialState();
  initBlastScanner();
  fetchGitDelta();
});

function initUIComponents() {
  // Initialize Canvas Components
  const neuralCanvas = document.getElementById('neural-canvas');
  if (neuralCanvas) {
    neuralGraph = new EpistemicNeuralGraph(neuralCanvas, onNodeSelected);
  }

  const blastCanvas = document.getElementById('blast-radar-canvas');
  if (blastCanvas) {
    blastRadar = new BlastRadarVisualizer(blastCanvas);
  }

  // Studio View Navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const viewId = tab.getAttribute('data-view');
      switchView(viewId);
    });
  });

  // Quick Launch Jump Handlers
  document.getElementById('btn-jump-graph')?.addEventListener('click', () => switchView('graph'));
  document.getElementById('ql-gate')?.addEventListener('click', () => switchView('gate'));
  document.getElementById('ql-blast')?.addEventListener('click', () => switchView('blast'));
  document.getElementById('ql-probes')?.addEventListener('click', () => switchView('probes'));

  // Graph Search & Canvas Controls
  const graphSearch = document.getElementById('input-graph-search');
  if (graphSearch) {
    graphSearch.addEventListener('input', (e) => {
      if (neuralGraph) neuralGraph.setSearchQuery(e.target.value);
    });
  }

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    if (neuralGraph) neuralGraph.scale = Math.min(2.5, neuralGraph.scale * 1.2);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    if (neuralGraph) neuralGraph.scale = Math.max(0.35, neuralGraph.scale * 0.8);
  });
  document.getElementById('btn-recenter-graph')?.addEventListener('click', () => {
    if (neuralGraph) neuralGraph.recenter();
  });

  // Global Action Buttons
  document.getElementById('btn-load-demo')?.addEventListener('click', triggerDemoSimulation);
  document.getElementById('btn-empty-load-demo')?.addEventListener('click', triggerDemoSimulation);
  document.getElementById('btn-refresh-state')?.addEventListener('click', () => {
    fetchInitialState();
    fetchGitDelta();
  });
  document.getElementById('btn-reset-state')?.addEventListener('click', resetSessionState);

  // Modal Handlers - Node
  const modalNode = document.getElementById('modal-new-node');
  document.getElementById('btn-new-hypothesis')?.addEventListener('click', () => openNodeModal('hypothesis'));
  document.getElementById('btn-close-node-modal')?.addEventListener('click', () => modalNode.style.display = 'none');
  document.getElementById('btn-cancel-node-modal')?.addEventListener('click', () => modalNode.style.display = 'none');
  document.getElementById('btn-submit-new-node')?.addEventListener('click', submitNewNode);

  // Modal Handlers - Assumption
  const modalAsm = document.getElementById('modal-new-assumption');
  document.getElementById('btn-new-assumption')?.addEventListener('click', () => modalAsm.style.display = 'flex');
  document.getElementById('btn-quick-add-asm')?.addEventListener('click', () => modalAsm.style.display = 'flex');
  document.getElementById('btn-close-asm-modal')?.addEventListener('click', () => modalAsm.style.display = 'none');
  document.getElementById('btn-cancel-asm-modal')?.addEventListener('click', () => modalAsm.style.display = 'none');
  document.getElementById('btn-submit-new-asm')?.addEventListener('click', submitNewAssumption);

  // Inspector Handlers
  document.getElementById('btn-close-inspector')?.addEventListener('click', () => {
    document.getElementById('node-inspector').style.display = 'none';
  });
  document.getElementById('inspector-confidence')?.addEventListener('input', (e) => {
    document.getElementById('inspector-confidence-val').textContent = `${e.target.value}%`;
  });
  document.getElementById('btn-save-node-changes')?.addEventListener('click', saveNodeStatusChanges);
  document.getElementById('btn-branch-hypothesis')?.addEventListener('click', () => {
    if (activeSelectedNode) openNodeModal('hypothesis', activeSelectedNode.id);
  });

  // Agent Gate Studio Buttons
  document.getElementById('btn-run-preflight')?.addEventListener('click', runPreflightGate);
  document.getElementById('btn-run-postflight')?.addEventListener('click', runPostflightGate);
  document.getElementById('btn-refresh-delta')?.addEventListener('click', fetchGitDelta);

  // Reality Probes Buttons
  document.getElementById('btn-exec-port-probe')?.addEventListener('click', runPortProbe);
  document.getElementById('btn-exec-syntax-probe')?.addEventListener('click', runSyntaxProbe);
  document.getElementById('btn-exec-cmd-probe')?.addEventListener('click', runCmdProbe);
  document.getElementById('btn-exec-env-probe')?.addEventListener('click', runEnvProbe);
  document.getElementById('btn-exec-shell-probe')?.addEventListener('click', runShellProbe);
  document.getElementById('btn-run-all-probes')?.addEventListener('click', runAllProbes);

  // Assumptions Filter Pills
  document.querySelectorAll('.pill-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAssumptionsFilter = btn.getAttribute('data-filter');
      renderAssumptions(state.assumptions || []);
    });
  });
}

function switchView(viewId) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.getAttribute('data-view') === viewId) t.classList.add('active');
    else t.classList.remove('active');
  });

  document.querySelectorAll('.view-panel').forEach(p => {
    p.classList.remove('active');
  });

  const targetPanel = document.getElementById(`view-${viewId}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Re-size canvases when views become visible
  if (viewId === 'graph' && neuralGraph) {
    neuralGraph.resize();
  } else if (viewId === 'blast' && blastRadar) {
    blastRadar.resize();
    runBlastScan();
  } else if (viewId === 'gate') {
    fetchGitDelta();
  }
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    const badge = document.getElementById('session-badge-container');
    if (badge) badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    document.getElementById('session-status-text').textContent = 'RADAR LINKED';
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'STATE_UPDATE' || msg.type === 'INITIAL_STATE') {
        renderState(msg.payload);
      }
    } catch (err) {
      console.error('WS Parse Error', err);
    }
  };

  ws.onclose = () => {
    const badge = document.getElementById('session-badge-container');
    if (badge) badge.style.borderColor = 'rgba(244, 63, 94, 0.4)';
    document.getElementById('session-status-text').textContent = 'RADAR RECONNECTING';
    setTimeout(connectWebSocket, 2500);
  };
}

async function fetchInitialState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    renderState(data);
    fetchDriftReport();
  } catch (err) {
    console.error('Failed to fetch state:', err);
  }
}

function renderState(newState) {
  state = newState;

  // Header Telemetry Pills & Nav Badges
  const coherence = state.metrics.coherenceIndex || 90;
  const entropy = state.metrics.entropyScore || 10;
  const activeHypotheses = state.metrics.activeHypothesesCount || 0;
  const totalSteps = state.metrics.actionStepsTotal || 0;

  document.getElementById('stat-coherence').textContent = `${coherence}%`;
  document.getElementById('stat-entropy').textContent = `${entropy}%`;
  document.getElementById('stat-hypotheses').textContent = `${activeHypotheses} Active`;
  document.getElementById('stat-steps').textContent = `#${totalSteps} Steps`;
  document.getElementById('nav-hypo-count').textContent = activeHypotheses;

  // Update Graph
  if (neuralGraph) {
    neuralGraph.setData(state.nodes || [], state.edges || []);
  }

  const emptyState = document.getElementById('graph-empty-state');
  if (emptyState) {
    emptyState.style.display = (state.nodes || []).length === 0 ? 'flex' : 'none';
  }

  // Populate Parent dropdown in modal
  const parentSelect = document.getElementById('form-node-parent');
  if (parentSelect) {
    parentSelect.innerHTML = '<option value="">None (Root Node)</option>';
    (state.nodes || []).forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = `[${n.type.toUpperCase()}] ${n.title.substring(0, 36)}`;
      parentSelect.appendChild(opt);
    });
  }

  // Render Cockpit Overview trajectory
  renderOverviewTrajectory(state.nodes || []);

  // Render Timeline & Assumptions
  renderTimeline(state.timeline || []);
  renderAssumptions(state.assumptions || []);

  // Re-sync inspector if selected node was updated
  if (activeSelectedNode) {
    const freshNode = (state.nodes || []).find(n => n.id === activeSelectedNode.id);
    if (freshNode) {
      activeSelectedNode = freshNode;
      populateInspector(freshNode);
    }
  }
}

function renderOverviewTrajectory(nodes) {
  const container = document.getElementById('overview-trajectory-feed');
  if (!container) return;
  container.innerHTML = '';

  if (nodes.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:16px;">No reasoning trajectory recorded yet.</p>';
    return;
  }

  const recentNodes = [...nodes].reverse().slice(0, 6);
  recentNodes.forEach(node => {
    const item = document.createElement('div');
    item.className = 'trajectory-item';

    let pillClass = 'pill-hypo';
    if (node.status === 'refuted') pillClass = 'pill-refuted';
    else if (node.type === 'intervention') pillClass = 'pill-inter';
    else if (node.type === 'observation') pillClass = 'pill-obs';

    item.innerHTML = `
      <div class="trajectory-left">
        <span class="node-pill ${pillClass}">${node.status === 'refuted' ? 'REFUTED' : node.type}</span>
        <span class="trajectory-title">${escapeHtml(node.title)}</span>
      </div>
      <span class="trajectory-meta">${Math.round((node.confidence || 0.85) * 100)}% conf</span>
    `;
    item.addEventListener('click', () => {
      switchView('graph');
      onNodeSelected(node);
    });
    container.appendChild(item);
  });
}

function renderTimeline(events) {
  const container = document.getElementById('timeline-feed');
  if (!container) return;
  container.innerHTML = '';
  document.getElementById('timeline-step-count').textContent = `${events.length} steps`;

  const reversed = [...events].reverse();
  reversed.forEach(evt => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    item.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-header">
        <span class="timeline-type">${evt.actionType}</span>
        <span class="timeline-time">${timeStr}</span>
      </div>
      <div class="timeline-summary">${escapeHtml(evt.summary)}</div>
    `;
    container.appendChild(item);
  });
}

function renderAssumptions(assumptions) {
  const container = document.getElementById('assumptions-feed');
  if (!container) return;
  container.innerHTML = '';

  const unverified = assumptions.filter(a => !a.verified);
  const verified = assumptions.filter(a => a.verified);

  document.getElementById('nav-asm-count').textContent = unverified.length;
  document.getElementById('count-asm-all').textContent = assumptions.length;
  document.getElementById('count-asm-pending').textContent = unverified.length;
  document.getElementById('count-asm-verified').textContent = verified.length;

  let filtered = assumptions;
  if (currentAssumptionsFilter === 'unverified') filtered = unverified;
  else if (currentAssumptionsFilter === 'verified') filtered = verified;
  else if (currentAssumptionsFilter === 'high-risk') {
    filtered = assumptions.filter(a => ['HIGH', 'CRITICAL'].includes(a.riskLevel));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:16px;">No assumptions matching current filter.</p>';
    return;
  }

  filtered.forEach(asm => {
    const card = document.createElement('div');
    card.className = `asm-card ${asm.verified ? 'verified' : 'unverified'}`;
    const riskClass = `risk-${(asm.riskLevel || 'medium').toLowerCase()}`;

    card.innerHTML = `
      <div class="asm-header">
        <span class="asm-risk-pill ${riskClass}">${asm.riskLevel} RISK</span>
        <span class="counter-tag">${asm.category}</span>
      </div>
      <div class="asm-premise">${escapeHtml(asm.premise)}</div>
      ${asm.proof ? `<div style="font-size:0.8rem;color:var(--emerald-core);font-family:var(--font-mono);">Proof: ${escapeHtml(asm.proof)}</div>` : ''}
      <div class="asm-footer">
        <span class="asm-status-text">${asm.verified ? '✔ Verified against reality' : '⚠ Unverified Premise'}</span>
        ${!asm.verified ? `<button class="btn-micro" onclick="verifyAssumptionPrompt('${asm.id}')">Verify With Proof</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

// Node Selection & Inspector Drawer
function onNodeSelected(node) {
  activeSelectedNode = node;
  populateInspector(node);
  const drawer = document.getElementById('node-inspector');
  if (drawer) drawer.style.display = 'flex';
}

function populateInspector(node) {
  document.getElementById('inspector-node-type').textContent = node.type.toUpperCase();
  document.getElementById('inspector-title').textContent = node.title;
  document.getElementById('inspector-status-select').value = node.status;

  const confVal = Math.round((node.confidence || 0.85) * 100);
  document.getElementById('inspector-confidence').value = confVal;
  document.getElementById('inspector-confidence-val').textContent = `${confVal}%`;

  document.getElementById('inspector-details').textContent = node.details || 'No detailed rationale logged.';
}

async function saveNodeStatusChanges() {
  if (!activeSelectedNode) return;
  const newStatus = document.getElementById('inspector-status-select').value;
  const newConf = parseFloat(document.getElementById('inspector-confidence').value) / 100;

  try {
    const res = await fetch(`/api/node/${activeSelectedNode.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, confidence: newConf })
    });
    if (res.ok) {
      fetchInitialState();
    }
  } catch (err) {
    alert('Failed to update node');
  }
}

// Blast Scanner Integration
function initBlastScanner() {
  const scanBtn = document.getElementById('btn-run-blast');
  if (scanBtn) scanBtn.addEventListener('click', runBlastScan);
  runBlastScan();
}

async function runBlastScan() {
  const target = document.getElementById('input-blast-target')?.value.trim() || 'sample-workspace/auth.js';
  const symbol = document.getElementById('input-blast-symbol')?.value.trim() || '';

  try {
    const symQuery = symbol ? `&symbol=${encodeURIComponent(symbol)}` : '';
    const res = await fetch(`/api/blast?file=${encodeURIComponent(target)}${symQuery}`);
    const data = await res.json();

    if (blastRadar) {
      blastRadar.setData(data);
    }

    // Metrics
    document.getElementById('bm-direct-callers').textContent = data.metrics.directConsumersCount;
    document.getElementById('bm-test-suites').textContent = data.metrics.testSuitesCount;
    document.getElementById('bm-risk-score').textContent = `${data.metrics.riskScore}%`;
    document.getElementById('bm-confidence-score').textContent = `${data.metrics.confidenceScore || 95}%`;

    const badge = document.getElementById('blast-risk-badge');
    if (badge) {
      badge.textContent = `${data.metrics.riskLevel} RISK`;
      badge.className = `risk-badge badge-${data.metrics.riskLevel.toLowerCase()}`;
    }

    // Dynamic Caveats
    const caveatsBox = document.getElementById('blast-caveats-box');
    const caveatsList = document.getElementById('blast-caveats-list');
    if (data.caveats && data.caveats.length > 0) {
      caveatsBox.style.display = 'block';
      caveatsList.innerHTML = '';
      data.caveats.forEach(c => {
        const li = document.createElement('li');
        li.textContent = `• [${c.type}] ${c.message}`;
        caveatsList.appendChild(li);
      });
    } else {
      caveatsBox.style.display = 'none';
    }

    // Consumers List
    const consumersList = document.getElementById('affected-consumers-list');
    consumersList.innerHTML = '';
    if (data.directConsumers.length === 0) {
      consumersList.innerHTML = '<li style="color:var(--text-muted);">No direct consumers detected.</li>';
    } else {
      data.directConsumers.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `<span>📄 ${c.file}</span> <span class="badge-mini">Direct Consumer</span>`;
        consumersList.appendChild(li);
      });
    }

    // Tests List
    const testsList = document.getElementById('affected-tests-list');
    testsList.innerHTML = '';
    if (data.testSuites.length === 0) {
      testsList.innerHTML = '<li style="color:var(--text-muted);">No coupled test suites found.</li>';
    } else {
      data.testSuites.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<span>🧪 ${t.file}</span> <span class="badge-mini badge-green">Coupled Suite</span>`;
        testsList.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Blast scan failed:', err);
  }
}

// Agent Gate Studio
async function runPreflightGate() {
  const target = document.getElementById('input-gate-target').value.trim();
  const scopeRaw = document.getElementById('input-gate-scope').value.trim();
  const scope = scopeRaw ? scopeRaw.split(',').map(s => s.trim()) : [target];

  try {
    const res = await fetch('/api/gate/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFiles: [target], scope })
    });
    const report = await res.json();
    renderGateReport(report);
  } catch (err) {
    console.error('Preflight gate failed', err);
  }
}

async function runPostflightGate() {
  try {
    const res = await fetch('/api/gate/postflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const report = await res.json();
    renderGateReport(report);
  } catch (err) {
    console.error('Postflight gate failed', err);
  }
}

function renderGateReport(report) {
  document.getElementById('gate-report-type').textContent = `${report.gate} GATE VERDICT`;
  document.getElementById('gate-report-verdict').textContent = report.allowed ? 'ALLOWED TO PROCEED' : 'MODIFICATION BLOCKED';

  const badge = document.getElementById('gate-report-badge');
  badge.textContent = report.status;
  badge.className = `gate-status-badge ${report.allowed ? 'badge-green' : 'badge-rose'}`;

  // Update Cockpit Gate card
  document.getElementById('stat-gate-badge').textContent = report.status;
  document.getElementById('stat-gate-badge').className = `kpi-badge ${report.allowed ? 'badge-green' : 'badge-rose'}`;
  document.getElementById('stat-gate-val').textContent = report.allowed ? 'PERMITTED' : 'BLOCKED';

  const list = document.getElementById('gate-checks-list');
  list.innerHTML = '';

  (report.checks || []).forEach(chk => {
    const item = document.createElement('div');
    const statusClass = chk.passed ? 'pass' : (chk.severity === 'CRITICAL' ? 'fail' : 'warn');
    item.className = `gate-check-item ${statusClass}`;
    item.innerHTML = `
      <span class="chk-icon">${chk.passed ? '✔' : '✘'}</span>
      <div class="chk-body">
        <strong>${escapeHtml(chk.name)}</strong>
        <p>${escapeHtml(chk.message)}</p>
      </div>
    `;
    list.appendChild(item);
  });

  if (report.requiredActions && report.requiredActions.length > 0) {
    const actionsBox = document.createElement('div');
    actionsBox.style.marginTop = '12px';
    actionsBox.style.padding = '10px';
    actionsBox.style.background = 'rgba(245, 158, 11, 0.1)';
    actionsBox.style.borderRadius = 'var(--radius-xs)';
    actionsBox.innerHTML = `<strong style="color:var(--amber-core);font-size:0.85rem;">Mandatory Gate Requirements:</strong>`;
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '18px';
    ul.style.marginTop = '4px';
    ul.style.fontSize = '0.8rem';
    report.requiredActions.forEach(a => {
      const li = document.createElement('li');
      li.textContent = a;
      ul.appendChild(li);
    });
    actionsBox.appendChild(ul);
    list.appendChild(actionsBox);
  }
}

// Git Delta Fetcher
async function fetchGitDelta() {
  try {
    const res = await fetch('/api/git/delta');
    const data = await res.json();
    const delta = data.delta;

    document.getElementById('delta-head-commit').textContent = (delta.headCommit || 'HEAD').substring(0, 10);
    document.getElementById('delta-changes-count').textContent = `${delta.totalCurrentChanges} file(s) modified`;

    const list = document.getElementById('delta-files-list');
    list.innerHTML = '';

    if (delta.rawFiles.length === 0) {
      list.innerHTML = '<li style="color:var(--text-muted);padding:8px;">Working tree clean.</li>';
    } else {
      const violations = new Set((data.scopeValidation?.violations || []).map(v => v.file));
      delta.rawFiles.forEach(f => {
        const isUnexpected = violations.has(f.file);
        const li = document.createElement('li');
        li.className = `delta-item ${isUnexpected ? 'unexpected' : ''}`;
        li.innerHTML = `
          <span>[${f.statusText}] ${f.file}</span>
          <span class="delta-tag ${isUnexpected ? 'tag-unexpected' : 'tag-expected'}">${isUnexpected ? 'UNEXPECTED!' : 'Expected'}</span>
        `;
        list.appendChild(li);
      });
    }

    const statBox = document.getElementById('delta-diff-stat');
    statBox.textContent = delta.diffStat?.stat || 'No diff output.';
  } catch (err) {
    console.error('Failed to fetch delta', err);
  }
}

// Drift Report & Thrashing Circuit-Breaker
async function fetchDriftReport() {
  try {
    const res = await fetch('/api/drift');
    const report = await res.json();

    const badge = document.getElementById('drift-status-badge');
    badge.textContent = report.driftStatus.replace(/_/g, ' ');

    const fill = document.getElementById('drift-gauge-fill');
    fill.style.width = `${report.driftIndex}%`;
    document.getElementById('drift-gauge-text').textContent = `${report.driftIndex} / 100 Drift Index`;

    // Circuit Breaker Alert Banner
    const cbBanner = document.getElementById('circuit-breaker-alert');
    if (report.circuitBreaker) {
      cbBanner.style.display = 'flex';
      document.getElementById('cb-directive').textContent = report.mandatoryDirective;
    } else {
      cbBanner.style.display = 'none';
    }

    const cont = document.getElementById('anomalies-container');
    cont.innerHTML = '';

    if (report.anomalies.length === 0) {
      cont.innerHTML = `
        <div class="anomaly-item nominal">
          <span class="anomaly-icon" style="color:var(--emerald-core)">✔</span>
          <div class="anomaly-body">
            <span class="anomaly-title">Epistemic Trajectory Stable</span>
            <p>No circular action thrashing, context staleness, or unverified premise overload.</p>
          </div>
        </div>
      `;
    } else {
      report.anomalies.forEach(a => {
        const item = document.createElement('div');
        item.className = `anomaly-item ${a.severity === 'CRITICAL' ? 'danger' : 'warning'}`;
        item.innerHTML = `
          <span class="anomaly-icon">${a.severity === 'CRITICAL' ? '🛑' : '⚠️'}</span>
          <div class="anomaly-body">
            <span class="anomaly-title">${escapeHtml(a.title)}</span>
            <p>${escapeHtml(a.description)}</p>
          </div>
        `;
        cont.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Drift scan error', err);
  }
}

// Reality Probes
async function runPortProbe() {
  const port = document.getElementById('input-probe-port').value;
  const badge = document.getElementById('badge-probe-port');
  const resBox = document.getElementById('result-probe-port');
  badge.textContent = 'Probing...';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'port', target: port })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Available' : 'Occupied';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
  resBox.textContent = data.message;
}

async function runSyntaxProbe() {
  const file = document.getElementById('input-probe-syntax').value;
  const badge = document.getElementById('badge-probe-syntax');
  const resBox = document.getElementById('result-probe-syntax');
  badge.textContent = 'Validating...';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'syntax', target: file })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Valid AST' : 'Syntax Error';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
  resBox.textContent = data.message;
}

async function runCmdProbe() {
  const cmd = document.getElementById('input-probe-cmd').value;
  const badge = document.getElementById('badge-probe-cmd');
  const resBox = document.getElementById('result-probe-cmd');
  badge.textContent = 'Resolving...';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'command', target: cmd })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Resolved' : 'Missing';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
  resBox.textContent = data.message;
}

async function runEnvProbe() {
  const envName = document.getElementById('input-probe-env').value;
  const badge = document.getElementById('badge-probe-env');
  const resBox = document.getElementById('result-probe-env');
  badge.textContent = 'Inspecting...';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'env', target: envName })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Set' : 'Missing';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
  resBox.textContent = data.message;
}

async function runShellProbe() {
  const cmd = document.getElementById('input-probe-exec').value;
  const badge = document.getElementById('badge-probe-exec');
  const resBox = document.getElementById('result-probe-exec');
  badge.textContent = 'Asserting...';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'exec', target: cmd })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Passed' : 'Failed';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
  resBox.textContent = data.message + (data.output ? ` Output: ${data.output}` : '');
}

function runAllProbes() {
  runPortProbe();
  runSyntaxProbe();
  runCmdProbe();
  runEnvProbe();
  runShellProbe();
}

// Modal Form Submissions
function openNodeModal(defaultType = 'hypothesis', defaultParent = null) {
  document.getElementById('form-node-type').value = defaultType;
  document.getElementById('form-node-title-input').value = '';
  document.getElementById('form-node-details').value = '';
  if (defaultParent) {
    document.getElementById('form-node-parent').value = defaultParent;
  }
  document.getElementById('modal-new-node').style.display = 'flex';
}

async function submitNewNode() {
  const type = document.getElementById('form-node-type').value;
  const title = document.getElementById('form-node-title-input').value.trim();
  const details = document.getElementById('form-node-details').value.trim();
  const parentId = document.getElementById('form-node-parent').value || null;

  if (!title) {
    alert('Title is required');
    return;
  }

  const res = await fetch('/api/node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title, details, parentId })
  });

  if (res.ok) {
    document.getElementById('modal-new-node').style.display = 'none';
    fetchInitialState();
  }
}

async function submitNewAssumption() {
  const premise = document.getElementById('form-asm-premise').value.trim();
  const category = document.getElementById('form-asm-category').value;
  const riskLevel = document.getElementById('form-asm-risk').value;

  if (!premise) {
    alert('Premise is required');
    return;
  }

  const res = await fetch('/api/assumption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ premise, category, riskLevel })
  });

  if (res.ok) {
    document.getElementById('modal-new-assumption').style.display = 'none';
    fetchInitialState();
  }
}

window.verifyAssumptionPrompt = async function(asmId) {
  const proof = prompt('Enter verification proof / reality probe output:');
  if (proof !== null) {
    await fetch(`/api/assumption/${asmId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passed: true, proof })
    });
    fetchInitialState();
  }
};

async function triggerDemoSimulation() {
  try {
    const res = await fetch('/api/demo', { method: 'POST' });
    const data = await res.json();
    renderState(data.state);
    fetchDriftReport();
    fetchGitDelta();
  } catch (err) {
    console.error('Demo simulation error', err);
  }
}

async function resetSessionState() {
  if (confirm('Reset telemetry session data?')) {
    await fetch('/api/reset', { method: 'POST' });
    fetchInitialState();
    fetchGitDelta();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
