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

export interface VisualizerData {
    mapData: MapData | null;
    agentTypes: AgentTypes | null;
    days: {
        info: DayInfo;
        actions: ActionPlan | null;
    }[];
}
