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

    /**
     * アクションプランの圧縮形式を1ステップ=1要素の配列に展開する
     * 仕様: 負の値 -N はNステップ待機、0-5は移動方向（1ステップ消費）
     * 例: [-15] → [wait,wait,...,wait] (15個)
     *     [0, 1, -10] → [move0, move1, wait, wait, ..., wait] (12個)
     */
    private expandActions(compressed: number[], totalSteps: number): number[] {
        const expanded: number[] = [];
        for (const cmd of compressed) {
            if (cmd <= -1) {
                // 負の値: |cmd| ステップ待機
                const waitSteps = Math.abs(cmd);
                for (let i = 0; i < waitSteps; i++) expanded.push(-1);
            } else {
                // 0-5: 1ステップ移動
                expanded.push(cmd);
            }
            if (expanded.length >= totalSteps) break;
        }
        // 残りは待機で埋める
        while (expanded.length < totalSteps) expanded.push(-1);
        return expanded;
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

            // アクションを圧縮形式からステップごとに展開
            const expandedActions: number[][] = actions.map(agentActions =>
                this.expandActions(agentActions, daySteps)
            );

            for (let step = 0; step < daySteps; step++) {
                const globalStep = dayStartStep + step;
                const prevStep = globalStep - 1;

                for (let agentId = 0; agentId < numAgents; agentId++) {
                    // 前ステップの状態をコピー
                    this.agentPositions[globalStep][agentId] = this.agentPositions[prevStep][agentId];
                    this.agentFuels[globalStep][agentId] = this.agentFuels[prevStep][agentId];

                    const action = expandedActions[agentId]?.[step] ?? -1;

                    if (action >= 0 && action <= 5) {
                        // 移動命令: 隣接セルに移動・燃料消費
                        const { col, row } = this.getPos2D(this.agentPositions[prevStep][agentId]);
                        const newPos = this.getNeighbor(col, row, action);
                        const mapW = this.data.mapData!.map.width;
                        const mapH = this.data.mapData!.map.height;

                        // 範囲内チェック
                        if (
                            newPos.col >= 0 && newPos.col < mapW &&
                            newPos.row >= 0 && newPos.row < mapH
                        ) {
                            const newPos1D = newPos.row * mapW + newPos.col;
                            const cellType = this.data.mapData!.map.cells[newPos.row]?.[newPos.col] ?? 3;
                            // 池(3)には進入不可
                            if (cellType !== 3) {
                                this.agentPositions[globalStep][agentId] = newPos1D;
                                // 巡回車のみ燃料消費（補給車は燃料不要）
                                const kind = this.getAgentKind(agentId, dayIdx);
                                if (kind === 0) {
                                    const fuelCost = cellType === 2 ? 2 : 1; // 山地=2, 平地/道路=1
                                    this.agentFuels[globalStep][agentId] = Math.max(
                                        0,
                                        this.agentFuels[prevStep][agentId] - fuelCost
                                    );
                                }
                            }
                        }
                    }
                    // 待機(-1): 位置・燃料変化なし
                }
            }
        }
    }

    /** エージェントの種別を取得（0:巡回車, 1:補給車）dayIdx優先 */
    private getAgentKind(agentId: number, dayIdx: number): number {
        const day = this.data.days[dayIdx];
        if (day?.info?.agents?.[agentId] !== undefined) {
            return day.info.agents[agentId].kind;
        }
        return this.data.agentTypes?.[agentId] ?? 0;
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

    /**
     * 隣接セルの座標を返す（Q47準拠）
     * 方向: 0=左上, 1=右上, 2=右, 3=右下, 4=左下, 5=左
     *
     * コンテストマップは「odd-r」オフセット座標系（奇数行が右へ0.5ずれる）
     * 偶数行と奇数行で隣接セルのdcolが変わる
     */
    getNeighbor(col: number, row: number, dir: number): { col: number; row: number } {
        // 偶数行(row%2===0)は左寄り、奇数行(row%2!==0)は右寄り
        const isOdd = row % 2 !== 0;
        //
        //   偶数行のセル配置:          奇数行のセル配置:
        //   TL(-1,-1) TR(0,-1)          TL(0,-1) TR(1,-1)
        //         [col,row]                   [col,row]
        //   BL(-1,+1) BR(0,+1)          BL(0,+1) BR(1,+1)
        //
        const diffs = isOdd
            ? [
                { c: 0,  r: -1 }, // 0: 左上 (TL)
                { c: 1,  r: -1 }, // 1: 右上 (TR)
                { c: 1,  r:  0 }, // 2: 右   (R)
                { c: 1,  r: +1 }, // 3: 右下 (BR)
                { c: 0,  r: +1 }, // 4: 左下 (BL)
                { c: -1, r:  0 }, // 5: 左   (L)
            ]
            : [
                { c: -1, r: -1 }, // 0: 左上 (TL)
                { c: 0,  r: -1 }, // 1: 右上 (TR)
                { c: 1,  r:  0 }, // 2: 右   (R)
                { c: 0,  r: +1 }, // 3: 右下 (BR)
                { c: -1, r: +1 }, // 4: 左下 (BL)
                { c: -1, r:  0 }, // 5: 左   (L)
            ];

        const d = diffs[dir];
        if (!d) return { col, row };
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
