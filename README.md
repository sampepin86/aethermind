# ⚡ AetherMind

<div align="center">

**Autonomous Agent Epistemic Flight Recorder & Dynamic Reality Engine**  
*The cognitive co-processor that keeps AI coding agents grounded, regression-free, and accountable.*

[![Version](https://img.shields.io/badge/version-2.1.0-cyan.svg?style=flat-square)](https://github.com/sampepin86/aethermind)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-emerald.svg?style=flat-square)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-44%2F44%20passing-10b981.svg?style=flat-square)](tests/e2e-test.js)
[![MCP Compatible](https://img.shields.io/badge/MCP-13%20tools%20stdio-blue.svg?style=flat-square)](src/mcp/server.js)

[**Features**](#-why-aethermind) • [**Quick Start**](#-quick-start) • [**4-Gate Workflow**](#-agent-gates-the-4-stage-safety-pipeline) • [**Observability**](#-observability--regression-intelligence) • [**MCP Installer**](#-multi-ide-mcp-integration) • [**CLI Reference**](#-cli-reference) • [**Web Studio**](#-high-readability-web-studio) • [**REST API**](#-rest--websocket-api)

</div>

---

## 🧭 Why AetherMind?

Autonomous AI coding agents (*Google Antigravity, Claude Code, Cursor, Windsurf, custom agentic loops*) often fail in predictable ways during complex sessions:

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
│    (Loops in repeated edits)│        │    (Circuit-breaker stops it)│
│                             │        │                              │
│ ❌ Unchecked Regressions    │        │ ✅ 4-Gate Policy Pipeline    │
│    (Changes unintended code)│        │    (Blocks out-of-scope mods)│
└─────────────────────────────┘        └──────────────────────────────┘
```

**AetherMind** acts as the agent's **blackbox flight recorder** and **reality engine**:
- Maintains an explicit **causal hypothesis graph** across dozens of agent turns.
- Computes a **Pre-Execution Blast Radius** across your workspace before code is modified.
- Enforces a **4-Gate Safety Pipeline** (`preflight`, `edit-gate`, `test-gate`, `postflight`).
- Answers the **4 Core Observability Questions** regarding regressions and failure hotspots.
- Features a **spacious high-readability Web Studio** (7 views) and a **fast CLI**.
- Native **Model Context Protocol (MCP)** server with automated 1-click installer for Antigravity, Cursor, Windsurf, and Claude Desktop.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js `v18.0.0` or higher
- Git repository workspace
- macOS, Linux, or Windows

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

### 3. Launch the Real-Time Web Studio
```bash
# Launch GUI on the current project (default port: 4200)
aethermind ui

# Or target a specific project folder:
aethermind ui --dir "/path/to/project"
```
Open **[http://localhost:4200](http://localhost:4200)** in your browser.

---

## 🛡️ Agent Gates: The 4-Stage Safety Pipeline

Instead of relying on soft prompt instructions that agents can forget or skip, AetherMind enforces **4 programmatic gates** backed by [`policy-engine.js`](src/core/policy-engine.js):

```text
USER REQUEST ➔ PREFLIGHT ➔ BLAST SCAN ➔ EDIT-GATE ➔ CODE EDIT ➔ TEST-GATE ➔ POSTFLIGHT ➔ COMMIT
```

### 1. Preflight Gate (`aethermind gate pre <file> [--scope <paths>]`)
- Declares intent and allowed file scope boundaries.
- Captures a baseline Git working tree snapshot.
- Evaluates blast radius and verifies that no `CRITICAL` unproven assumptions exist.

### 2. Edit-Gate (`aethermind gate edit <file> [symbol]`)
- **Mandatory Pre-Edit Check**: Actively blocks modifications if blast radius analysis has not been conducted on the target file.
- **Strict Scope Enforcement**: Blocks modification if the file is outside the declared user scope.
- **Dependency Drift Guard**: Blocks modification of package managers and lockfiles (`package.json`, `pnpm-lock.yaml`, `composer.json`) without explicit permission.

```bash
$ aethermind gate edit src/core/state-engine.js

  EDIT GATE: [BLOCKED]
  ──────────────────────────────────────────────────────────────────
  Target File:    src/core/state-engine.js
  Decision:       Blast radius analysis has not been performed on 'src/core/state-engine.js'. Pre-edit scan mandatory.
  Required Steps: blast, reality_check
```

### 3. Test-Gate (`aethermind gate test [--tests <t1,t2>]`)
- Scans all modified files and identifies every directly and indirectly coupled test suite.
- Blocks or issues warnings if coupled test suites have not been executed.

### 4. Postflight Gate (`aethermind gate post [--tests <t>]`)
- Validates AST syntax integrity on all modified files to eliminate parsing errors.
- Verifies Git workspace delta against declared scope.
- Produces the itemized safety checklist:
  - *Diff inspected* ✓
  - *AST syntax valid* ✓
  - *Tests executed* ✓
  - *Unexpected files: 0* ✓
  - *Blast assumptions verified* ✓

---

## 📊 Observability & Regression Intelligence

Run `aethermind report` (or `aethermind report --md`) to answer the **4 critical agent reliability questions**:

```bash
$ aethermind report

  Observability & Regression Intelligence:
  ──────────────────────────────────────────────────────────────────
  Total Nodes:       18
  Verified Premises: 4 verified, 1 falsified
  Regressions:       1 detected

  1. Which modifications most often cause regressions?
    • #1: I1: Replaced Map with atomic LRU cache -> O2: Memory leak persisted under concurrency

  2. Which assumptions are most often wrong?
    • ❌ "Redis cluster is listening on 6379" [Proof: Connection refused at 127.0.0.1:6379]

  3. Which files are repeatedly problematic?
    • src/auth/token-store.js (3 failure events)

  4. Which tests catch the most errors?
    • tests/adversarial-test.js (caught 2 regressions)
```

Export markdown post-mortems via `aethermind export session-debrief.md` or download directly from the Web Studio.

---

## 🔌 Multi-IDE MCP Integration

AetherMind comes with a built-in automated installer for AI IDEs and editors that support the **Model Context Protocol (MCP)**:

### Check Integration Status
```bash
aethermind mcp status
# or
npm run mcp:status
```

```text
  MCP Server IDE Integration Status:
  ──────────────────────────────────────────────────────────────────
  Google Antigravity (AGY)       ✔ Installed          [Detected]
    ~/.gemini/config/mcp_config.json
  Cursor                         ✔ Installed          [Detected]
    ~/.cursor/mcp.json
  Windsurf (Codeium)             ✔ Installed          [Detected]
    ~/.codeium/windsurf/mcp_config.json
  Claude Desktop                 ○ Not configured     [Not found]
    ~/Library/Application Support/Claude/claude_desktop_config.json
  Project Local (.cursor/mcp.json) ✔ Installed        [Detected]
```

### 1-Command Automated Install
```bash
# Automatically configure all detected IDEs:
aethermind mcp install

# Or target a specific IDE:
aethermind mcp install --ide antigravity
aethermind mcp install --ide cursor
aethermind mcp install --ide windsurf
aethermind mcp install --ide claude
```

### 13 Native MCP Tools Exposed:
1. `aethermind_status`: Epistemic coherence metrics, active hypotheses, and unverified assumptions.
2. `aethermind_intent`: Declare user intent prompt and allowed modification scope.
3. `aethermind_preflight`: Pre-edit safety check (scope, blast radius, unverified premises).
4. `aethermind_gate_edit`: Strict edit-gate enforcing blast radius and policy rules.
5. `aethermind_gate_test`: Verify coupled test suite execution.
6. `aethermind_postflight`: Post-edit verification (AST syntax, diff stats, scope integrity).
7. `aethermind_blast`: Analyze downstream callers, transitive consumers, tests, and caveats.
8. `aethermind_probe`: Run sandboxed reality check and bind factual proof.
9. `aethermind_record`: Log hypothesis, intervention, or observation node.
10. `aethermind_diff`: Inspect colored git diff of uncommitted workspace changes.
11. `aethermind_git_delta`: Inspect working tree modifications vs scope.
12. `aethermind_audit`: Detect cognitive drift, loop thrashing, and context staleness.
13. `aethermind_report`: Generate observability & regression intelligence report.

---

## 🖥️ High-Readability Web Studio

Launch the studio:
```bash
aethermind ui
```
Open **[http://localhost:4200](http://localhost:4200)**.

### 7 Dedicated Full-Width Studios:
1. **🛰️ Cockpit & Telemetry Overview**:
   - High-contrast KPI cards (Epistemic Coherence, Entropy, Active Hypotheses, Gate Status).
   - Live cognitive flight feed with action thrashing circuit-breaker (`STOP EDITING`).
2. **🧠 Epistemic Reasoning Graph**:
   - High-readability **260×86px** cards with bold titles and multi-line descriptions.
   - Interactive search, zoom/pan controls, and deep-dive node inspector drawer.
3. **🛡️ Agent Gate & Scope Studio**:
   - Interactive runners for all 4 gates (Preflight, Edit-Gate, Test-Gate, Postflight).
   - Side-by-side Git Delta guardian with green "Expected" and red "UNEXPECTED!" alerts.
   - **MCP IDE Integration card** with 1-click `⚡ Auto-Install to IDEs` button.
4. **💥 Blast Radius & Radar**:
   - Interactive dependency sonar radar (360×240px).
   - Detection of dynamic imports (`import()`), dynamic `require()`, `eval()`, and reflection.
   - Direct and transitive downstream callers + coupled test suites.
5. **🔬 Reality Probes Workbench**:
   - Test OS & runtime state (Ports, AST Syntax, Binary PATH, Env vars, Sandboxed Shell).
   - Direct binding of reality probe output into factual memory (`ASSUMPTION -> PROBE -> CONFIRMED`).
6. **📋 Flight Ledger & Debrief**:
   - Filterable assumptions table (All / Pending / Verified / High-Risk).
   - Chronological action timeline and one-click markdown session export.
7. **📊 Regression & Observability Studio**:
   - Direct visual answers to the 4 core reliability questions.
   - Instant Markdown report download.

---

## ⚡ CLI Reference

| Command | Description |
|---|---|
| `aethermind ui [--port <p>]` | Launch High-Readability Web Studio (default: 4200) |
| `aethermind gate pre <file> [scope]` | Enforce Preflight Gate before code edit |
| `aethermind gate edit <file> [sym]` | Enforce Edit Gate with policy rules |
| `aethermind gate test [tests]` | Enforce Test Gate on coupled test suites |
| `aethermind gate post [--tests <t>]` | Enforce Postflight Gate after modifications |
| `aethermind diff` | Inspect colored git diff of uncommitted changes |
| `aethermind delta` | Inspect working tree delta & scope validation |
| `aethermind report [--md]` | Observability & regression intelligence report |
| `aethermind intent "<prompt>" [scope]` | Declare explicit user intent & allowed scope |
| `aethermind blast <file> [sym]` | Scan blast radius, dynamic caveats & risk score |
| `aethermind record <type> <title>` | Log hypothesis, intervention, or observation node |
| `aethermind probe [check] [target]` | Run safe reality check & bind proof |
| `aethermind audit` | Audit cognitive drift & action thrashing loops |
| `aethermind mcp install [--ide <name>]` | Auto-install MCP to Antigravity, Cursor, Windsurf, Claude |
| `aethermind mcp status` | Inspect MCP integration status across IDEs |
| `aethermind mcp` | Run stdio Model Context Protocol (MCP) server |
| `aethermind export [file.md]` | Export markdown session debrief |
| `aethermind clean` | Reset telemetry session data |
| `aethermind demo` | Load synthetic multi-stage flight trajectory & launch UI |

---

## 🌐 REST & WebSocket API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/state` | Returns full epistemic graph, metrics, and timeline |
| `POST` | `/api/node` | Creates a hypothesis, intervention, or observation node |
| `PATCH` | `/api/node/:id` | Updates node status (`active`, `confirmed`, `refuted`), confidence, or notes |
| `POST` | `/api/assumption` | Registers a new premise to verify |
| `POST` | `/api/assumption/:id/verify` | Records proof and marks an assumption verified |
| `GET` | `/api/blast?file=...&symbol=...` | Returns JSON dependency analysis, caveats, and risk score |
| `GET` | `/api/drift` | Runs cognitive drift and loop detection audit |
| `POST` | `/api/probe` | Executes empirical probe (`port`, `syntax`, `command`, `env`, `exec`) |
| `POST` | `/api/gate/preflight` | Evaluates preflight gate check |
| `POST` | `/api/gate/edit` | Evaluates edit-gate with policy engine |
| `POST` | `/api/gate/test` | Evaluates test-gate on coupled test suites |
| `POST` | `/api/gate/postflight` | Evaluates postflight verification |
| `GET` | `/api/git/delta` | Live working tree changes vs declared scope |
| `GET` | `/api/git/diff` | Returns raw working tree diff |
| `GET` | `/api/report` | Returns JSON observability & regression report |
| `GET` | `/api/report/markdown` | Returns Markdown formatted regression report |
| `GET` | `/api/mcp/status` | Returns MCP integration status across IDEs |
| `POST` | `/api/mcp/install` | Auto-installs MCP configuration into IDEs |
| `POST` | `/api/mcp/uninstall` | Removes MCP configuration from IDEs |
| `WS` | `ws://localhost:4200` | Real-time bidirectional WebSocket event stream |

---

## 📂 Project Structure

```text
aethermind/
├── bin/
│   ├── aethermind.js          # Cross-platform CLI executable
│   └── aethermind-mcp.js      # Stdio Model Context Protocol (MCP) server binary
├── src/
│   ├── core/
│   │   ├── state-engine.js    # Epistemic DAG, multi-agent attribution & telemetry
│   │   ├── blast-radius.js    # Canonical path resolution, re-exports & caveats
│   │   ├── reality-probe.js   # Hardened empirical OS verification (ports, syntax, env)
│   │   ├── drift-detector.js  # Circular loop & action thrashing circuit-breaker
│   │   ├── git-observer.js    # Working tree status, diff inspection & delta calculation
│   │   ├── intent-engine.js   # User scope boundary & dependency drift protection
│   │   ├── policy-engine.js   # Gate policy rules (strictScope, blastRequirement)
│   │   ├── agent-gate.js      # The 4-gate verification engine (pre, edit, test, post)
│   │   └── regression-reporter.js # Answers the 4 observability & regression questions
│   ├── mcp/
│   │   ├── server.js          # Stdio JSON-RPC 2.0 MCP server (13 tools)
│   │   └── installer.js       # Multi-IDE automated MCP configuration engine
│   ├── server/
│   │   ├── app.js             # Express & WebSocket live telemetry server
│   │   └── routes.js          # REST API controller with full gate & report routes
│   └── public/                # High-Readability Cyber-Glassmorphic GUI
│       ├── index.html         # Semantic 7-view studio interface
│       ├── styles.css         # Dark-mode design system with 14px base font
│       ├── app.js             # Frontend WebSocket controller & state binding
│       └── components/
│           ├── neural-graph.js # Interactive HTML5 Canvas causal reasoning DAG
│           └── blast-radar.js  # Orbital sonar radar visualizer
├── tests/
│   ├── e2e-test.js            # End-to-end system verification (28 tests)
│   ├── adversarial-test.js    # Security & boundary guards test suite (7 tests)
│   └── blast-matrix-test.js   # False-positive/negative & circular deps suite (9 tests)
├── package.json
└── README.md
```

---

## 🧪 Automated Test Verification

AetherMind is verified by **44 automated tests** across 3 test suites:

```bash
npm test
```

```text
⚡ AETHERMIND AUTOMATED SYSTEM & E2E VERIFICATION ⚡
  ✔ ALL SYSTEMS NOMINAL: 28 PASSED / 28 TOTAL

⚡ AETHERMIND ADVERSARIAL & SAFETY MATRIX VERIFICATION ⚡
  ✔ ALL ADVERSARIAL & SAFETY GUARDS VERIFIED: 7 PASSED / 7 TOTAL

🧪 Running AetherMind Adversarial & Blast-Matrix Test Suite...
  ✔ ALL 9 ADVERSARIAL BLAST-MATRIX TESTS PASSED: 9 PASSED / 9 TOTAL

──────────────────────────────────────────────────────────────────
  Test Results: 44 PASSED / 44 TOTAL (100% Success Rate)
```

---

## 🔒 Security & Privacy

- **100% Local-First**: All telemetry and epistemic graphs remain strictly in `.aethermind/`. Zero cloud calls or tracking.
- **Safe Command Sandboxing**: Reality probes use `execFileSync` with argument arrays and a strict command allowlist. Chained shell commands (`|`, `;`, `&&`) are blocked.
- **Secret Redaction**: Environment variable probes automatically redact sensitive tokens (`KEY`, `SECRET`, `PASSWORD`, `TOKEN`).
- **Audited**: `0 vulnerabilities` via `npm audit`.

---

## 📄 License

MIT © [Samuel Pepin & Contributors](LICENSE)
