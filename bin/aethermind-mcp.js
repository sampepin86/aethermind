#!/usr/bin/env node

const AetherMindMcpServer = require('../src/mcp/server');
const path = require('path');

let workspaceDir = process.argv[2] ? path.resolve(process.argv[2]) : (process.env.AETHERMIND_WORKSPACE || process.cwd());
if (!workspaceDir || workspaceDir === '/') {
  workspaceDir = process.env.AETHERMIND_WORKSPACE || path.resolve(__dirname, '..');
}

const server = new AetherMindMcpServer(workspaceDir);
server.startStdio();
