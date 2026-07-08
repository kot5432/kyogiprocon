export interface MapData {
    startsAt: number;
    daySeconds: number[];
    daySteps: number[];
    map: {
        height: number;
        width: number;
        cells: number[][];
    };
    spots: {
        brand: number;
        pos: number;
        stocks: number;
    }[];
    agents: number[];
    fuelLimits: number;
    players: number;
    busyThreshold: number;
    jammedThreshold: number;
}

export interface AgentInfo {
    kind: number; // 0: patrol, 1: supply
    pos: number;
    fuel: number;
}

export interface OtherTeam {
    id: number;
    agents: AgentInfo[];
}

export interface TrafficInfo {
    pos: number;
    status: number;
}

export interface DayInfo {
    endsAt: number;
    day: number;
    agents: AgentInfo[];
    others: OtherTeam[];
    traffics: TrafficInfo[];
}

export type AgentTypes = number[]; // 0: patrol, 1: supply
export type ActionPlan = number[][]; // [agentIndex][step] -- -1=wait, 0~5=move

// AI decision reasoning
export interface DecisionReason {
    targetPos?: number; // Target position
    currentFuel: number;
    expectedScore: number;
    reason: string;
    alternatives?: AlternativeAction[];
}

export interface AlternativeAction {
    action: number; // -1 for wait, 0-5 for move
    score: number;
    reason: string;
}

// Heatmap value for each hex cell
export interface HeatmapData {
    pos: number;
    value: number; // 0-1, higher = more valuable
}

// Score history for graph
export interface ScoreHistory {
    turn: number;
    ourScore: number;
    opponentScore: number;
}

// Udon gain tracking per agent per day
export interface UdonGain {
    agentId: number;
    day: number;
    spotPos: number;
    turn: number;
}

// Turn log entry
export interface TurnLog {
    turn: number;
    agentActions: AgentAction[];
    events: LogEvent[];
}

export interface AgentAction {
    agentId: number;
    actionType: 'move' | 'wait';
    direction?: number; // 0-5 for move
    targetPos?: number; // destination position for move
    fuelConsumed: number;
    udonGained: boolean;
    fuelRefueled: boolean;
}

export interface LogEvent {
    type: 'udon' | 'refuel' | 'fuel_warning' | 'spot_empty';
    agentId?: number;
    pos?: number;
    description: string;
}

// Extended day info with AI analysis
export interface ExtendedDayInfo extends DayInfo {
    decisions?: DecisionReason[]; // AI decisions for each agent
    heatmap?: HeatmapData[]; // Cell evaluation values
    scoreHistory?: ScoreHistory; // Score at this turn
}

export interface VisualizerData {
    mapData: MapData | null;
    agentTypes: AgentTypes | null;
    days: {
        info: DayInfo;
        actions: ActionPlan | null;
        extendedInfo?: ExtendedDayInfo; // AI analysis data
    }[];
    scoreHistory?: ScoreHistory[]; // Complete score history
}
