export interface Script {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  rawContent: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalPracticeTime: number;
  averageScore: number | null;
  sessionCount: number;
  phases?: Phase[];
}

export interface Phase {
  id: string;
  scriptId: string;
  name: string;
  description: string | null;
  order: number;
  aiContext: string | null;
  estimatedMinutes: number | null;
  bestScore: number | null;
  lastPracticedAt: Date | null;
  scenarios?: Scenario[];
}

export interface Scenario {
  id: string;
  phaseId: string;
  name: string;
  order: number;
  context: string;
  characterBehavior: string | null;
  openingLine: string | null;
  expectedResponses: string[];
  successCriteria: string | null;
  commonMistakes: string[];
  focusAreas: string[];
}

export interface ParsedScript {
  title: string;
  description?: string;
  phases: ParsedPhase[];
}

export interface ParsedPhase {
  name: string;
  description: string;
  aiContext: string;
  estimatedMinutes: number;
  scenarios: ParsedScenario[];
}

export interface ParsedScenario {
  name: string;
  context: string;
  characterBehavior: string;
  openingLine: string;
  expectedResponses: string[];
  successCriteria: string;
  commonMistakes: string[];
  focusAreas: string[];
}
