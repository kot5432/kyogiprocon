import type { VisualizerData } from './types';

export class StateManager {
    data: VisualizerData;

    constructor(data: VisualizerData) {
        this.data = data;
    }

    // Convert 1D pos to 2D (col, row)
    getPos2D(pos: number) {
        if (!this.data.mapData) return { col: 0, row: 0 };
        const w = this.data.mapData.map.width;
        return {
            col: pos % w,
            row: Math.floor(pos / w)
        };
    }

    // Pointy-topped hex, assuming "odd-r" (odd rows shifted right)
    // 0: top-left, 1: top-right, 2: right, 3: bottom-right, 4: bottom-left, 5: left
    getNeighbor(col: number, row: number, dir: number) {
        const isOdd = row % 2 !== 0;
        const diffs = isOdd ? [
            { c: 0, r: -1 }, // 0: TL
            { c: 1, r: -1 }, // 1: TR
            { c: 1, r: 0 },  // 2: R
            { c: 1, r: 1 },  // 3: BR
            { c: 0, r: 1 },  // 4: BL
            { c: -1, r: 0 }  // 5: L
        ] : [
            { c: -1, r: -1 }, // 0: TL
            { c: 0, r: -1 }, // 1: TR
            { c: 1, r: 0 },  // 2: R
            { c: 0, r: 1 },  // 3: BR
            { c: -1, r: 1 },  // 4: BL
            { c: -1, r: 0 }  // 5: L
        ];

        const d = diffs[dir];
        if (!d) return { col, row }; // invalid dir (e.g. -1 for wait)
        return { col: col + d.c, row: row + d.r };
    }

    getTotalSteps() {
        if (!this.data.mapData) return 0;
        return this.data.mapData.daySteps.reduce((a, b) => a + b, 0);
    }
}
