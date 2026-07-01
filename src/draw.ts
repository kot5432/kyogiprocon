import { StateManager } from './state';

const COLORS = [
    '#a3e635', // 0: plain (green)
    '#d1d5db', // 1: road (gray)
    '#78350f', // 2: mountain (brown)
    '#38bdf8'  // 3: pond (cyan)
];

const SPOT_COLORS = ['#fbbf24', '#f43f5e']; // Brand 0 and 1
const PATROL_COLOR = '#3b82f6'; // Blue for patrol agents
const SUPPLY_COLOR = '#22c55e'; // Green for supply agents

interface HexCoords {
    cx: number;
    cy: number;
}

export function drawHexGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: StateManager, step: number) {
    if (!state.data.mapData) return;

    const { width: mapW, height: mapH, cells } = state.data.mapData.map;

    const padding = 20;
    const availWidth = canvas.width - padding * 2;
    const availHeight = canvas.height - padding * 2;

    let hexSize = 25;

    const aspectW = mapW * Math.sqrt(3) + Math.sqrt(3) / 2;
    const aspectH = mapH * 1.5 + 0.5;

    const sizeByW = availWidth / aspectW;
    const sizeByH = availHeight / aspectH;
    hexSize = Math.min(sizeByW, sizeByH);

    const actualGridW = aspectW * hexSize;
    const actualGridH = aspectH * hexSize;
    const offsetX = padding + (availWidth - actualGridW) / 2 + (Math.sqrt(3) / 2 * hexSize);
    const offsetY = padding + (availHeight - actualGridH) / 2 + hexSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Helper to get hex center coordinates
    const getHexCenter = (pos: number): HexCoords => {
        const col = pos % mapW;
        const row = Math.floor(pos / mapW);
        const isOdd = row % 2 !== 0;
        return {
            cx: offsetX + (col + (isOdd ? 0.5 : 0)) * Math.sqrt(3) * hexSize,
            cy: offsetY + row * 1.5 * hexSize
        };
    };

    // Layer 1: Draw hex grid with heatmap overlay
    drawHexLayer(ctx, mapW, mapH, cells, hexSize, offsetX, offsetY, state);

    // Layer 2: Draw spots
    drawSpots(ctx, state, hexSize, getHexCenter);

    // Layer 3: Draw future paths (strategy layer)
    drawFuturePaths(ctx, state, step, hexSize, getHexCenter);

    // Layer 4: Draw agents
    drawAgents(ctx, state, step, hexSize, getHexCenter);

    // Layer 5: Draw arrows to targets
    drawTargetArrows(ctx, state, step, hexSize, getHexCenter);
}

function drawHexLayer(
    ctx: CanvasRenderingContext2D,
    mapW: number,
    mapH: number,
    cells: number[][],
    hexSize: number,
    offsetX: number,
    offsetY: number,
    state: StateManager
) {
    for (let r = 0; r < mapH; r++) {
        for (let c = 0; c < mapW; c++) {
            const isOdd = r % 2 !== 0;
            const cx = offsetX + (c + (isOdd ? 0.5 : 0)) * Math.sqrt(3) * hexSize;
            const cy = offsetY + r * 1.5 * hexSize;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 180 * (60 * i - 30);
                const x = cx + hexSize * Math.cos(angle);
                const y = cy + hexSize * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();

            const cellType = cells[r]?.[c] ?? 0;
            ctx.fillStyle = COLORS[cellType];
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.stroke();

            // Heatmap overlay (if available)
            const pos = r * mapW + c;
            const heatmap = state.data.days[0]?.extendedInfo?.heatmap?.find(h => h.pos === pos);
            if (heatmap) {
                ctx.fillStyle = `rgba(255, ${Math.floor(255 * (1 - heatmap.value))}, 0, 0.3)`;
                ctx.fill();
            }
        }
    }
}

function drawSpots(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    hexSize: number,
    getHexCenter: (pos: number) => HexCoords
) {
    if (!state.data.mapData) return;

    state.data.mapData.spots.forEach(spot => {
        const { cx, cy } = getHexCenter(spot.pos);
        
        // Draw spot circle
        ctx.fillStyle = SPOT_COLORS[spot.brand % SPOT_COLORS.length] || '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, hexSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();

        // Draw stock count
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(10, hexSize * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spot.stocks.toString(), cx, cy);
    });
}

function drawAgents(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    step: number,
    hexSize: number,
    getHexCenter: (pos: number) => HexCoords
) {
    if (!state.data.mapData) return;

    const numAgents = state.data.mapData.agents.length;

    for (let agentId = 0; agentId < numAgents; agentId++) {
        const pos = state.getAgentPosition(step, agentId);
        const agentType = state.getAgentType(agentId);
        const { cx, cy } = getHexCenter(pos);

        // Draw agent based on type
        ctx.fillStyle = agentType === 0 ? PATROL_COLOR : SUPPLY_COLOR;
        ctx.beginPath();
        
        // Triangle for patrol, square for supply
        if (agentType === 0) {
            // Triangle (patrol)
            ctx.moveTo(cx, cy - hexSize * 0.5);
            ctx.lineTo(cx + hexSize * 0.4, cy + hexSize * 0.4);
            ctx.lineTo(cx - hexSize * 0.4, cy + hexSize * 0.4);
        } else {
            // Square (supply)
            ctx.rect(cx - hexSize * 0.35, cy - hexSize * 0.35, hexSize * 0.7, hexSize * 0.7);
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;

        // Draw agent ID
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, hexSize * 0.25)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(agentId.toString(), cx, cy);
    }
}

function drawFuturePaths(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    step: number,
    hexSize: number,
    getHexCenter: (pos: number) => HexCoords
) {
    if (!state.data.mapData) return;

    const numAgents = state.data.mapData.agents.length;
    const lookAhead = 5;

    for (let agentId = 0; agentId < numAgents; agentId++) {
        const agentType = state.getAgentType(agentId);
        const path = state.getFuturePath(agentId, step, lookAhead);
        
        if (path.length === 0) continue;

        const currentPos = state.getAgentPosition(step, agentId);
        const { cx: startX, cy: startY } = getHexCenter(currentPos);

        ctx.strokeStyle = agentType === 0 ? PATROL_COLOR : SUPPLY_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        path.forEach((pos, i) => {
            const { cx, cy } = getHexCenter(pos);
            ctx.lineTo(cx, cy);

            // Draw small circle at each future position
            const alpha = 0.8 - (i * 0.15);
            ctx.fillStyle = agentType === 0 
                ? `rgba(59, 130, 246, ${alpha})` 
                : `rgba(34, 197, 94, ${alpha})`;
            ctx.beginPath();
            ctx.arc(cx, cy, hexSize * 0.15, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }
}

function drawTargetArrows(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    step: number,
    hexSize: number,
    getHexCenter: (pos: number) => HexCoords
) {
    if (!state.data.mapData) return;

    const numAgents = state.data.mapData.agents.length;

    for (let agentId = 0; agentId < numAgents; agentId++) {
        const agentType = state.getAgentType(agentId);
        const currentPos = state.getAgentPosition(step, agentId);
        const path = state.getFuturePath(agentId, step, 5);
        
        if (path.length === 0) continue;

        const targetPos = path[path.length - 1];
        const { cx: startX, cy: startY } = getHexCenter(currentPos);
        const { cx: endX, cy: endY } = getHexCenter(targetPos);

        // Draw arrow
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = hexSize * 0.8;
        
        ctx.strokeStyle = agentType === 0 ? PATROL_COLOR : SUPPLY_COLOR;
        ctx.fillStyle = agentType === 0 ? PATROL_COLOR : SUPPLY_COLOR;
        ctx.lineWidth = 2;

        // Arrow line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowLength * Math.cos(angle - Math.PI / 6),
            endY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            endX - arrowLength * Math.cos(angle + Math.PI / 6),
            endY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 1;
    }
}
