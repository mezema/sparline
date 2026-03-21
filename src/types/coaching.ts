export type CoachingState =
  | "pre_session"
  | "listening"
  | "interrupted"
  | "modeling"
  | "user_repeat"
  | "drilling"
  | "reinforcing"
  | "transitioning"
  | "paused"
  | "wrapping_up"
  | "completed";

export interface DrillProgress {
  targetPhrase: string;
  currentRound: number;
  totalRounds: number;
  successfulRounds: number;
}

export interface SessionContext {
  scriptId: string;
  scriptName: string;
  phaseId: string;
  phaseName: string;
  scenarioIndex: number;
  totalScenarios: number;
  currentScenarioName: string;
  focusArea: string | null;
}

export interface CoachingEvent {
  type: "state_change" | "correction" | "reinforcement" | "drill_update" | "scenario_advance";
  state?: CoachingState;
  message?: string;
  correctPhrase?: string;
  drill?: DrillProgress;
  scenarioIndex?: number;
}
