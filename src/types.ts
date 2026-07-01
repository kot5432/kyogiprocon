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
    kind: number;
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
    target: string; // e.g., "Spot 14" or "Supply at pos 42"
    reasons: string[]; // List of reasoning points
    expectedScore?: number;
    fuelCost?: number;
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

// Turn log entry
export interface TurnLog {
    turn: number;
    agentActions: { agentId: number; action: string; direction?: string }[];
    events: { type: string; value: number; description: string }[];
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
