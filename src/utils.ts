import type { HeatmapData, MapData } from './types';

/**
 * Calculate heatmap values based on remaining stocks and distance
 */
export function calculateHeatmap(
    mapData: MapData,
    agentPositions: number[],
    fuelLimits: number
): HeatmapData[] {
    const heatmap: HeatmapData[] = [];
    const { width, height, cells } = mapData.map;
    const totalCells = width * height;

    for (let pos = 0; pos < totalCells; pos++) {
        const col = pos % width;
        const row = Math.floor(pos / width);
        const cellType = cells[row]?.[col] ?? 0;

        // Skip obstacles (mountains, ponds)
        if (cellType === 2 || cellType === 3) {
            heatmap.push({ pos, value: 0 });
            continue;
        }

        // Find nearest spot
        const spot = mapData.spots.find(s => s.pos === pos);
        let value = 0;

        if (spot && spot.stocks > 0) {
            // Value based on stocks
            value = Math.min(1, spot.stocks / 10);
        }

        // Adjust based on distance from agents
        let minDistance = Infinity;
        agentPositions.forEach(agentPos => {
            const distance = hexDistance(pos, agentPos, width);
            if (distance < minDistance) {
                minDistance = distance;
            }
        });

        if (minDistance !== Infinity) {
            // Closer positions have higher value
            const distanceFactor = Math.max(0, 1 - minDistance / fuelLimits);
            value = value * 0.7 + distanceFactor * 0.3;
        }

        heatmap.push({ pos, value });
    }

    return heatmap;
}

/**
 * Calculate Manhattan-like distance between two hex positions
 */
export function hexDistance(pos1: number, pos2: number, width: number): number {
    const col1 = pos1 % width;
    const row1 = Math.floor(pos1 / width);
    const col2 = pos2 % width;
    const row2 = Math.floor(pos2 / width);

    const dx = col1 - col2;
    const dy = row1 - row2;

    // Hex distance formula for odd-r offset coordinates
    const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy - (row1 % 2));
    return Math.floor(dist / 2);
}

/**
 * Get direction name from direction code
 */
export function getDirectionName(dir: number): string {
    const directions = ['北西', '北東', '東', '南東', '南西', '西'];
    return directions[dir] || '待機';
}

/**
 * Format fuel percentage with color class
 */
export function getFuelClass(percentage: number): string {
    if (percentage > 50) return 'high';
    if (percentage > 20) return 'medium';
    if (percentage > 0) return 'low';
    return 'critical';
}

/**
 * Generate decision reasoning text
 */
export function generateDecisionReason(
    target: string,
    fuel: number,
    fuelLimit: number,
    expectedScore: number,
    reasons: string[]
): string {
    const fuelPercent = Math.round((fuel / fuelLimit) * 100);
    return `
目的地: ${target}
燃料: ${fuel}/${fuelLimit} (${fuelPercent}%)
期待得点: ${expectedScore}
理由:
${reasons.map(r => `  • ${r}`).join('\n')}
    `.trim();
}

/**
 * Parse action from action code
 */
export function parseAction(action: number): { type: string; direction?: string } {
    if (action === -1) {
        return { type: 'wait' };
    }
    return {
        type: 'move',
        direction: getDirectionName(action)
    };
}

/**
 * Calculate score change between two turns
 */
export function calculateScoreChange(
    currentScore: number,
    previousScore: number
): number {
    return currentScore - previousScore;
}

/**
 * Format turn number for display
 */
export function formatTurn(turn: number): string {
    return `Turn ${turn}`;
}

/**
 * Check if fuel is critical (will run out next turn)
 */
export function isFuelCritical(fuel: number): boolean {
    return fuel <= 1;
}

/**
 * Get agent type name
 */
export function getAgentTypeName(type: number): string {
    return type === 0 ? '巡回車' : '補給車';
}

/**
 * Get agent type emoji
 */
export function getAgentTypeEmoji(type: number): string {
    return type === 0 ? '🔵' : '🟢';
}
