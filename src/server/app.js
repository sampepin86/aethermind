const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { createApiRoutes } = require('./routes');
const EpistemicStateEngine = require('../core/state-engine');

function createAppServer(workspaceDir = process.cwd(), port = 4200) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  const stateEngine = new EpistemicStateEngine(workspaceDir);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Broadcast state updates to all connected UI clients
  stateEngine.on('update', (state) => {
    const payload = JSON.stringify({ type: 'STATE_UPDATE', payload: state });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  // REST API
  app.use('/api', createApiRoutes(stateEngine, workspaceDir));

  // WebSocket connection handler
  wss.on('connection', (ws) => {
    // Send initial state upon connection
    ws.send(JSON.stringify({ type: 'INITIAL_STATE', payload: stateEngine.getState() }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (err) {
        // ignore malformed ws messages
      }
    });
  });

  return { app, server, stateEngine, port };
}

module.exports = createAppServer;
