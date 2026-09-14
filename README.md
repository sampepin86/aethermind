# ⚡ AetherMind

> **Autonomous Agent Epistemic Flight Recorder & Dynamic Reality Engine**
> *The cognitive co-processor for AI coding agents and human supervisors.*

---

## 🧭 Why AetherMind Was Built

Autonomous AI coding agents frequently suffer from subtle cognitive degradation during extended multi-step tasks:
1. **Epistemic Context Drift & Amnesia**: The agent modifies files and runs shell commands across dozens of turns. Without an explicit causal hypothesis graph, it loses track of *why* an earlier fix was attempted or what evidence disproved it.
2. **Ghost Assumptions**: AI agents habitually rely on unproven premises (*"port 8080 is open"*, *"Python >= 3.11 is active"*, *"the database schema has migrated"*), only to crash multiple steps later.
3. **Blast Radius Blindspots**: Modifying code without immediate downstream AST and dependency impact maps leads to broken callers and test suite regressions.
4. **Thrashing Loops**: In tight error-correction loops, agents can enter repetitive edit-fail cycles without realizing they are thrashing on a false root premise.

**AetherMind** resolves these challenges by providing both a **fast CLI** and a **futuristic cyber-glassmorphic GUI** that acts as an epistemic flight recorder, reality probe matrix, and pre-execution blast radius scanner.

---

## 🚀 Key Capabilities

- **🧠 Interactive Epistemic Neural Graph**: Real-time Canvas visualization of Hypotheses, Interventions, and Observations linked with animated causal pulse edges.
- **🎯 Pre-Execution Blast Radius Simulator**: Concentric orbital radar scanning exports, direct callers, coupled test suites, and calculating impact risk scores (0–100%) before code is edited.
- **🔍 Ghost Assumption Radar & Reality Probes**: Live verification matrix with built-in empirical probes for network ports, AST syntax validation, environment variables, and shell assertions.
- **🛡️ Cognitive Drift Guard**: Algorithmic detector for repetitive action loops, context staleness (files changing underneath the agent's memory), and epistemic thrashing.
- **⚡ Dual Form Factor**: Full-featured CLI for subshells/agents and a real-time WebSocket web dashboard.

---

## 📦 Installation & Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/aethermind.git
cd aethermind
npm install
npm link
```

### 1. Launch the Graphical Dashboard
```bash
# Start the real-time UI server (default port: 4200)
node bin/aethermind.js ui

# Or load the full multi-stage agent demonstration flight:
node bin/aethermind.js demo
```
Open **[http://localhost:4200](http://localhost:4200)** in your browser.

---

## 🛠️ CLI Reference

### 1. Blast Radius Analysis
Scan code dependencies, direct callers, and coupled test suites before making a change:
```bash
node bin/aethermind.js blast <file-path> [symbol-name]

# Example:
node bin/aethermind.js blast sample-workspace/auth.js AuthService
```

### 2. Record Epistemic Actions
Log hypotheses, interventions, and observations directly from any terminal or agent prompt:
```bash
# Record a new hypothesis
node bin/aethermind.js record hypothesis "H1: Memory leak in token cache" --details "Unbounded Map retains tokens"

# Record an intervention
node bin/aethermind.js record intervention "Replace Map with LRU cache"

# Record an observation
node bin/aethermind.js record observation "RSS memory flatlined at 42MB under load"
```

### 3. Empirical Reality Probes
Run empirical reality checks to verify assumptions against the actual OS environment:
```bash
# Check if a port is available
node bin/aethermind.js probe port 4200

# Verify file syntax and AST validity
node bin/aethermind.js probe syntax sample-workspace/auth.js

# Check environment variable presence
node bin/aethermind.js probe env PATH

# Comprehensive system health scan
node bin/aethermind.js probe
```

### 4. Cognitive Drift Audit
Audit the active session for context staleness, unverified premises, and circular loops:
```bash
node bin/aethermind.js audit
```

### 5. Check Active Cognitive Status
```bash
node bin/aethermind.js status
```

---

## 🌐 REST & WebSocket API

Any AI agent or external process can interact with AetherMind via HTTP:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/state` | Returns full epistemic graph, metrics, and timeline |
| `POST` | `/api/node` | Creates a hypothesis, intervention, or observation |
| `PATCH` | `/api/node/:id` | Updates node status, confidence, or notes |
| `POST` | `/api/assumption` | Registers a new premise to verify |
| `POST` | `/api/assumption/:id/verify` | Records proof and marks an assumption as verified |
| `GET` | `/api/blast?file=...` | Returns blast radius impact analysis |
| `GET` | `/api/drift` | Runs cognitive drift and loop detection scan |
| `POST` | `/api/probe` | Executes an empirical check (`port`, `syntax`, `env`, `exec`) |
| `POST` | `/api/demo` | Seeds a rich simulated agent reasoning trajectory |
| `POST` | `/api/reset` | Resets the telemetry store |

---

## 📁 Architecture Overview

```text
aethermind/
├── bin/
│   └── aethermind.js           # CLI executable with rich terminal formatting
├── src/
│   ├── core/
│   │   ├── state-engine.js     # Epistemic state graph, entropy, and event store
│   │   ├── blast-radius.js     # Code dependency and blast radius analyzer
│   │   ├── reality-probe.js    # Empirical environment & assumption verification
│   │   └── drift-detector.js   # Cognitive drift & repetitive action loop detector
│   ├── server/
│   │   ├── app.js              # Express HTTP & WebSocket server
│   │   └── routes.js           # REST API endpoints
│   └── public/                 # Graphical Web GUI
│       ├── index.html          # Semantic HTML5 layout
│       ├── styles.css          # Cyber-glassmorphism dark design system
│       ├── app.js              # Frontend state, WebSocket client, inspector
│       └── components/
│           ├── neural-graph.js # Interactive HTML5 Canvas causal node graph
│           └── blast-radar.js  # Orbital circular radar scanner visualizer
└── sample-workspace/           # Sample code files for testing blast radius
```
