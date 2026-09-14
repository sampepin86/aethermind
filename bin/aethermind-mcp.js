#!/usr/bin/env node

const AetherMindMcpServer = require('../src/mcp/server');
const path = require('path');

const workspaceDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const server = new AetherMindMcpServer(workspaceDir);
server.startStdio();
