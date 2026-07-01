import type { ScoreHistory, VisualizerData } from './types';

export class StateManager {
    data: VisualizerData;
    private agentPositions: number[][] = []; // Track positions per turn
    private agentFuels: number[][] = []; // Track fuel per turn

    constructor(data: VisualizerData) {
        this.data = data;
        this.initializeTracking();
    }

    private initializeTracking() {
        if (!this.data.mapData) return;

        const numAgents = this.data.mapData.agents.length;
        const totalSteps = this.getTotalSteps();

        // Initialize tracking arrays
        this.agentPositions = Array(totalSteps + 1).fill(null).map(() => 
            Array(numAgents).fill(0)
        );
        this.agentFuels = Array(totalSteps + 1).fill(null).map(() => 
            Array(numAgents).fill(0)
        );

        // Set initial positions and fuel from day 0 or map data
        if (this.data.days.length > 0 && this.data.days[0].info.agents) {
            this.data.days[0].info.agents.forEach((agent, i) => {
                this.agentPositions[0][i] = agent.pos;
                this.agentFuels[0][i] = agent.fuel;
            });
        } else {
            // Fallback to map data
            this.data.mapData.agents.forEach((pos, i) => {
                this.agentPositions[0][i] = pos;
                this.agentFuels[0][i] = this.data.mapData!.fuelLimits;
            });
        }

        // Simulate movement to track positions
        this.simulateMovement();
    }

    private simulateMovement() {
        if (!this.data.mapData) return;

        const numAgents = this.data.mapData.agents.length;

        for (let dayIdx = 0; dayIdx < this.data.days.length; dayIdx++) {
            const day = this.data.days[dayIdx];
            const actions = day.actions;

            if (!actions) continue;

            const dayStartStep = this.getDayStartStep(dayIdx);
            const daySteps = this.data.mapData.daySteps[dayIdx] || 0;

            for (let step = 0; step < daySteps; step++) {
                const globalStep = dayStartStep + step;
                const prevStep = globalStep - 1;

                for (let agentId = 0; agentId < numAgents; agentId++) {
                    // Copy previous state
                    this.agentPositions[globalStep][agentId] = this.agentPositions[prevStep][agentId];
                    this.agentFuels[globalStep][agentId] = this.agentFuels[prevStep][agentId];

                    // Apply action if available
                    if (actions[agentId] && actions[agentId][step] !== undefined) {
                        const action = actions[agentId][step];
                        
                        if (action >= 0 && action <= 5) {
                            // Movement action
                            const { col, row } = this.getPos2D(this.agentPositions[prevStep][agentId]);
                            const newPos = this.getNeighbor(col, row, action);
                            const newPos1D = newPos.row * this.data.mapData!.map.width + newPos.col;
                            
                            this.agentPositions[globalStep][agentId] = newPos1D;
                            this.agentFuels[globalStep][agentId] = Math.max(0, this.agentFuels[prevStep][agentId] - 1);
                        }
                        // -1 is wait, no change
                    }
                }
            }
        }
    }

    private getDayStartStep(dayIdx: number): number {
        if (!this.data.mapData) return 0;
        let start = 0;
        for (let i = 0; i < dayIdx; i++) {
            start += this.data.mapData.daySteps[i] || 0;
        }
        return start;
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

    getAgentPosition(step: number, agentId: number): number {
        if (step >= this.agentPositions.length) return this.data.mapData?.agents[agentId] || 0;
        return this.agentPositions[step][agentId];
    }

    getAgentFuel(step: number, agentId: number): number {
        if (step >= this.agentFuels.length) return 0;
        return this.agentFuels[step][agentId];
    }

    getAgentType(agentId: number, step: number = 0): number {
        // Try to get from day info first (actual data format)
        const dayIndex = this.getDayIndexFromStep(step);
        const day = this.data.days[dayIndex];
        if (day?.info?.agents?.[agentId]) {
            return day.info.agents[agentId].kind;
        }
        // Fallback to agentTypes array
        if (this.data.agentTypes) {
            return this.data.agentTypes[agentId] || 0;
        }
        return 0;
    }

    private getDayIndexFromStep(step: number): number {
        if (!this.data.mapData) return 0;
        let accumulated = 0;
        for (let i = 0; i < this.data.mapData.daySteps.length; i++) {
            accumulated += this.data.mapData.daySteps[i];
            if (step < accumulated) return i;
        }
        return this.data.mapData.daySteps.length - 1;
    }

    getFuelLimit(): number {
        return this.data.mapData?.fuelLimits || 20;
    }

    getScoreHistory(): ScoreHistory[] {
        return this.data.scoreHistory || [];
    }

    getCurrentScore(step: number): { ourScore: number; opponentScore: number } {
        const history = this.getScoreHistory();
        const current = history.find(h => h.turn === step) || history[history.length - 1];
        return {
            ourScore: current?.ourScore || 0,
            opponentScore: current?.opponentScore || 0
        };
    }

    // Get future path for an agent (next N steps)
    getFuturePath(agentId: number, fromStep: number, lookAhead: number = 5): number[] {
        const path: number[] = [];
        const totalSteps = this.getTotalSteps();

        for (let i = 1; i <= lookAhead && fromStep + i <= totalSteps; i++) {
            path.push(this.getAgentPosition(fromStep + i, agentId));
        }

        return path;
    }
}
