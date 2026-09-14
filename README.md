# ⚡ AetherMind

<div align="center">

**Autonomous Agent Epistemic Flight Recorder & Dynamic Reality Engine**  
*The cognitive co-processor that keeps AI coding agents grounded, regression-free, and accountable.*

[![Version](https://img.shields.io/badge/version-1.0.0-cyan.svg?style=flat-square)](https://github.com/sampepin86/aethermind)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-emerald.svg?style=flat-square)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-18%2F18%20passing-10b981.svg?style=flat-square)](tests/e2e-test.js)
[![Zero Dependencies](https://img.shields.io/badge/architecture-lightweight%20pure--JS-blue.svg?style=flat-square)](package.json)

[**Features**](#-why-aethermind) • [**Quick Start**](#-quick-start) • [**CLI Reference**](#-cli-reference) • [**Web Dashboard**](#-the-graphical-gui) • [**API Docs**](#-rest--websocket-api) • [**Agent Integration**](#-ai-agent-integration)

</div>

---

## 🧭 Why AetherMind?

Autonomous AI coding agents (Antigravity, Claude Code, Cursor, Copilot, custom agentic loops) fail in predictable, frustrating ways during complex multi-step sessions:

```text
┌─────────────────────────────┐        ┌──────────────────────────────┐
│       NORMAL AI AGENT       │        │     AGENT WITH AETHERMIND    │
├─────────────────────────────┤        ├──────────────────────────────┤
│ ❌ Context Amnesia          │        │ ✅ Explicit Causal Ledger    │
│    (Forgets earlier steps)  │        │    (Hypothesis/Intervention) │
│                             │        │                              │
│ ❌ Tunnel Vision Edits      │  vs.   │ ✅ Pre-Execution Blast Radar │
│    (Breaks callers in other │        │    (AST dependency scan      │
│     files without knowing)  │        │     before touching code)    │
│                             │        │                              │
│ ❌ Ghost Assumptions        │        │ ✅ Empirical Reality Probes  │
│    (Assumes ports, runtimes │        │    (Validates OS ports, env, │
│     & schemas exist)        │        │     and syntax before acting)│
│                             │        │                              │
│ ❌ Circular Thrashing       │        │ ✅ Cognitive Drift Guard     │
│    (Loops in repeated edits)│        │    (Detects & breaks loops)  │
└─────────────────────────────┘        └──────────────────────────────┘
```

**AetherMind** acts as the AI's **blackbox flight recorder** and **reality engine**:
- It maintains a **causal hypothesis graph** across dozens of agent turns.
- It computes a **Pre-Execution Blast Radius** across your workspace before code is edited.
- It provides **empirical reality probes** to verify ground truth instead of hallucinating.
- It features a **futuristic cyber-glassmorphic GUI** and a **high-speed CLI**.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js `v18.0.0` or higher
- Works out-of-the-box on **macOS**, **Linux**, and **Windows**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sampepin86/aethermind.git
cd aethermind

# Install lightweight dependencies
npm install

# Link executable globally into your PATH
npm link
```

### 3. Launch the Real-Time Dashboard
```bash
# Launch GUI on the current project (default port: 4200)
aethermind ui

# Or launch targeting any specific project folder:
aethermind ui --dir "/path/to/your/project"
```
Open **[http://localhost:4200](http://localhost:4200)** in your browser.

---

## 🖥️ The Graphical GUI

The dashboard runs locally via high-speed WebSockets and HTML5 Canvas:

### Core Visual Panes:
1. **Interactive Neural Reasoning Graph**:
   - Canvas-rendered DAG showing causal connections between **Hypotheses** (cyan), **Interventions** (purple), **Observations** (emerald), and **Refutations** (ruby).
   - Animated glowing energy pulses streaming along causal edges.
   - Panning, zoom controls, and click-to-inspect drawers with confidence sliders.
2. **Pre-Execution Blast Radius Radar**:
   - Concentric orbital radar scanning exports, callers, and test suites.
   - Displays real-time risk classification (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and calculated impact index (`0–100%`).
3. **Ghost Assumption Matrix**:
   - Interactive checklist of unverified assumptions made by the agent.
   - One-click validation triggers that execute real-time reality checks.
4. **Cognitive Drift Gauge**:
   - Dynamic entropy meter tracking context decay and repetitive action loops.
   - Outputs instant remediation directives when thrashing is detected.

---

## ⚡ CLI Reference

AetherMind can be run directly from any terminal or subshell:

### 1. Pre-Execution Blast Radius Scan
Evaluate the downstream impact of changing a file or function before making edits:
```bash
aethermind blast <file-path> [symbol-name]

# Examples:
aethermind blast src/auth.js
aethermind blast backend/api.php getDbConnection
aethermind blast next-app/src/proxy.ts --dir "/path/to/project"
```

**Terminal Output Example:**
```text
  ⚡  A E T H E R M I N D  ⚡
  Autonomous Agent Epistemic Flight Recorder & Dynamic Reality Engine
  ──────────────────────────────────────────────────────────────────

  Scanning Blast Radius for: backend/config.php
  ──────────────────────────────────────────────────────────────────
  Risk Score:     46/100 [HIGH]
  Direct Callers: 3 files
  Test Suites:    1 files
  Files Scanned:  646 workspace code files

  Detected Exports (15):
    ↳ getDbConnection, logMessage, getConfig, authenticateUser...

  Direct Downstream Dependents:
    • backend/api.php [uses: getDbConnection]
    • backend/daemon.php [uses: logMessage]

  Coupled Test Suites:
    ✔ tests/auth.test.php

  Recommended Sanity Checks:
    $ npm test -- tests/auth.test.php
    $ git diff --stat backend/config.php
```

### 2. Epistemic Action Ledger
Log reasoning steps so neither you nor the agent lose context:
```bash
# Record an investigative premise
aethermind record hypothesis "H1: Memory leak in token cache" \
  --details "Unbounded Map retains expired session tokens under load"

# Record an implementation step
aethermind record intervention "I1: Replaced Map with atomic LRU cache" \
  --details "Added max: 5000 and ttl: 3600000ms"

# Record empirical evidence or benchmark results
aethermind record observation "O1: Memory flatlined at 42MB after 10,000 requests" \
  --details "Zero duplicate entries; P99 latency down 80%"
```

### 3. Empirical Reality Probes
Empirically test operating system and runtime assumptions:
```bash
# Verify if a port is in use or available
aethermind probe port 4200

# Validate syntax and AST integrity
aethermind probe syntax src/server.js

# Check environment variable existence
aethermind probe env DATABASE_URL

# Comprehensive system health scan (Node, Python, Git, Ports)
aethermind probe
```

### 4. Cognitive Drift Audit
Audit the current session for circular loops, context staleness, and unverified assumptions:
```bash
aethermind audit
```

**Audit Output Example:**
```text
  Cognitive Drift & Reality Coherence Audit:
  ──────────────────────────────────────────────────────────────────
  Status:       MODERATE_DRIFT (40/100)

  Detected Anomalies (1):
  [HIGH] 1 High-Risk Assumptions Unverified
    Crucial assumptions like "Redis is listening on port 6379" have not been proven against reality.

  Agent Directives:
    → Run automated verification for: "Redis is listening on port 6379"
```

### 5. Export Epistemic Post-Mortem Debrief
Generate a clean Markdown report of the session's entire causal tree and proof:
```bash
aethermind export session-debrief.md
```

### 6. Clean Session Telemetry
Reset the active telemetry state store for a fresh start:
```bash
aethermind clean
```

---

## 🌐 REST & WebSocket API

Any external agent or tool can interact with AetherMind via standard HTTP/JSON and WebSockets:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/state` | Returns full epistemic graph, metrics, and timeline |
| `POST` | `/api/node` | Creates a hypothesis, intervention, or observation node |
| `PATCH` | `/api/node/:id` | Updates node status (`active`, `confirmed`, `refuted`), confidence, or notes |
| `POST` | `/api/assumption` | Registers a new premise to verify |
| `POST` | `/api/assumption/:id/verify` | Records proof and marks an assumption verified |
| `GET` | `/api/blast?file=...&symbol=...` | Returns JSON dependency analysis and risk score |
| `GET` | `/api/drift` | Runs cognitive drift and loop detection audit |
| `POST` | `/api/probe` | Executes empirical probe (`port`, `syntax`, `env`, `exec`) |
| `POST` | `/api/demo` | Seeds a rich simulated agent reasoning trajectory |
| `POST` | `/api/reset` | Resets the telemetry store |
| `WS` | `ws://localhost:4200` | Real-time bidirectional WebSocket event stream |

---

## 🤖 AI Agent Integration

### Antigravity IDE (Gemini / Antigravity Agents)
AetherMind includes built-in support for Antigravity rules and skills.

1. **Global Rule** (`~/.gemini/config/GEMINI.md`):
```markdown
# Cognitive Architecture Protocol
Always use **AetherMind** (`aethermind`) as your epistemic flight recorder and reality engine:
- Run `aethermind blast <file> [symbol]` before modifying code to evaluate downstream impact.
- Track reasoning using `aethermind record hypothesis|intervention|observation`.
- Run `aethermind probe` to empirically verify assumptions (ports, syntax, env).
- Run `aethermind audit` when diagnosing failures or resolving repetitive loops.
```

2. **Global Skill** (`~/.gemini/config/skills/aethermind/SKILL.md`):
The skill is registered and can be loaded automatically by Antigravity agents on demand.

### Claude Code, Cursor, Copilot, or Custom Agents
Add this instruction to your project's `.cursorrules`, `CLAUDE.md`, or system prompt:
```markdown
Before modifying any multi-file code, run `aethermind blast <file>` to inspect dependent callers and test suites. Log your reasoning using `aethermind record hypothesis|intervention|observation`.
```

---

## 📂 Project Structure

```text
aethermind/
├── bin/
│   └── aethermind.js          # Cross-platform CLI executable
├── src/
│   ├── core/
│   │   ├── state-engine.js    # Epistemic state DAG, entropy calculator, and event ledger
│   │   ├── blast-radius.js    # AST dependency, exports, and caller impact analyzer
│   │   ├── reality-probe.js   # Hardened empirical OS verification (ports, syntax, env)
│   │   └── drift-detector.js  # Circular loop and context staleness detection engine
│   ├── server/
│   │   ├── app.js             # Express & WebSocket live telemetry server
│   │   └── routes.js          # REST API controller
│   └── public/                # Cyber-Glassmorphic GUI
│       ├── index.html         # Modern semantic dashboard interface
│       ├── styles.css         # Custom dark-theme glassmorphism design system
│       ├── app.js             # Frontend WebSocket controller & state binding
│       └── components/
│           ├── neural-graph.js # Interactive HTML5 Canvas causal reasoning DAG
│           └── blast-radar.js  # Orbital sonar radar visualizer
├── tests/
│   └── e2e-test.js            # Automated hermetic verification suite (18/18 tests)
├── package.json
└── README.md
```

---

## 🔒 Security & Privacy

- **100% Local**: All data, telemetry, and graphs remain strictly on your local machine in `.aethermind/`. Zero cloud calls or third-party tracking.
- **Zero Shell Interpolation**: All reality probes use `execFileSync` with argument arrays to prevent shell injection vulnerabilities.
- **Audited**: `0 vulnerabilities` reported by `npm audit`.

---

## 🧪 Running Automated Tests

```bash
npm test
```
Runs the hermetic 18-point verification suite testing static asset delivery, REST APIs, WebSocket broadcasts, blast radius algorithms, reality probes, and drift detection.

---

## 📄 License

MIT © [Samuel Pepin & Contributors](LICENSE)
