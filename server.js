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
let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
let current = 1;
let captured = { 1: 0, 2: 0 };
let banned = new Set();
let winner = null;
let availablePlayers = [1, 2];

function neighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE);
}

function floodFill(x, y, color, visited) {
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

function removeCaptured(x, y) {
  const enemy = current === 1 ? 2 : 1;
  const visited = new Set();
  const removed = [];
  for (const [nx, ny] of neighbors(x, y)) {
    if (board[ny][nx] === enemy && !visited.has(`${nx},${ny}`)) {
      const { group, libs } = floodFill(nx, ny, enemy, visited);
      if (libs.size === 0) {
        for (const [gx, gy] of group) {
          board[gy][gx] = 0;
          removed.push([gx, gy]);
        }
      }
    }
  }
  return removed;
}

function resetBoard() {
  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  current = 1;
  captured = { 1: 0, 2: 0 };
  banned = new Set();
  winner = null;
}

function payload(player) {
  return {
    type: 'state',
    player,
    board,
    captured,
    current,
    banned: [...banned],
    winner,
  };
}

function broadcast() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload(client.player)));
    }
  });
}

wss.on('connection', (ws) => {
  ws.player = availablePlayers.length ? availablePlayers.shift() : 0;
  ws.send(JSON.stringify(payload(ws.player)));

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
        ws.player === current &&
        !winner &&
        x >= 0 &&
        x < BOARD_SIZE &&
        y >= 0 &&
        y < BOARD_SIZE &&
        board[y][x] === 0 &&
        !banned.has(`${x},${y}`)
      ) {
        board[y][x] = ws.player;
        const removed = removeCaptured(x, y);
        captured[ws.player] += removed.length;
        banned = new Set(removed.map(([rx, ry]) => `${rx},${ry}`));
        if (captured[ws.player] >= CAPTURE_LIMIT) {
          winner = ws.player;
        } else {
          current = current === 1 ? 2 : 1;
        }
        broadcast();
      }
    } else if (msg.type === 'reset' && winner && ws.player) {
      resetBoard();
      broadcast();
    }
  });

  ws.on('close', () => {
    if (ws.player > 0) {
      availablePlayers.push(ws.player);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
