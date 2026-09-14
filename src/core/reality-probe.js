const { execSync, execFileSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

class RealityProbeMatrix {
  static async checkPort(port) {
    return new Promise((resolve) => {
      // First attempt to connect to detect active listeners on 127.0.0.1
      const client = net.createConnection({ port, host: '127.0.0.1' });
      client.once('connect', () => {
        client.destroy();
        resolve({ passed: false, message: `Port ${port} is occupied / actively listening.` });
      });
      client.once('error', () => {
        // If connection refused, test binding
        const server = net.createServer();
        server.once('error', (err) => {
          resolve({ passed: false, message: `Port ${port} cannot be bound: ${err.message}` });
        });
        server.once('listening', () => {
          server.close(() => {
            resolve({ passed: true, message: `Port ${port} is available.` });
          });
        });
        server.listen(port);
      });
    });
  }

  static checkCommand(commandName) {
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(commandName)) {
      return { passed: false, message: `Invalid command name: disallowed characters.` };
    }
    try {
      const isWin = process.platform === 'win32';
      const lookupCmd = isWin ? `where "${commandName}"` : `which "${commandName}"`;
      const output = execSync(lookupCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const firstLine = output.split(/\r?\n/)[0];
      return { passed: true, path: firstLine, message: `Binary ${commandName} resolved at ${firstLine}` };
    } catch (e) {
      return { passed: false, message: `Binary '${commandName}' NOT found in PATH.` };
    }
  }

  static checkSyntax(filePath) {
    if (!fs.existsSync(filePath)) {
      return { passed: false, message: `Target file ${filePath} does not exist.` };
    }
    const ext = path.extname(filePath);
    try {
      if (['.js', '.mjs', '.cjs'].includes(ext)) {
        execFileSync('node', ['--check', filePath], { stdio: 'pipe' });
      } else if (ext === '.py') {
        execFileSync('python3', ['-m', 'py_compile', filePath], { stdio: 'pipe' });
      } else if (ext === '.json') {
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      return { passed: true, message: `Syntax validation passed for ${path.basename(filePath)}` };
    } catch (err) {
      return { passed: false, message: `Syntax error in ${path.basename(filePath)}: ${err.message.split('\n')[0]}` };
    }
  }

  static checkEnvVar(varName) {
    const val = process.env[varName];
    if (val !== undefined) {
      return { passed: true, value: val ? `${val.substring(0, 12)}...` : '(empty string)', message: `Env var ${varName} exists.` };
    }
    return { passed: false, message: `Env var ${varName} is NOT set.` };
  }

  static sanitizeOutput(text) {
    if (!text) return '';
    return text
      .replace(/(?:password|passwd|secret|token|api[_-]?key|bearer\s+[a-zA-Z0-9_\-\.]+)=([^\s&]+)/gi, '$1=***REDACTED***')
      .substring(0, 500);
  }

  static isSafeCommand(command) {
    // Only allow safe inspection and verification binaries
    const safeBinaries = new Set([
      'git', 'node', 'npm', 'npx', 'python', 'python3', 'which', 'where',
      'echo', 'test', 'cat', 'ls', 'dir', 'uname', 'pwd', 'head', 'tail', 'grep'
    ]);

    // Disallow dangerous shell metacharacters for arbitrary chained injection
    if (/[;&|`$><]/.test(command)) {
      return { safe: false, reason: 'Command contains chained shell metacharacters (&, ;, |, `, $, >, <).' };
    }

    const firstToken = command.trim().split(/\s+/)[0];
    const baseBin = path.basename(firstToken).replace(/\.(?:exe|cmd|bat)$/i, '');

    if (!safeBinaries.has(baseBin)) {
      return { safe: false, reason: `Binary '${baseBin}' is not in the approved safe probe allowlist.` };
    }

    return { safe: true };
  }

  static runShellAssertion(command, expectedRegex = null, cwd = process.cwd()) {
    const safety = this.isSafeCommand(command);
    if (!safety.safe) {
      return {
        passed: false,
        sandboxed: true,
        output: '',
        message: `Probe Security Sandbox Blocked Execution: ${safety.reason}`
      };
    }

    try {
      const stdout = execSync(command, {
        encoding: 'utf8',
        timeout: 4000,
        cwd,
        maxBuffer: 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      const sanitized = this.sanitizeOutput(stdout);

      if (expectedRegex) {
        const regex = new RegExp(expectedRegex);
        const matches = regex.test(stdout);
        return {
          passed: matches,
          sandboxed: true,
          output: sanitized,
          message: matches ? `Command succeeded and matched '${expectedRegex}'` : `Command output did not match '${expectedRegex}'`
        };
      }
      return { passed: true, sandboxed: true, output: sanitized, message: `Command executed with exit code 0` };
    } catch (err) {
      return {
        passed: false,
        sandboxed: true,
        output: this.sanitizeOutput(err.stdout ? err.stdout : err.message),
        message: `Command failed with code ${err.status || 1}`
      };
    }
  }

  static async probeAndRecordFact(stateEngine, { probeType, target, assumptionId = null, parentNodeId = null }) {
    let result = null;
    if (probeType === 'port') {
      result = await this.checkPort(parseInt(target, 10));
    } else if (probeType === 'syntax') {
      result = this.checkSyntax(path.resolve(stateEngine.workspaceDir, target));
    } else if (probeType === 'command') {
      result = this.checkCommand(target);
    } else if (probeType === 'env') {
      result = this.checkEnvVar(target);
    } else if (probeType === 'exec') {
      result = this.runShellAssertion(target, null, stateEngine.workspaceDir);
    } else {
      throw new Error(`Unknown probe type: ${probeType}`);
    }

    // If linked to an assumption in the ledger, update it with factual proof
    if (assumptionId) {
      stateEngine.verifyAssumption(assumptionId, result.passed, result.message || result.output || '');
    }

    // Record an empirical observation node into the reasoning graph
    const obsNode = stateEngine.addNode({
      type: 'observation',
      title: `Empirical Probe: [${probeType.toUpperCase()}] ${target}`,
      details: `Reality probe result: ${result.passed ? 'PASSED' : 'FAILED'} — ${result.message || result.output || ''}`,
      status: result.passed ? 'confirmed' : 'refuted',
      confidence: 0.99,
      parentId: parentNodeId
    });

    return { result, observationNode: obsNode };
  }

  static async runSystemHealthCheck(workspaceDir = process.cwd()) {
    const results = {
      node: this.checkCommand('node'),
      python: this.checkCommand('python3'),
      git: this.checkCommand('git'),
      gitStatus: this.runShellAssertion('git rev-parse --is-inside-work-tree', null, workspaceDir),
      port4200: await this.checkPort(4200),
      timestamp: new Date().toISOString()
    };
    return results;
  }
}

module.exports = RealityProbeMatrix;
