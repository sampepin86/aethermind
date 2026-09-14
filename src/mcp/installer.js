const fs = require('fs');
const path = require('path');
const os = require('os');
const AetherMindMcpServer = require('./server');

class McpInstaller {
  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.nodePath = process.execPath;
    this.mcpScriptPath = path.resolve(__dirname, '../../bin/aethermind-mcp.js');
  }

  getIdeTargets() {
    const home = os.homedir();
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    const claudePath = isMac
      ? path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      : (isWin
          ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
          : path.join(home, '.config', 'Claude', 'claude_desktop_config.json'));

    return {
      antigravity: {
        id: 'antigravity',
        name: 'Google Antigravity (AGY)',
        configPath: path.join(home, '.gemini', 'config', 'mcp_config.json'),
        schemaDir: path.join(home, '.gemini', 'antigravity-ide', 'mcp', 'aethermind'),
        detected: fs.existsSync(path.join(home, '.gemini'))
      },
      cursor: {
        id: 'cursor',
        name: 'Cursor',
        configPath: path.join(home, '.cursor', 'mcp.json'),
        detected: fs.existsSync(path.join(home, '.cursor'))
      },
      windsurf: {
        id: 'windsurf',
        name: 'Windsurf (Codeium)',
        configPath: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        detected: fs.existsSync(path.join(home, '.codeium', 'windsurf'))
      },
      claude: {
        id: 'claude',
        name: 'Claude Desktop',
        configPath: claudePath,
        detected: fs.existsSync(path.dirname(claudePath))
      },
      project: {
        id: 'project',
        name: 'Project Local (.cursor/mcp.json)',
        configPath: path.join(this.workspaceDir, '.cursor', 'mcp.json'),
        detected: true
      }
    };
  }

  buildMcpConfig() {
    return {
      command: this.nodePath,
      args: [
        this.mcpScriptPath,
        this.workspaceDir
      ],
      env: {
        AETHERMIND_WORKSPACE: this.workspaceDir,
        PATH: process.env.PATH || ''
      }
    };
  }

  install(targetId = 'all') {
    const targets = this.getIdeTargets();
    const results = [];
    const serverPayload = this.buildMcpConfig();

    const toInstall = targetId === 'all'
      ? Object.values(targets).filter(t => t.detected)
      : (targets[targetId] ? [targets[targetId]] : []);

    if (toInstall.length === 0) {
      return {
        success: false,
        message: `No supported IDEs found or target '${targetId}' unknown.`,
        installed: []
      };
    }

    for (const target of toInstall) {
      try {
        const dir = path.dirname(target.configPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        let currentConfig = { mcpServers: {} };
        if (fs.existsSync(target.configPath)) {
          try {
            const raw = fs.readFileSync(target.configPath, 'utf8');
            currentConfig = JSON.parse(raw);
            if (!currentConfig.mcpServers) currentConfig.mcpServers = {};
          } catch {
            currentConfig = { mcpServers: {} };
          }
        }

        currentConfig.mcpServers.aethermind = serverPayload;
        fs.writeFileSync(target.configPath, JSON.stringify(currentConfig, null, 2), 'utf8');

        // If Antigravity, also populate tool schema directory
        if (target.schemaDir) {
          this.syncAntigravitySchemas(target.schemaDir);
        }

        results.push({
          ide: target.id,
          name: target.name,
          configPath: target.configPath,
          success: true
        });
      } catch (err) {
        results.push({
          ide: target.id,
          name: target.name,
          configPath: target.configPath,
          success: false,
          error: err.message
        });
      }
    }

    return {
      success: results.some(r => r.success),
      installedCount: results.filter(r => r.success).length,
      results
    };
  }

  uninstall(targetId = 'all') {
    const targets = this.getIdeTargets();
    const results = [];

    const toUninstall = targetId === 'all'
      ? Object.values(targets)
      : (targets[targetId] ? [targets[targetId]] : []);

    for (const target of toUninstall) {
      if (!fs.existsSync(target.configPath)) continue;
      try {
        const raw = fs.readFileSync(target.configPath, 'utf8');
        const currentConfig = JSON.parse(raw);
        if (currentConfig.mcpServers && currentConfig.mcpServers.aethermind) {
          delete currentConfig.mcpServers.aethermind;
          fs.writeFileSync(target.configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
          results.push({ ide: target.id, name: target.name, uninstalled: true });
        }
      } catch (err) {
        results.push({ ide: target.id, name: target.name, uninstalled: false, error: err.message });
      }
    }

    return { results };
  }

  getStatus() {
    const targets = this.getIdeTargets();
    const status = {};

    for (const [key, t] of Object.entries(targets)) {
      let isInstalled = false;
      if (fs.existsSync(t.configPath)) {
        try {
          const raw = fs.readFileSync(t.configPath, 'utf8');
          const json = JSON.parse(raw);
          isInstalled = !!(json.mcpServers && json.mcpServers.aethermind);
        } catch {
          isInstalled = false;
        }
      }

      status[key] = {
        name: t.name,
        detected: t.detected,
        configPath: t.configPath,
        installed: isInstalled
      };
    }

    return status;
  }

  syncAntigravitySchemas(outDir) {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const server = new AetherMindMcpServer(this.workspaceDir);
    const tools = server.registerTools();

    tools.forEach(t => {
      const schema = {
        name: t.name,
        description: t.description,
        parameters: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          ...t.inputSchema
        }
      };
      fs.writeFileSync(path.join(outDir, `${t.name}.json`), JSON.stringify(schema, null, 2));
    });

    const instructions = `# AetherMind MCP Server
Adaptive epistemic flight recorder, dynamic reality engine, pre-execution blast radius analyzer, and cognitive drift guard.

## Core Tool Suite
- aethermind_status: Current coherence metrics, active hypotheses, and unverified assumptions.
- aethermind_intent: Enforce strict user change surface boundaries.
- aethermind_gate_edit: Enforce pre-edit policy approval.
- aethermind_blast: Analyze downstream consumers, risk score, and coupled tests.
- aethermind_probe: Execute empirical reality checks and bind verified facts.
- aethermind_diff: Inspect uncommitted workspace modifications.
- aethermind_gate_test: Ensure coupled test suites are executed.
- aethermind_postflight: Validate AST syntax and scope integrity after modifications.
- aethermind_report: Generate observability & regression intelligence answering the 4 reliability questions.
`;
    fs.writeFileSync(path.join(outDir, 'instructions.md'), instructions);
  }
}

module.exports = McpInstaller;
