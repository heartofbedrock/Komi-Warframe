const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const BOARD_SIZE = 9;
const CELL_SIZE = 80;
const MARGIN = 20;
const CAPTURE_LIMIT = 10;
const board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
let current = 1;
let captured = {1:0,2:0};
let banned = new Set();
let winner = null;

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
    if(winner) {
        location.reload();
        return;
    }
    const cell = getCell(e);
    if(!cell) return;
    const [cx,cy] = cell;
    const key = `${cx},${cy}`;
    if(board[cy][cx]!==0 || banned.has(key)) return;
    board[cy][cx] = current;
    const removed = removeCaptured(cx,cy);
    captured[current]+=removed.length;
    banned = new Set(removed.map(([x,y])=>`${x},${y}`));
    if(captured[current]>=CAPTURE_LIMIT) winner=current;
    current = current===1?2:1;
    draw();
});

function neighbors(x,y){
    return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([nx,ny])=>nx>=0&&nx<BOARD_SIZE&&ny>=0&&ny<BOARD_SIZE);
}

function floodFill(x,y,color,visited){
    const stack=[[x,y]];const group=[];const libs=new Set();
    while(stack.length){
        const [cx,cy]=stack.pop();
        if(visited.has(`${cx},${cy}`))continue;
        visited.add(`${cx},${cy}`);
        group.push([cx,cy]);
        for(const [nx,ny] of neighbors(cx,cy)){
            if(board[ny][nx]===color&&!visited.has(`${nx},${ny}`))stack.push([nx,ny]);
            else if(board[ny][nx]===0)libs.add(`${nx},${ny}`);
        }
    }
    return {group,libs};
}

function removeCaptured(x,y){
    const enemy=current===1?2:1;
    const visited=new Set();
    const removed=[];
    for(const [nx,ny] of neighbors(x,y)){
        if(board[ny][nx]===enemy&&!visited.has(`${nx},${ny}`)){
            const {group,libs}=floodFill(nx,ny,enemy,visited);
            if(libs.size===0){
                for(const [gx,gy] of group){ board[gy][gx]=0; removed.push([gx,gy]); }
            }
        }
    }
    return removed;
}

// Initial draw
draw();
