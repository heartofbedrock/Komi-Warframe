const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const BOARD_SIZE = 9;
const CELL_SIZE = 80;
const MARGIN = 20;
let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
let current = 1;
let captured = { 1: 0, 2: 0 };
let banned = new Set();
let winner = null;
let player = 0;

const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const params = new URLSearchParams(location.search);
let room = params.get('room');

const uid = params.get('uid');
const other = params.get('other');

if (!room) {
    if (uid && other) {
        const ids = [uid, other].sort();
        room = `${ids[0]}_${ids[1]}`;
    } else {
        room = Math.random().toString(36).slice(2, 8);
    }
    params.set('room', room);
    history.replaceState(null, '', `?${params.toString()}`);
}
const queryParts = [`room=${encodeURIComponent(room)}`];
if (uid) queryParts.push(`uid=${encodeURIComponent(uid)}`);
if (other) queryParts.push(`other=${encodeURIComponent(other)}`);
const ws = new WebSocket(`${wsProto}://${location.host}?${queryParts.join('&')}`);

const turnEl = document.getElementById('turn');

ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state' || msg.type === 'init') {
        player = msg.player;
        board = msg.board;
        captured = msg.captured;
        current = msg.current;
        winner = msg.winner;
        banned = new Set(msg.banned || []);
        draw();
    }
});

function draw() {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 2;
    for(let i=0;i<=BOARD_SIZE;i++) {
        const offset = MARGIN + i*CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(MARGIN, offset);
        ctx.lineTo(MARGIN+BOARD_SIZE*CELL_SIZE, offset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(offset, MARGIN);
        ctx.lineTo(offset, MARGIN+BOARD_SIZE*CELL_SIZE);
        ctx.stroke();
    }

    for(let y=0;y<BOARD_SIZE;y++) {
        for(let x=0;x<BOARD_SIZE;x++) {
            const val = board[y][x];
            if(val){ drawStone(x,y,val); }
        }
    }

    document.getElementById('score').textContent = `${captured[1]} - ${captured[2]}`;
    if (winner) {
        turnEl.textContent = `Winner: Player ${winner}`;
    } else {
        turnEl.textContent = current === 1 ? "Black's Turn" : "White's Turn";
    }
}

function drawStone(x,y,val){
    const cx = MARGIN + x*CELL_SIZE + CELL_SIZE/2;
    const cy = MARGIN + y*CELL_SIZE + CELL_SIZE/2;
    const r = CELL_SIZE/2 - 6;
    ctx.fillStyle = val===1? '#ecf0f1':'#000';
    ctx.beginPath();
    ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#95a5a6';
    ctx.stroke();
}

function getCell(e){
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if(x<MARGIN||y<MARGIN||x>canvas.width-MARGIN||y>canvas.height-MARGIN) return null;
    return [Math.floor((x-MARGIN)/CELL_SIZE), Math.floor((y-MARGIN)/CELL_SIZE)];
}

canvas.addEventListener('click', e => {
    if(ws.readyState !== WebSocket.OPEN) return;
    if(winner){
        ws.send(JSON.stringify({type:'reset'}));
        return;
    }
    const cell = getCell(e);
    if(!cell) return;
    ws.send(JSON.stringify({type:'move', x: cell[0], y: cell[1]}));
});

// Initial draw
draw();
