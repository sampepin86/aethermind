// AetherMind Frontend Application Controller

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

document.addEventListener('DOMContentLoaded', () => {
  initUIComponents();
  connectWebSocket();
  fetchInitialState();
  initBlastScanner();
});

function initUIComponents() {
  // Initialize Canvas Components
  const neuralCanvas = document.getElementById('neural-canvas');
  neuralGraph = new EpistemicNeuralGraph(neuralCanvas, onNodeSelected);

  const blastCanvas = document.getElementById('blast-radar-canvas');
  blastRadar = new BlastRadarVisualizer(blastCanvas);

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

      const targetTab = btn.getAttribute('data-tab');
      btn.classList.add('active');
      document.getElementById(`tab-pane-${targetTab}`).classList.add('active');
    });
  });

  // Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    neuralGraph.scale = Math.min(2.5, neuralGraph.scale * 1.2);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    neuralGraph.scale = Math.max(0.4, neuralGraph.scale * 0.8);
  });
  document.getElementById('btn-recenter-graph').addEventListener('click', () => {
    neuralGraph.recenter();
  });

  // Action Buttons
  document.getElementById('btn-load-demo').addEventListener('click', triggerDemoSimulation);
  document.getElementById('btn-empty-load-demo').addEventListener('click', triggerDemoSimulation);
  document.getElementById('btn-refresh-state').addEventListener('click', fetchInitialState);
  document.getElementById('btn-reset-state').addEventListener('click', resetSessionState);

  // Modal Handlers - Node
  const modalNode = document.getElementById('modal-new-node');
  document.getElementById('btn-new-hypothesis').addEventListener('click', () => openNodeModal('hypothesis'));
  document.getElementById('btn-close-node-modal').addEventListener('click', () => modalNode.style.display = 'none');
  document.getElementById('btn-cancel-node-modal').addEventListener('click', () => modalNode.style.display = 'none');
  document.getElementById('btn-submit-new-node').addEventListener('click', submitNewNode);

  // Modal Handlers - Assumption
  const modalAsm = document.getElementById('modal-new-assumption');
  document.getElementById('btn-new-assumption').addEventListener('click', () => modalAsm.style.display = 'flex');
  document.getElementById('btn-quick-add-asm').addEventListener('click', () => modalAsm.style.display = 'flex');
  document.getElementById('btn-close-asm-modal').addEventListener('click', () => modalAsm.style.display = 'none');
  document.getElementById('btn-cancel-asm-modal').addEventListener('click', () => modalAsm.style.display = 'none');
  document.getElementById('btn-submit-new-asm').addEventListener('click', submitNewAssumption);

  // Inspector Handlers
  document.getElementById('btn-close-inspector').addEventListener('click', () => {
    document.getElementById('node-inspector').style.display = 'none';
  });
  document.getElementById('inspector-confidence').addEventListener('input', (e) => {
    document.getElementById('inspector-confidence-val').textContent = `${e.target.value}%`;
  });
  document.getElementById('btn-save-node-changes').addEventListener('click', saveNodeStatusChanges);
  document.getElementById('btn-branch-hypothesis').addEventListener('click', () => {
    if (activeSelectedNode) {
      openNodeModal('hypothesis', activeSelectedNode.id);
    }
  });

  // Probe Buttons
  document.getElementById('btn-exec-port-probe').addEventListener('click', runPortProbe);
  document.getElementById('btn-exec-syntax-probe').addEventListener('click', runSyntaxProbe);
  document.getElementById('btn-exec-env-probe').addEventListener('click', runEnvProbe);
  document.getElementById('btn-run-all-probes').addEventListener('click', runAllProbes);
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    document.getElementById('session-badge-container').style.borderColor = 'rgba(0, 242, 254, 0.4)';
    document.getElementById('session-status-text').textContent = 'RADAR LINK ESTABLISHED';
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
    document.getElementById('session-badge-container').style.borderColor = 'rgba(244, 63, 94, 0.4)';
    document.getElementById('session-status-text').textContent = 'RADAR OFFLINE - RECONNECTING';
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

  // Header Telemetry Pills
  document.getElementById('stat-coherence').textContent = `${state.metrics.coherenceIndex || 90}%`;
  document.getElementById('stat-entropy').textContent = `${state.metrics.entropyScore || 10}%`;
  document.getElementById('stat-hypotheses').textContent = `${state.metrics.activeHypothesesCount || 0} Active`;
  document.getElementById('stat-steps').textContent = `#${state.metrics.actionStepsTotal || 0}`;

  // Update Graph
  if (neuralGraph) {
    neuralGraph.setData(state.nodes, state.edges);
  }

  const emptyState = document.getElementById('graph-empty-state');
  if (state.nodes.length === 0) {
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';
  }

  // Populate Parent dropdown in modal
  const parentSelect = document.getElementById('form-node-parent');
  parentSelect.innerHTML = '<option value="">None (Root Node)</option>';
  state.nodes.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.id;
    opt.textContent = `[${n.type.toUpperCase()}] ${n.title.substring(0, 32)}`;
    parentSelect.appendChild(opt);
  });

  // Render Timeline
  renderTimeline(state.timeline);

  // Render Assumptions
  renderAssumptions(state.assumptions);

  // Re-sync inspector if selected node was updated
  if (activeSelectedNode) {
    const freshNode = state.nodes.find(n => n.id === activeSelectedNode.id);
    if (freshNode) {
      activeSelectedNode = freshNode;
      populateInspector(freshNode);
    }
  }
}

function renderTimeline(events) {
  const container = document.getElementById('timeline-feed');
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
  container.innerHTML = '';

  const unverified = assumptions.filter(a => !a.verified);
  document.getElementById('badge-unverified-count').textContent = unverified.length;

  if (assumptions.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;">No assumptions recorded yet.</p>';
    return;
  }

  assumptions.forEach(asm => {
    const card = document.createElement('div');
    card.className = `asm-card ${asm.verified ? 'verified' : 'unverified'}`;

    const riskClass = `risk-${(asm.riskLevel || 'medium').toLowerCase()}`;

    card.innerHTML = `
      <div class="asm-header">
        <span class="asm-risk-pill ${riskClass}">${asm.riskLevel} RISK</span>
        <span class="counter-tag">${asm.category}</span>
      </div>
      <div class="asm-premise">${escapeHtml(asm.premise)}</div>
      <div class="asm-footer">
        <span class="asm-status-text">${asm.verified ? '✔ Verified' : '⚠ Pending Verification'}</span>
        ${!asm.verified ? `<button class="btn-micro" onclick="verifyAssumptionPrompt('${asm.id}')">Verify</button>` : ''}
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
  drawer.style.display = 'flex';
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
  scanBtn.addEventListener('click', runBlastScan);
  runBlastScan(); // Trigger initial
}

async function runBlastScan() {
  const target = document.getElementById('input-blast-target').value.trim() || 'sample-workspace/auth.js';
  try {
    const res = await fetch(`/api/blast?file=${encodeURIComponent(target)}`);
    const data = await res.json();

    // Update Radar
    if (blastRadar) {
      blastRadar.setData(data);
    }

    // Update metrics
    document.getElementById('bm-direct-callers').textContent = data.metrics.directConsumersCount;
    document.getElementById('bm-test-suites').textContent = data.metrics.testSuitesCount;
    document.getElementById('bm-risk-score').textContent = `${data.metrics.riskScore}%`;

    const badge = document.getElementById('blast-risk-badge');
    badge.textContent = `${data.metrics.riskLevel} RISK`;
    badge.className = `risk-badge badge-${data.metrics.riskLevel.toLowerCase()}`;

    // Update affected files list
    const list = document.getElementById('affected-files-list');
    list.innerHTML = '';
    if (data.directConsumers.length === 0 && data.testSuites.length === 0) {
      list.innerHTML = '<li style="color:var(--text-dim);">No downstream dependents identified.</li>';
    } else {
      data.directConsumers.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="file-icon">📄</span> ${c.file} <span class="badge-mini">Direct Consumer</span>`;
        list.appendChild(li);
      });
      data.testSuites.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="file-icon">🧪</span> ${t.file} <span class="badge-mini badge-green">Test Suite</span>`;
        list.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Blast scan failed:', err);
  }
}

// Drift Report
async function fetchDriftReport() {
  try {
    const res = await fetch('/api/drift');
    const report = await res.json();

    const badge = document.getElementById('drift-status-badge');
    badge.textContent = report.driftStatus.replace('_', ' ');

    const fill = document.getElementById('drift-gauge-fill');
    fill.style.width = `${report.driftIndex}%`;
    document.getElementById('drift-gauge-text').textContent = `${report.driftIndex} / 100 Drift Index`;

    const cont = document.getElementById('anomalies-container');
    cont.innerHTML = '';

    if (report.anomalies.length === 0) {
      cont.innerHTML = `
        <div class="anomaly-item nominal">
          <span class="anomaly-icon">✔</span>
          <div class="anomaly-body">
            <span class="anomaly-title">Agent Epistemic Lineage Stable</span>
            <p>No circular action thrashing or context staleness detected.</p>
          </div>
        </div>
      `;
    } else {
      report.anomalies.forEach(a => {
        const item = document.createElement('div');
        item.className = `anomaly-item ${a.severity === 'CRITICAL' ? 'danger' : 'warning'}`;
        item.innerHTML = `
          <span class="anomaly-icon">⚠</span>
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

// Probes
async function runPortProbe() {
  const port = document.getElementById('input-probe-port').value;
  const badge = document.getElementById('badge-probe-port');
  badge.textContent = 'Probing...';
  badge.className = 'probe-badge';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'port', target: port })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Available' : 'Occupied';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
}

async function runSyntaxProbe() {
  const file = document.getElementById('input-probe-syntax').value;
  const badge = document.getElementById('badge-probe-syntax');
  badge.textContent = 'Checking...';
  badge.className = 'probe-badge';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'syntax', target: file })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Valid AST' : 'Syntax Error';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
}

async function runEnvProbe() {
  const envName = document.getElementById('input-probe-env').value;
  const badge = document.getElementById('badge-probe-env');
  badge.textContent = 'Inspecting...';

  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeType: 'env', target: envName })
  });
  const data = await res.json();
  badge.textContent = data.passed ? 'Set' : 'Missing';
  badge.className = `probe-badge ${data.passed ? 'pass' : 'fail'}`;
}

function runAllProbes() {
  runPortProbe();
  runSyntaxProbe();
  runEnvProbe();
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
  const proof = prompt('Enter verification proof / command output:');
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
  } catch (err) {
    console.error('Demo simulation error', err);
  }
}

async function resetSessionState() {
  if (confirm('Reset telemetry session data?')) {
    await fetch('/api/reset', { method: 'POST' });
    fetchInitialState();
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
