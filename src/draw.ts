import { StateManager } from './state';

const COLORS = [
    '#a3e635', // 0: plain (green)
    '#d1d5db', // 1: road (gray)
    '#78350f', // 2: mountain (brown)
    '#38bdf8'  // 3: pond (cyan)
];

const SPOT_COLORS = ['#fbbf24', '#f43f5e']; // Brand 0 and 1

export function drawHexGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: StateManager, step: number) {
    if (!state.data.mapData) return;

    const { width: mapW, height: mapH, cells } = state.data.mapData.map;

    const padding = 20;
    const availWidth = canvas.width - padding * 2;
    const availHeight = canvas.height - padding * 2;

    let hexSize = 25; // default

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

            const pos = r * mapW + c;
            const spot = state.data.mapData.spots.find(s => s.pos === pos);
            if (spot) {
                ctx.fillStyle = SPOT_COLORS[spot.brand % SPOT_COLORS.length] || '#fff';
                ctx.beginPath();
                ctx.arc(cx, cy, hexSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.stroke();

                ctx.fillStyle = '#000';
                ctx.font = `bold ${Math.max(10, hexSize * 0.4)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(spot.stocks.toString(), cx, cy);
            }
        }
    }
}
