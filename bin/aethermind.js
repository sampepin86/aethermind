#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const createAppServer = require('../src/server/app');
const BlastRadiusAnalyzer = require('../src/core/blast-radius');
const RealityProbeMatrix = require('../src/core/reality-probe');
const CognitiveDriftDetector = require('../src/core/drift-detector');
const EpistemicStateEngine = require('../src/core/state-engine');
const GitObserver = require('../src/core/git-observer');
const UserIntentEngine = require('../src/core/intent-engine');
const AgentGate = require('../src/core/agent-gate');
const RegressionReporter = require('../src/core/regression-reporter');
const AetherMindMcpServer = require('../src/mcp/server');
const McpInstaller = require('../src/mcp/installer');
const { loadDemoSimulation } = require('../src/server/routes');

// ANSI Color Helpers
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function banner() {
  console.log(`
${c.cyan}${c.bright}  ⚡  A E T H E R M I N D  ⚡${c.reset}
${c.gray}  Autonomous Agent Epistemic Flight Recorder & Dynamic Reality Engine${c.reset}
${c.gray}  ──────────────────────────────────────────────────────────────────${c.reset}`);
}

// Extract flags
const rawArgs = process.argv.slice(2);
let workspaceDir = process.cwd();
const dirIdx = rawArgs.findIndex(a => a === '--dir' || a === '-d');
if (dirIdx !== -1 && rawArgs[dirIdx + 1]) {
  workspaceDir = path.resolve(rawArgs[dirIdx + 1]);
}

// Filter out --dir and --port flags for positional command parsing
const args = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--dir' || rawArgs[i] === '-d' || rawArgs[i] === '--port') {
    i++; // skip flag value
    continue;
  }
  args.push(rawArgs[i]);
}

const command = args[0] || 'status';

async function main() {
  switch (command) {
    case 'clean':
    case 'reset': {
      banner();
      const engine = new EpistemicStateEngine(workspaceDir);
      engine.reset();
      console.log(`\n  ${c.green}✔ Telemetry session cleaned and reset for:${c.reset} ${c.bright}${c.cyan}${workspaceDir}${c.reset}\n`);
      break;
    }

    case 'ui':
    case 'serve': {
      banner();
      let port = 4200;
      const portIdx = rawArgs.indexOf('--port');
      if (portIdx !== -1 && rawArgs[portIdx + 1]) {
        port = parseInt(rawArgs[portIdx + 1], 10);
      }
      console.log(`  ${c.gray}Target Project:${c.reset} ${c.bright}${c.cyan}${workspaceDir}${c.reset}`);
      const { server } = createAppServer(workspaceDir, port);
      server.listen(port, () => {
        console.log(`\n  ${c.green}✔ Dashboard running locally at:${c.reset} ${c.bright}${c.cyan}http://localhost:${port}${c.reset}`);
        console.log(`  ${c.gray}• Epistemic state store:${c.reset} ${path.join(workspaceDir, '.aethermind/telemetry.json')}`);
        console.log(`  ${c.gray}• Press Ctrl+C to terminate the dashboard server.${c.reset}\n`);
      });
      break;
    }

    case 'blast': {
      banner();
      const targetFile = args[1];
      const targetSymbol = args[2] || null;

      if (!targetFile) {
        console.log(`\n  ${c.red}Error:${c.reset} Please specify a target file to analyze.`);
        console.log(`  Usage: ${c.yellow}aethermind blast <file-path> [symbol-name]${c.reset}\n`);
        process.exit(1);
      }

      console.log(`\n  ${c.bright}Scanning Blast Radius for:${c.reset} ${c.cyan}${targetFile}${c.reset}${targetSymbol ? ` (symbol: ${c.yellow}${targetSymbol}${c.reset})` : ''}`);
      const analyzer = new BlastRadiusAnalyzer(workspaceDir);
      const result = analyzer.analyze(targetFile, targetSymbol);

      const riskColor = result.metrics.riskLevel === 'CRITICAL' ? c.red : (result.metrics.riskLevel === 'HIGH' ? c.yellow : c.green);
      console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
      console.log(`  Risk Score:   ${riskColor}${result.metrics.riskScore}/100 [${result.metrics.riskLevel}]${c.reset}`);
      console.log(`  Direct Callers: ${c.bright}${result.metrics.directConsumersCount}${c.reset} files`);
      console.log(`  Test Suites:    ${c.bright}${result.metrics.testSuitesCount}${c.reset} files`);
      console.log(`  Files Scanned:  ${c.gray}${result.metrics.totalWorkspaceFilesScanned} workspace code files${c.reset}`);

      if (result.target.detectedExports.length > 0) {
        console.log(`\n  ${c.bright}Detected Exports:${c.reset}`);
        result.target.detectedExports.forEach(exp => console.log(`    ${c.blue}↳ ${exp}${c.reset}`));
      }

      if (result.directConsumers.length > 0) {
        console.log(`\n  ${c.bright}Direct Downstream Dependents:${c.reset}`);
        result.directConsumers.forEach(cons => {
          console.log(`    ${c.yellow}• ${cons.file}${c.reset} ${cons.symbolsFound.length > 0 ? c.gray + `[uses: ${cons.symbolsFound.join(', ')}]` + c.reset : ''}`);
        });
      }

      if (result.testSuites.length > 0) {
        console.log(`\n  ${c.bright}Coupled Test Suites:${c.reset}`);
        result.testSuites.forEach(t => console.log(`    ${c.green}✔ ${t.file}${c.reset}`));
      }

      console.log(`\n  ${c.bright}Recommended Sanity Checks:${c.reset}`);
      result.recommendedVerificationCommands.forEach(cmd => console.log(`    ${c.cyan}$ ${cmd}${c.reset}`));
      console.log('');
      break;
    }

    case 'record': {
      banner();
      const type = args[1]; // 'hypothesis' | 'intervention' | 'observation'
      const title = args[2];

      if (!type || !title) {
        console.log(`\n  ${c.red}Error:${c.reset} Invalid arguments.`);
        console.log(`  Usage: ${c.yellow}aethermind record <hypothesis|intervention|observation> "<title>" [--details "..."]${c.reset}\n`);
        process.exit(1);
      }

      const engine = new EpistemicStateEngine(workspaceDir);
      let details = '';
      const detailsIdx = args.indexOf('--details');
      if (detailsIdx !== -1 && args[detailsIdx + 1]) {
        details = args[detailsIdx + 1];
      }

      const node = engine.addNode({ type, title, details });
      console.log(`\n  ${c.green}✔ Recorded ${type.toUpperCase()}:${c.reset} ${c.bright}${node.title}${c.reset}`);
      console.log(`  ${c.gray}Node ID: ${node.id} | Timestamp: ${node.timestamp}${c.reset}\n`);
      break;
    }

    case 'probe': {
      banner();
      const checkType = args[1]; // port, syntax, command, env, health
      const target = args[2];

      if (checkType === 'port' && target) {
        const res = await RealityProbeMatrix.checkPort(parseInt(target, 10));
        console.log(`\n  ${res.passed ? c.green + '✔ PASSED' : c.red + '✘ BLOCKED'}: ${res.message}${c.reset}\n`);
      } else if (checkType === 'syntax' && target) {
        const res = RealityProbeMatrix.checkSyntax(path.resolve(workspaceDir, target));
        console.log(`\n  ${res.passed ? c.green + '✔ PASSED' : c.red + '✘ FAILED'}: ${res.message}${c.reset}\n`);
      } else if (checkType === 'command' && target) {
        const res = RealityProbeMatrix.checkCommand(target);
        console.log(`\n  ${res.passed ? c.green + '✔ PASSED' : c.red + '✘ FAILED'}: ${res.message}${c.reset}\n`);
      } else if (checkType === 'env' && target) {
        const res = RealityProbeMatrix.checkEnvVar(target);
        console.log(`\n  ${res.passed ? c.green + '✔ FOUND' : c.red + '✘ MISSING'}: ${res.message}${c.reset}\n`);
      } else {
        console.log(`\n  ${c.bright}Running Comprehensive System Health Probe...${c.reset}`);
        const health = await RealityProbeMatrix.runSystemHealthCheck(workspaceDir);
        console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(`  Node Runtime:     ${health.node.passed ? c.green + '✔ Available' : c.red + '✘ Missing'}${c.reset} (${health.node.path || 'N/A'})`);
        console.log(`  Python Runtime:   ${health.python.passed ? c.green + '✔ Available' : c.red + '✘ Missing'}${c.reset} (${health.python.path || 'N/A'})`);
        console.log(`  Git Repository:   ${health.gitStatus.passed ? c.green + '✔ Inside Worktree' : c.yellow + '⚠ Not a Git Repo'}${c.reset}`);
        console.log(`  UI Port 4200:     ${health.port4200.passed ? c.green + '✔ Port Free' : c.yellow + '⚠ Port Occupied'}${c.reset}`);
        console.log('');
      }
      break;
    }

    case 'audit': {
      banner();
      const engine = new EpistemicStateEngine(workspaceDir);
      const detector = new CognitiveDriftDetector(engine);
      const report = detector.detect();

      const statusColor = report.driftStatus === 'NOMINAL_COHERENCE' ? c.green : (report.driftStatus === 'MODERATE_DRIFT' ? c.yellow : c.red);
      console.log(`\n  ${c.bright}Cognitive Drift & Reality Coherence Audit:${c.reset}`);
      console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
      console.log(`  Status:       ${statusColor}${c.bright}${report.driftStatus}${c.reset}`);
      console.log(`  Drift Index:  ${statusColor}${report.driftIndex}/100${c.reset}`);

      if (report.anomalies.length === 0) {
        console.log(`\n  ${c.green}✔ No epistemic drift or repetitive loops detected.${c.reset}`);
      } else {
        console.log(`\n  ${c.bright}Detected Anomalies (${report.anomalies.length}):${c.reset}`);
        report.anomalies.forEach((a, i) => {
          const col = a.severity === 'CRITICAL' ? c.red : (a.severity === 'HIGH' ? c.yellow : c.cyan);
          console.log(`  ${col}[${a.severity}] ${a.title}${c.reset}`);
          console.log(`    ${c.gray}${a.description}${c.reset}`);
        });
      }

      if (report.recommendations.length > 0) {
        console.log(`\n  ${c.bright}Agent Directives:${c.reset}`);
        report.recommendations.forEach(r => console.log(`    ${c.cyan}→ ${r}${c.reset}`));
      }
      console.log('');
      break;
    }

    case 'export': {
      banner();
      const engine = new EpistemicStateEngine(workspaceDir);
      const state = engine.getState();
      const detector = new CognitiveDriftDetector(engine);
      const drift = detector.detect();

      const outFile = args[1] || 'debrief.md';
      const outPath = path.resolve(workspaceDir, outFile);

      let md = `# ⚡ AetherMind Epistemic Session Debrief\n\n`;
      md += `**Session ID:** \`${state.session.id}\`  \n`;
      md += `**Generated:** ${new Date().toISOString()}  \n`;
      md += `**Coherence Index:** ${state.metrics.coherenceIndex}% | **Entropy:** ${state.metrics.entropyScore}/100 | **Drift Status:** \`${drift.driftStatus}\`\n\n`;

      md += `## 🧠 Causal Reasoning Trajectory\n\n`;
      state.nodes.forEach(n => {
        const icon = n.type === 'hypothesis' ? '💡' : (n.type === 'intervention' ? '⚡' : '👁');
        md += `### ${icon} [${n.type.toUpperCase()}] ${n.title}\n`;
        md += `- **Status:** \`${n.status}\` | **Confidence:** ${Math.round((n.confidence || 0.8) * 100)}%\n`;
        md += `- **Timestamp:** ${n.timestamp}\n`;
        if (n.details) md += `- **Rationale:** ${n.details}\n`;
        md += `\n`;
      });

      md += `## 🔍 Verified Assumptions Matrix\n\n`;
      state.assumptions.forEach(a => {
        md += `- [${a.verified ? 'x' : ' '}] **${a.premise}** (\`${a.riskLevel} RISK\`, category: *${a.category}*)\n`;
        if (a.proof) md += `  - *Proof:* ${a.proof}\n`;
      });
      md += `\n`;

      md += `## 🛡️ Cognitive Drift Directives\n\n`;
      if (drift.recommendations.length === 0) {
        md += `*No active epistemic drift warnings. Workspace operations nominal.*\n\n`;
      } else {
        drift.recommendations.forEach(r => md += `- ⚠️ ${r}\n`);
        md += `\n`;
      }

      fs.writeFileSync(outPath, md, 'utf8');
      console.log(`\n  ${c.green}✔ Epistemic debrief written to:${c.reset} ${c.bright}${outFile}${c.reset}\n`);
      break;
    }

    case 'intent': {
      banner();
      const promptText = args[1] || '';
      let scope = [];
      const scopeIdx = args.indexOf('--scope');
      if (scopeIdx !== -1 && args[scopeIdx + 1]) {
        scope = args[scopeIdx + 1].split(',').map(s => s.trim());
      }
      const engine = new EpistemicStateEngine(workspaceDir);
      const intentEngine = new UserIntentEngine(workspaceDir);
      const intent = intentEngine.declareIntent({
        prompt: promptText,
        scope,
        dependenciesAllowed: args.includes('--allow-deps'),
        testsAllowed: !args.includes('--no-tests')
      });
      engine.setIntent(intent);
      console.log(`\n  ${c.green}✔ Declared User Scope Intent:${c.reset}`);
      console.log(`  Scope files:  ${c.bright}${c.cyan}[${intent.scope.join(', ')}]${c.reset}`);
      console.log(`  Prompt:       ${c.gray}"${intent.prompt}"${c.reset}\n`);
      break;
    }

    case 'preflight':
    case 'gate': {
      banner();
      const sub = args[1]; // 'pre' | 'edit' | 'test' | 'post'
      const targetFile = (sub === 'pre' || sub === 'edit' || sub === 'post') ? args[2] : args[1];

      const engine = new EpistemicStateEngine(workspaceDir);
      const intentEngine = new UserIntentEngine(workspaceDir);
      const gate = new AgentGate(engine, workspaceDir, intentEngine);

      if (sub === 'edit') {
        if (!targetFile) {
          console.log(`\n  ${c.red}Error:${c.reset} Specify target file for edit-gate.`);
          console.log(`  Usage: ${c.yellow}aethermind gate edit <file> [symbol]${c.reset}\n`);
          process.exit(1);
        }
        const symbol = args[3] || null;
        const report = gate.evaluateEditGate({ file: targetFile, symbol });
        const col = report.allowed ? c.green : c.red;
        console.log(`\n  ${col}${c.bright}EDIT GATE: [${report.allowed ? 'ALLOWED' : 'BLOCKED'}]${c.reset}`);
        console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(`  Target File:    ${c.bright}${targetFile}${c.reset}`);
        console.log(`  Decision:       ${col}${report.message || (report.allowed ? 'Approved for modification' : 'Blocked by policy')}${c.reset}`);
        if (!report.allowed && report.required) {
          console.log(`  Required Steps: ${c.yellow}${report.required.join(', ')}${c.reset}`);
        }
        if (report.warnings && report.warnings.length > 0) {
          report.warnings.forEach(w => console.log(`  ${c.yellow}⚠ [${w.policy}]: ${w.message}${c.reset}`));
        }
        console.log('');
        if (!report.allowed) process.exit(1);
        break;
      }

      if (sub === 'test') {
        const testsIdx = args.indexOf('--tests');
        let executedTests = [];
        if (testsIdx !== -1 && args[testsIdx + 1]) {
          executedTests = args[testsIdx + 1].split(',').map(t => t.trim());
        } else if (args.slice(2).length > 0 && !args[2].startsWith('-')) {
          executedTests = args.slice(2);
        }

        const report = gate.evaluateTestGate({ executedTests });
        const col = report.passed ? c.green : (report.allowed ? c.yellow : c.red);
        console.log(`\n  ${col}${c.bright}TEST GATE: [${report.status}]${c.reset}`);
        console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(`  Coupled Tests:  ${report.coupledCount} test suites`);
        console.log(`  Executed Tests: ${report.executedCount} test suites`);
        console.log(`  Status:         ${col}${report.message}${c.reset}`);
        if (report.missingTests && report.missingTests.length > 0) {
          console.log(`\n  ${c.yellow}${c.bright}Missing Coupled Tests:${c.reset}`);
          report.missingTests.forEach(t => console.log(`    ${c.yellow}• ${t}${c.reset}`));
        }
        console.log('');
        if (!report.allowed) process.exit(1);
        break;
      }

      if (sub === 'post' || command === 'postflight') {
        const testsIdx = args.indexOf('--tests');
        const executedTests = (testsIdx !== -1 && args[testsIdx + 1])
          ? args[testsIdx + 1].split(',').map(t => t.trim())
          : [];

        const report = gate.evaluatePostflight({ executedTests });
        const col = report.allowed ? c.green : c.red;
        console.log(`\n  ${col}${c.bright}POSTFLIGHT GATE: [${report.status}]${c.reset}`);
        console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(`  Modified Files: ${report.actualModifiedFiles.length}`);
        report.checks.forEach(chk => {
          console.log(`  ${chk.passed ? c.green + '✔' : c.red + '✘'} [${chk.name}]: ${chk.message}${c.reset}`);
        });
        if (report.violations.length > 0) {
          console.log(`\n  ${c.red}${c.bright}Violations (${report.violations.length}):${c.reset}`);
          report.violations.forEach(v => console.log(`    ${c.red}• ${v}${c.reset}`));
        }
        if (report.recommendations.length > 0) {
          console.log(`\n  ${c.yellow}Recommendations:${c.reset}`);
          report.recommendations.forEach(r => console.log(`    ${c.yellow}→ ${r}${c.reset}`));
        }
        console.log('');
        if (!report.allowed) process.exit(1);
        break;
      }

      // Default: Preflight Gate
      if (!targetFile) {
        console.log(`\n  ${c.red}Error:${c.reset} Specify target file(s) for preflight gate.`);
        console.log(`  Usage: ${c.yellow}aethermind gate pre <file> [--scope file1,file2]${c.reset}\n`);
        process.exit(1);
      }

      let scope = [targetFile];
      const scopeIdx = args.indexOf('--scope');
      if (scopeIdx !== -1 && args[scopeIdx + 1]) {
        scope = args[scopeIdx + 1].split(',').map(s => s.trim());
      }

      const report = gate.evaluatePreflight({
        targetFiles: [targetFile],
        scope
      });

      const col = report.allowed ? c.green : c.red;
      console.log(`\n  ${col}${c.bright}PREFLIGHT GATE: [${report.status}]${c.reset}`);
      console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
      console.log(`  Target File:    ${c.bright}${targetFile}${c.reset}`);
      console.log(`  Blast Risk:     ${report.highestRiskScore}/100 [${report.highestRiskLevel}]`);
      console.log(`  Gate Decision:  ${report.allowed ? c.green + 'ALLOWED TO PROCEED' : c.red + 'BLOCKED'}${c.reset}\n`);

      report.checks.forEach(chk => {
        console.log(`  ${chk.passed ? c.green + '✔' : c.red + '✘'} [${chk.name}]: ${chk.message}${c.reset}`);
      });

      if (report.requiredActions.length > 0) {
        console.log(`\n  ${c.yellow}${c.bright}Mandatory Gate Requirements:${c.reset}`);
        report.requiredActions.forEach(a => console.log(`    ${c.yellow}• ${a}${c.reset}`));
      }
      console.log('');
      if (!report.allowed) process.exit(1);
      break;
    }

    case 'diff': {
      banner();
      const observer = new GitObserver(workspaceDir);
      const diffStat = observer.getDiffStat();
      const diffRaw = observer.getWorkingTreeDiff();
      console.log(`\n  ${c.bright}Workspace Git Diff Inspector:${c.reset}`);
      console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
      console.log(`  Files Changed: ${diffStat.filesChanged} | +${c.green}${diffStat.insertions}${c.reset} / -${c.red}${diffStat.deletions}${c.reset} lines\n`);
      if (diffRaw.diff) {
        // Output diff with basic coloring
        diffRaw.diff.split('\n').forEach(line => {
          if (line.startsWith('+') && !line.startsWith('+++')) console.log(c.green + line + c.reset);
          else if (line.startsWith('-') && !line.startsWith('---')) console.log(c.red + line + c.reset);
          else if (line.startsWith('@@')) console.log(c.cyan + line + c.reset);
          else console.log(c.gray + line + c.reset);
        });
      } else {
        console.log(`  ${c.green}✔ Clean working tree. No uncommitted modifications.${c.reset}`);
      }
      console.log('');
      break;
    }

    case 'report':
    case 'analytics': {
      banner();
      const engine = new EpistemicStateEngine(workspaceDir);
      const reporter = new RegressionReporter(engine);
      if (args.includes('--md') || args.includes('--markdown')) {
        console.log(reporter.generateMarkdown());
      } else {
        const rep = reporter.generateReport();
        console.log(`\n  ${c.bright}Observability & Regression Intelligence:${c.reset}`);
        console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(`  Total Nodes:      ${rep.metrics.totalNodes}`);
        console.log(`  Verified Premises:${c.green} ${rep.metrics.verifiedCount}${c.reset} verified, ${c.red}${rep.metrics.falseAssumptionsCount} falsified${c.reset}`);
        console.log(`  Regressions:      ${rep.metrics.regressionsCount === 0 ? c.green + '0 (nominal)' : c.red + rep.metrics.regressionsCount + ' detected'}${c.reset}`);

        console.log(`\n  ${c.bright}1. Which modifications most often cause regressions?${c.reset}`);
        if (rep.regressions.length === 0) {
          console.log(`    ${c.green}✔ No code modifications have caused detected regressions.${c.reset}`);
        } else {
          rep.regressions.forEach((r, i) => console.log(`    ${c.red}• #${i+1}: ${r.interventionTitle} -> ${r.observationTitle}${c.reset}`));
        }

        console.log(`\n  ${c.bright}2. Which assumptions are most often wrong?${c.reset}`);
        if (rep.falseAssumptions.length === 0) {
          console.log(`    ${c.green}✔ No verified premises have been refuted.${c.reset}`);
        } else {
          rep.falseAssumptions.forEach(a => console.log(`    ${c.red}• "${a.premise}" [Proof: ${a.proof}]${c.reset}`));
        }

        console.log(`\n  ${c.bright}3. Which files are repeatedly problematic?${c.reset}`);
        if (rep.problematicFiles.length === 0) {
          console.log(`    ${c.green}✔ No files have recorded repetitive failure events.${c.reset}`);
        } else {
          rep.problematicFiles.forEach(f => console.log(`    ${c.yellow}• ${f.file} (${f.failureCount} failures)${c.reset}`));
        }

        console.log(`\n  ${c.bright}4. Which tests catch the most errors?${c.reset}`);
        if (rep.topDefensiveTests.length === 0) {
          console.log(`    ${c.green}✔ All test executions passing without defensive intercepts.${c.reset}`);
        } else {
          rep.topDefensiveTests.forEach(t => console.log(`    ${c.cyan}• ${t.testSuite} (caught ${t.catchCount} regressions)${c.reset}`));
        }
        console.log('');
      }
      break;
    }

    case 'delta': {
      banner();
      const observer = new GitObserver(workspaceDir);
      const delta = observer.computeDelta();
      console.log(`\n  ${c.bright}Workspace Git Delta Inspector:${c.reset}`);
      console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
      console.log(`  Head Commit:    ${c.cyan}${observer.getHeadCommit() || 'N/A'}${c.reset}`);
      console.log(`  Modified Files: ${delta.totalCurrentChanges}`);
      if (delta.diffStat.stat) {
        console.log(`\n  ${c.gray}${delta.diffStat.stat}${c.reset}`);
      }
      if (delta.rawFiles.length > 0) {
        console.log(`\n  ${c.bright}Modified Files List:${c.reset}`);
        delta.rawFiles.forEach(f => {
          console.log(`    ${c.yellow}• [${f.statusText}] ${f.file}${c.reset}`);
        });
      } else {
        console.log(`\n  ${c.green}✔ Working tree clean. No active deltas.${c.reset}`);
      }
      console.log('');
      break;
    }

    case 'mcp': {
      const sub = args[1]; // 'install' | 'status' | 'uninstall' | undefined

      if (sub === 'install') {
        banner();
        const installer = new McpInstaller(workspaceDir);
        let targetIde = 'all';
        const ideIdx = args.indexOf('--ide');
        if (ideIdx !== -1 && args[ideIdx + 1]) {
          targetIde = args[ideIdx + 1].toLowerCase();
        }

        console.log(`\n  ${c.bright}Installing AetherMind MCP Server to AI IDEs...${c.reset}`);
        console.log(`  Target Workspace: ${c.cyan}${workspaceDir}${c.reset}`);
        console.log(`  Node Executable:  ${c.gray}${process.execPath}${c.reset}\n`);

        const res = installer.install(targetIde);
        if (res.results) {
          res.results.forEach(r => {
            if (r.success) {
              console.log(`  ${c.green}✔ Installed to ${r.name}${c.reset}`);
              console.log(`    ${c.gray}Config: ${r.configPath}${c.reset}`);
            } else {
              console.log(`  ${c.red}✘ Failed to install to ${r.name}: ${r.error}${c.reset}`);
            }
          });
        }
        console.log(`\n  ${c.green}✔ MCP Server configuration complete.${c.reset}`);
        console.log(`  ${c.cyan}Tip:${c.reset} Restart your IDE or start a new chat session to activate the 13 MCP tools.\n`);
        return;
      }

      if (sub === 'uninstall') {
        banner();
        const installer = new McpInstaller(workspaceDir);
        let targetIde = 'all';
        const ideIdx = args.indexOf('--ide');
        if (ideIdx !== -1 && args[ideIdx + 1]) {
          targetIde = args[ideIdx + 1].toLowerCase();
        }
        const res = installer.uninstall(targetIde);
        console.log(`\n  ${c.bright}Uninstalled AetherMind MCP Server from:${c.reset}`);
        res.results.forEach(r => {
          console.log(`  • ${r.name} (${r.uninstalled ? c.green + 'Removed' : c.red + 'Failed'})`);
        });
        console.log('');
        return;
      }

      if (sub === 'status') {
        banner();
        const installer = new McpInstaller(workspaceDir);
        const status = installer.getStatus();
        console.log(`\n  ${c.bright}MCP Server IDE Integration Status:${c.reset}`);
        console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
        for (const [key, s] of Object.entries(status)) {
          const detected = s.detected ? c.green + 'Detected' : c.gray + 'Not found';
          const installed = s.installed ? c.green + '✔ Installed' : c.yellow + '○ Not configured';
          console.log(`  ${c.bright}${s.name.padEnd(30)}${c.reset} ${installed.padEnd(25)} [${detected}${c.reset}]`);
          console.log(`    ${c.gray}${s.configPath}${c.reset}`);
        }
        console.log(`\n  Run ${c.cyan}aethermind mcp install${c.reset} to automatically configure all detected IDEs.\n`);
        return;
      }

      const server = new AetherMindMcpServer(workspaceDir);
      server.startStdio();
      return;
    }

    case 'demo': {
      banner();
      const engine = new EpistemicStateEngine(workspaceDir);
      loadDemoSimulation(engine);
      console.log(`  ${c.green}✔ Synthesized multi-stage AI reasoning flight telemetry.${c.reset}`);
      console.log(`  ${c.cyan}Launching AetherMind GUI...${c.reset}`);
      const { server } = createAppServer(workspaceDir, 4200);
      server.listen(4200, () => {
        console.log(`\n  ${c.green}✔ UI launched at:${c.reset} ${c.bright}${c.cyan}http://localhost:4200${c.reset}\n`);
      });
      break;
    }

    case 'status':
    default: {
      banner();
      const engine = new EpistemicStateEngine(workspaceDir);
      const state = engine.getState();

      console.log(`\n  ${c.bright}Cognitive State Overview:${c.reset}`);
      console.log(`  ${c.gray}──────────────────────────────────────────────────────────────────${c.reset}`);
      console.log(`  Entropy Score:      ${state.metrics.entropyScore < 40 ? c.green : c.yellow}${state.metrics.entropyScore}/100${c.reset}`);
      console.log(`  Coherence Index:    ${c.cyan}${state.metrics.coherenceIndex}%${c.reset}`);
      console.log(`  Active Hypotheses:  ${c.bright}${state.metrics.activeHypothesesCount}${c.reset}`);
      console.log(`  Total Action Steps: ${c.bright}${state.metrics.actionStepsTotal}${c.reset}`);
      console.log(`  Assumptions Track:  ${c.green}${state.metrics.verifiedAssumptionsCount} verified${c.reset}, ${c.yellow}${state.metrics.unverifiedAssumptionsCount} unverified${c.reset}`);
      
      console.log(`\n  ${c.bright}Available Commands:${c.reset}`);
      console.log(`    ${c.cyan}aethermind ui${c.reset}                         Launch the High-Readability Web Studio`);
      console.log(`    ${c.cyan}aethermind gate pre <file> [scope]${c.reset}    Enforce Preflight Gate before code edit`);
      console.log(`    ${c.cyan}aethermind gate edit <file> [sym]${c.reset}     Enforce Edit Gate with policy rules`);
      console.log(`    ${c.cyan}aethermind gate test [tests]${c.reset}          Enforce Test Gate on coupled test suites`);
      console.log(`    ${c.cyan}aethermind gate post [--tests <t>]${c.reset}    Enforce Postflight Gate after modifications`);
      console.log(`    ${c.cyan}aethermind diff${c.reset}                        Inspect colored git diff of uncommitted changes`);
      console.log(`    ${c.cyan}aethermind delta${c.reset}                       Inspect working tree delta & scope validation`);
      console.log(`    ${c.cyan}aethermind report [--md]${c.reset}               Observability & regression intelligence report`);
      console.log(`    ${c.cyan}aethermind intent "<prompt>" [scope]${c.reset}   Declare explicit user intent & allowed scope`);
      console.log(`    ${c.cyan}aethermind blast <file> [sym]${c.reset}          Scan blast radius, dynamic caveats & risk`);
      console.log(`    ${c.cyan}aethermind record <type> <title>${c.reset}       Log hypothesis, intervention, or observation`);
      console.log(`    ${c.cyan}aethermind probe [check] [target]${c.reset}      Run safe reality check & bind proof`);
      console.log(`    ${c.cyan}aethermind audit${c.reset}                       Audit cognitive drift & thrashing loops`);
      console.log(`    ${c.cyan}aethermind export [file.md]${c.reset}             Export markdown session debrief`);
      console.log(`    ${c.cyan}aethermind mcp${c.reset}                         Run stdio Model Context Protocol (MCP) server`);
      console.log(`    ${c.cyan}aethermind demo${c.reset}                        Load synthetic flight scenario & launch UI`);
      console.log('');
      break;
    }
  }
}

main().catch(err => {
  console.error('\x1b[31mAetherMind Fatal Error:\x1b[0m', err.message);
  process.exit(1);
});
