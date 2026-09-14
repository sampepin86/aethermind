const readline = require('readline');
const EpistemicStateEngine = require('../core/state-engine');
const BlastRadiusAnalyzer = require('../core/blast-radius');
const RealityProbeMatrix = require('../core/reality-probe');
const CognitiveDriftDetector = require('../core/drift-detector');
const GitObserver = require('../core/git-observer');
const UserIntentEngine = require('../core/intent-engine');
const AgentGate = require('../core/agent-gate');

class AetherMindMcpServer {
  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = workspaceDir;
    this.stateEngine = new EpistemicStateEngine(workspaceDir);
    this.intentEngine = new UserIntentEngine(workspaceDir);
    this.agentGate = new AgentGate(this.stateEngine, workspaceDir, this.intentEngine);
    this.blastAnalyzer = new BlastRadiusAnalyzer(workspaceDir);
    this.gitObserver = new GitObserver(workspaceDir);
    this.driftDetector = new CognitiveDriftDetector(this.stateEngine);

    this.tools = this.registerTools();
  }

  registerTools() {
    return [
      {
        name: 'aethermind_status',
        description: 'Get overall epistemic flight state, coherence index, active hypotheses, and unverified assumptions.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'aethermind_intent',
        description: 'Declare the user request scope to enforce strict change boundaries and prevent accidental edits.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'User request summary or instruction' },
            scope: { type: 'array', items: { type: 'string' }, description: 'Allowed target files or directory paths' },
            testsAllowed: { type: 'boolean', description: 'Whether tests are permitted to be updated' },
            dependenciesAllowed: { type: 'boolean', description: 'Whether package.json / lockfiles may be updated' }
          },
          required: ['scope']
        }
      },
      {
        name: 'aethermind_preflight',
        description: 'Pre-edit safety gate. Validates target against scope, checks blast radius, and flags unverified premises.',
        inputSchema: {
          type: 'object',
          properties: {
            targetFiles: { type: 'array', items: { type: 'string' }, description: 'Files planned for modification' },
            targetSymbols: { type: 'array', items: { type: 'string' }, description: 'Optional symbol names' }
          },
          required: ['targetFiles']
        }
      },
      {
        name: 'aethermind_blast',
        description: 'Analyze downstream dependents, coupled test suites, dynamic reflection caveats, and risk score for a file.',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path to analyze' },
            symbol: { type: 'string', description: 'Optional specific symbol/function' }
          },
          required: ['file']
        }
      },
      {
        name: 'aethermind_probe',
        description: 'Execute an empirical reality check (port, syntax, command, env, or safe exec) and optionally bind proof into the epistemic ledger.',
        inputSchema: {
          type: 'object',
          properties: {
            probeType: { type: 'string', enum: ['port', 'syntax', 'command', 'env', 'exec'], description: 'Type of check' },
            target: { type: 'string', description: 'Target value (port number, filepath, command, env name)' },
            recordFact: { type: 'boolean', description: 'If true, automatically registers an observation node in the reasoning graph' },
            assumptionId: { type: 'string', description: 'Optional assumption ID to verify with this probe result' }
          },
          required: ['probeType', 'target']
        }
      },
      {
        name: 'aethermind_record',
        description: 'Log an epistemic node (hypothesis, intervention, or observation) to maintain a persistent causal flight path.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['hypothesis', 'intervention', 'observation'], description: 'Node type' },
            title: { type: 'string', description: 'Short descriptive title' },
            details: { type: 'string', description: 'Detailed causal evidence or rationale' },
            parentId: { type: 'string', description: 'Optional parent node ID' }
          },
          required: ['type', 'title']
        }
      },
      {
        name: 'aethermind_git_delta',
        description: 'Inspect current git working tree modifications and check if any unexpected files were modified outside scope.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'aethermind_postflight',
        description: 'Post-edit verification gate. Validates AST syntax on all touched files, verifies test runs, and flags scope violations.',
        inputSchema: {
          type: 'object',
          properties: {
            modifiedFiles: { type: 'array', items: { type: 'string' }, description: 'Files modified by the agent' },
            executedTests: { type: 'array', items: { type: 'string' }, description: 'Test suites that were executed' }
          }
        }
      },
      {
        name: 'aethermind_audit',
        description: 'Evaluate cognitive drift, action thrashing, circular reasoning loops, and context staleness.',
        inputSchema: { type: 'object', properties: {} }
      }
    ];
  }

  async executeTool(name, args = {}) {
    switch (name) {
      case 'aethermind_status': {
        const state = this.stateEngine.getState();
        return {
          session: state.session,
          metrics: state.metrics,
          activeIntent: this.intentEngine.getIntent(),
          activeHypotheses: state.nodes.filter(n => n.type === 'hypothesis' && n.status === 'active'),
          unverifiedAssumptions: state.assumptions.filter(a => !a.verified)
        };
      }

      case 'aethermind_intent': {
        const intent = this.intentEngine.declareIntent({
          prompt: args.prompt || '',
          scope: args.scope || [],
          testsAllowed: args.testsAllowed !== false,
          dependenciesAllowed: args.dependenciesAllowed === true
        });
        this.stateEngine.setIntent(intent);
        return { message: 'User intent and scope constraints declared', intent };
      }

      case 'aethermind_preflight': {
        return this.agentGate.evaluatePreflight({
          targetFiles: args.targetFiles || [],
          targetSymbols: args.targetSymbols || []
        });
      }

      case 'aethermind_blast': {
        return this.blastAnalyzer.analyze(args.file, args.symbol || null);
      }

      case 'aethermind_probe': {
        if (args.recordFact) {
          return await RealityProbeMatrix.probeAndRecordFact(this.stateEngine, {
            probeType: args.probeType,
            target: args.target,
            assumptionId: args.assumptionId
          });
        }
        let result = null;
        if (args.probeType === 'port') result = await RealityProbeMatrix.checkPort(parseInt(args.target, 10));
        else if (args.probeType === 'syntax') result = RealityProbeMatrix.checkSyntax(args.target);
        else if (args.probeType === 'command') result = RealityProbeMatrix.checkCommand(args.target);
        else if (args.probeType === 'env') result = RealityProbeMatrix.checkEnvVar(args.target);
        else if (args.probeType === 'exec') result = RealityProbeMatrix.runShellAssertion(args.target, null, this.workspaceDir);
        return result;
      }

      case 'aethermind_record': {
        const node = this.stateEngine.addNode({
          type: args.type,
          title: args.title,
          details: args.details || '',
          parentId: args.parentId || null
        });
        return { message: `Recorded ${args.type.toUpperCase()}`, node };
      }

      case 'aethermind_git_delta': {
        const delta = this.gitObserver.computeDelta();
        const validation = this.intentEngine.validateChangeSurface(delta.rawFiles.map(f => f.file));
        return { delta, scopeValidation: validation };
      }

      case 'aethermind_postflight': {
        return this.agentGate.evaluatePostflight({
          modifiedFiles: args.modifiedFiles || [],
          executedTests: args.executedTests || []
        });
      }

      case 'aethermind_audit': {
        return this.driftDetector.detect();
      }

      default:
        throw new Error(`Unknown AetherMind tool: ${name}`);
    }
  }

  startStdio() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async (line) => {
      if (!line.trim()) return;
      try {
        const request = JSON.parse(line);
        const response = await this.handleJsonRpc(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (err) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error: ' + err.message }
        }) + '\n');
      }
    });
  }

  async handleJsonRpc(req) {
    const { jsonrpc, id, method, params } = req;

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'aethermind-mcp',
            version: '1.0.0'
          }
        }
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: this.tools }
      };
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const output = await this.executeTool(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(output, null, 2)
              }
            ]
          }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
          }
        };
      }
    }

    if (method === 'notifications/initialized') {
      return null;
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method '${method}' not found` }
    };
  }
}

module.exports = AetherMindMcpServer;
