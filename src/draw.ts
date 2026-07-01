import { StateManager } from './state';

// -------------------------------------------------------
// 地形カラー（デフォルト）
// -------------------------------------------------------
const TERRAIN_COLORS: Record<number, string> = {
    0: '#4ade80', // 平地 (green)
    1: '#9ca3af', // 道路・順調 (gray)
    2: '#92400e', // 山地 (brown)
    3: '#38bdf8', // 池   (cyan)
};

// 道路の交通状態カラー
const ROAD_TRAFFIC_COLORS: Record<number, string> = {
    0: '#9ca3af', // 順調 (gray)
    1: '#fb923c', // 混雑 (orange)
    2: '#ef4444', // 渋滞 (red)
};

// スポット系列カラー（最大10系列）
const SPOT_BRAND_COLORS = [
    '#fbbf24', // 0: amber
    '#f43f5e', // 1: rose
    '#a78bfa', // 2: violet
    '#34d399', // 3: emerald
    '#60a5fa', // 4: blue
    '#f97316', // 5: orange
    '#e879f9', // 6: fuchsia
    '#2dd4bf', // 7: teal
    '#facc15', // 8: yellow
    '#94a3b8', // 9: slate
];

const PATROL_COLOR  = '#3b82f6'; // 巡回車 (blue)
const SUPPLY_COLOR  = '#22c55e'; // 補給車 (green)

// デバッグ: セル番号を表示するか
let showCellIds = false;
export function toggleCellIds() { showCellIds = !showCellIds; }

// -------------------------------------------------------
// メイン描画エントリポイント
// -------------------------------------------------------
export function drawHexGrid(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    state: StateManager,
    step: number
) {
    if (!state.data.mapData) return;

    const { width: mapW, height: mapH, cells } = state.data.mapData.map;

    // キャンバス全体に対して六角形グリッドが収まるサイズを計算
    const padding = 20;
    const availW = canvas.width  - padding * 2;
    const availH = canvas.height - padding * 2;

    // pointy-top hex の幅・高さ係数
    //   幅: √3 * size  per col, 奇数行が半セル右にずれるので +0.5col 分余白
    //   高さ: 1.5 * size per row, 最後の行は +0.5 分
    const aspectW = (mapW + 0.5) * Math.sqrt(3);
    const aspectH = (mapH - 1) * 1.5 + 2.0;

    const hexSize = Math.min(availW / aspectW, availH / aspectH);

    // グリッド全体を中央揃え
    const gridW = aspectW * hexSize;
    const gridH = aspectH * hexSize;
    const originX = padding + (availW - gridW) / 2 + (Math.sqrt(3) / 2) * hexSize;
    const originY = padding + (availH - gridH) / 2 + hexSize;

    // セル中心座標を返すヘルパー (odd-r オフセット: 奇数行が右へ0.5ずれる)
    const getHexCenter = (pos: number) => {
        const col = pos % mapW;
        const row = Math.floor(pos / mapW);
        return {
            cx: originX + (col + (row % 2 !== 0 ? 0.5 : 0)) * Math.sqrt(3) * hexSize,
            cy: originY + row * 1.5 * hexSize,
        };
    };

    // 六角形パスを描くヘルパー (pointy-top: 頂点が上下)
    const hexPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            // pointy-top: 0° = 上, 各頂点 60° ずつ
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
    };

    // 現在の日の交通情報を取得
    const traffics = getCurrentTraffics(state, step);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Layer 1: 地形 + 交通状態 + ヒートマップ ---
    for (let r = 0; r < mapH; r++) {
        for (let c = 0; c < mapW; c++) {
            const pos  = r * mapW + c;
            const cell = cells[r]?.[c] ?? 0;
            const cx   = originX + (c + (r % 2 !== 0 ? 0.5 : 0)) * Math.sqrt(3) * hexSize;
            const cy   = originY + r * 1.5 * hexSize;

            hexPath(ctx, cx, cy, hexSize);

            // 道路の場合は交通状態で色を変える
            let fillColor: string;
            if (cell === 1) {
                const trafficStatus = traffics.get(pos) ?? 0;
                fillColor = ROAD_TRAFFIC_COLORS[trafficStatus] ?? ROAD_TRAFFIC_COLORS[0];
            } else {
                fillColor = TERRAIN_COLORS[cell] ?? '#888';
            }
            ctx.fillStyle = fillColor;
            ctx.fill();

            // ヒートマップオーバーレイ
            const heat = state.data.days[0]?.extendedInfo?.heatmap?.find(h => h.pos === pos);
            if (heat) {
                hexPath(ctx, cx, cy, hexSize);
                ctx.fillStyle = `rgba(255, ${Math.floor(255 * (1 - heat.value))}, 0, 0.35)`;
                ctx.fill();
            }

            // 枠線
            hexPath(ctx, cx, cy, hexSize);
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // セル番号（デバッグ表示）
            if (showCellIds && hexSize > 12) {
                ctx.fillStyle = cell === 3 ? '#1e40af' : 'rgba(0,0,0,0.55)';
                ctx.font = `${Math.max(8, hexSize * 0.28)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(pos.toString(), cx, cy);
            }
        }
    }

    // --- Layer 2: スポット ---
    drawSpots(ctx, state, step, hexSize, getHexCenter);

    // --- Layer 3: 未来経路 ---
    drawFuturePaths(ctx, state, step, hexSize, getHexCenter);

    // --- Layer 4: エージェント ---
    drawAgents(ctx, state, step, hexSize, getHexCenter);
}

// -------------------------------------------------------
// 現在ステップの交通情報を Map<pos, status> で返す
// -------------------------------------------------------
function getCurrentTraffics(state: StateManager, step: number): Map<number, number> {
    const map = new Map<number, number>();
    if (!state.data.mapData) return map;

    // どの日のステップかを特定
    let acc = 0;
    let dayIdx = 0;
    for (let i = 0; i < state.data.mapData.daySteps.length; i++) {
        acc += state.data.mapData.daySteps[i];
        if (step < acc) { dayIdx = i; break; }
    }

    const traffics = state.data.days[dayIdx]?.info?.traffics ?? [];
    for (const t of traffics) {
        map.set(t.pos, t.status);
    }
    return map;
}

// -------------------------------------------------------
// スポット描画
// -------------------------------------------------------
function drawSpots(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    _step: number,
    hexSize: number,
    getHexCenter: (pos: number) => { cx: number; cy: number }
) {
    if (!state.data.mapData) return;

    state.data.mapData.spots.forEach(spot => {
        const { cx, cy } = getHexCenter(spot.pos);
        const color = SPOT_BRAND_COLORS[spot.brand % SPOT_BRAND_COLORS.length];
        const r = hexSize * 0.38;

        // 外側リング
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();

        // スポット本体
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 系列番号
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(9, hexSize * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spot.brand.toString(), cx, cy);

        // 在庫バッジ（右上）
        if (hexSize > 14) {
            const bx = cx + r * 0.75;
            const by = cy - r * 0.75;
            ctx.beginPath();
            ctx.arc(bx, by, hexSize * 0.18, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.font = `bold ${Math.max(7, hexSize * 0.2)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(spot.stocks.toString(), bx, by);
        }
    });
}

// -------------------------------------------------------
// エージェント描画
// -------------------------------------------------------
function drawAgents(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    step: number,
    hexSize: number,
    getHexCenter: (pos: number) => { cx: number; cy: number }
) {
    if (!state.data.mapData) return;

    const numAgents = state.data.mapData.agents.length;

    for (let agentId = 0; agentId < numAgents; agentId++) {
        const pos  = state.getAgentPosition(step, agentId);
        const kind = state.getAgentType(agentId, step); // 0=巡回, 1=補給
        const { cx, cy } = getHexCenter(pos);
        const color = kind === 0 ? PATROL_COLOR : SUPPLY_COLOR;
        const s = hexSize * 0.42; // 形のサイズ係数

        // 影
        ctx.beginPath();
        if (kind === 0) {
            // 巡回車: 上向き三角形
            ctx.moveTo(cx,     cy - s);
            ctx.lineTo(cx + s, cy + s * 0.7);
            ctx.lineTo(cx - s, cy + s * 0.7);
        } else {
            // 補給車: 角丸四角形風（実際は円）
            ctx.arc(cx, cy, s, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();

        // 本体
        ctx.beginPath();
        if (kind === 0) {
            ctx.moveTo(cx,         cy - s + 2);
            ctx.lineTo(cx + s - 2, cy + s * 0.7);
            ctx.lineTo(cx - s + 2, cy + s * 0.7);
        } else {
            ctx.arc(cx, cy, s - 2, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 1;

        // エージェントID
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, hexSize * 0.28)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(agentId.toString(), cx, cy + (kind === 0 ? 2 : 0));
    }
}

// -------------------------------------------------------
// 未来経路描画（半透明の破線）
// -------------------------------------------------------
function drawFuturePaths(
    ctx: CanvasRenderingContext2D,
    state: StateManager,
    step: number,
    hexSize: number,
    getHexCenter: (pos: number) => { cx: number; cy: number }
) {
    if (!state.data.mapData) return;

    const numAgents = state.data.mapData.agents.length;

    for (let agentId = 0; agentId < numAgents; agentId++) {
        const kind = state.getAgentType(agentId, step);
        const path = state.getFuturePath(agentId, step, 5);
        if (path.length === 0) continue;

        const curPos = state.getAgentPosition(step, agentId);
        const { cx: sx, cy: sy } = getHexCenter(curPos);

        ctx.strokeStyle = kind === 0 ? PATROL_COLOR : SUPPLY_COLOR;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.5;

        ctx.beginPath();
        ctx.moveTo(sx, sy);

        path.forEach((pos, i) => {
            const { cx, cy } = getHexCenter(pos);
            ctx.lineTo(cx, cy);

            // 経路上のドット
            ctx.stroke();
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.arc(cx, cy, hexSize * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = kind === 0
                ? `rgba(59,130,246,${0.7 - i * 0.12})`
                : `rgba(34,197,94,${0.7 - i * 0.12})`;
            ctx.fill();

            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(cx, cy);
        });

        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 1;
    }
}
