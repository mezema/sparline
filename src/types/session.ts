export type SessionStatus = "active" | "paused" | "completed" | "abandoned";

export type FeedbackEventType =
  | "interruption"
  | "correction"
  | "positive_reinforcement"
  | "drill_complete";

export type ErrorType =
  | "wrong_phrase"
  | "missed_benefit"
  | "wrong_tone"
  | "skipped_step"
  | "filler_words";

export interface Session {
  id: string;
  userId: string;
  scriptId: string;
  phaseId: string | null;
  livekitRoomName: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  overallScore: number | null;
  correctionCount: number;
  perfectDrillCount: number;
  primaryFocusArea: string | null;
  status: SessionStatus;
  lastScenarioId: string | null;
  deviceType: string | null;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  scenarioId: string | null;
  speaker: "user" | "ai";
  content: string;
  timestampMs: number;
  durationMs: number | null;
  isCorrection: boolean;
  isModelPhrase: boolean;
  wasInterrupted: boolean;
}

export interface FeedbackEvent {
  id: string;
  sessionId: string;
  scenarioId: string | null;
  transcriptEntryId: string | null;
  type: FeedbackEventType;
  errorType: ErrorType | null;
  expectedText: string | null;
  actualText: string | null;
  focusAreaId: string | null;
  drillRound: number | null;
  drillTotal: number | null;
  drillSuccess: boolean | null;
  timestampMs: number;
  createdAt: Date;
}
