const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/handshake', (req, res) => {
  res.json({
    name: 'Komi Warframe',
    handshake: true,
  });
});

// ----- Game state -----
const BOARD_SIZE = 9;
const CAPTURE_LIMIT = 10;

const sessions = {};

function createSession(id) {
  return {
    id,
    board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
    current: 1,
    captured: { 1: 0, 2: 0 },
    banned: new Set(),
    winner: null,
    availablePlayers: [1, 2],
    clients: new Set(),
  };
}

function getSession(id) {
  if (!sessions[id]) {
    sessions[id] = createSession(id);
  }
  return sessions[id];
}

function neighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE);
}

function floodFill(board, x, y, color, visited) {
  const stack = [[x, y]];
  const group = [];
  const libs = new Set();
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    group.push([cx, cy]);
    for (const [nx, ny] of neighbors(cx, cy)) {
      if (board[ny][nx] === color) {
        stack.push([nx, ny]);
      } else if (board[ny][nx] === 0) {
        libs.add(`${nx},${ny}`);
      }
    }
  }
  return { group, libs };
}

function removeCaptured(session, x, y) {
  const enemy = session.current === 1 ? 2 : 1;
  const visited = new Set();
  const removed = [];
  for (const [nx, ny] of neighbors(x, y)) {
    if (session.board[ny][nx] === enemy && !visited.has(`${nx},${ny}`)) {
      const { group, libs } = floodFill(session.board, nx, ny, enemy, visited);
      if (libs.size === 0) {
        for (const [gx, gy] of group) {
          session.board[gy][gx] = 0;
          removed.push([gx, gy]);
        }
      }
    }
  }
  return removed;
}

function resetBoard(session) {
  session.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  session.current = 1;
  session.captured = { 1: 0, 2: 0 };
  session.banned = new Set();
  session.winner = null;
}

function payload(session, player) {
  return {
    type: 'state',
    player,
    board: session.board,
    captured: session.captured,
    current: session.current,
    banned: [...session.banned],
    winner: session.winner,
  };
}

function broadcast(session) {
  session.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload(session, client.player)));
    }
  });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'default';
  const session = getSession(room);
  ws.session = session;
  ws.player = session.availablePlayers.length ? session.availablePlayers.shift() : 0;
  session.clients.add(ws);
  ws.send(JSON.stringify(payload(session, ws.player)));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === 'move') {
      const { x, y } = msg;
      if (
        ws.player === session.current &&
        !session.winner &&
        x >= 0 &&
        x < BOARD_SIZE &&
        y >= 0 &&
        y < BOARD_SIZE &&
        session.board[y][x] === 0 &&
        !session.banned.has(`${x},${y}`)
      ) {
        session.board[y][x] = ws.player;
        const removed = removeCaptured(session, x, y);
        session.captured[ws.player] += removed.length;
        session.banned = new Set(removed.map(([rx, ry]) => `${rx},${ry}`));
        if (session.captured[ws.player] >= CAPTURE_LIMIT) {
          session.winner = ws.player;
        } else {
          session.current = session.current === 1 ? 2 : 1;
        }
        broadcast(session);
      }
    } else if (msg.type === 'reset' && session.winner && ws.player) {
      resetBoard(session);
      broadcast(session);
    }
  });

  ws.on('close', () => {
    session.clients.delete(ws);
    if (ws.player > 0) {
      session.availablePlayers.push(ws.player);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
