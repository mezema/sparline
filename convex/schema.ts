import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    prefersDarkMode: v.optional(v.boolean()),
    defaultVoice: v.optional(v.string()),
    coachingIntensity: v.optional(v.string()),
  }).index("by_email", ["email"]),

  scripts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    rawContent: v.optional(v.string()),
    isActive: v.boolean(),
    totalPracticeTime: v.number(),
    averageScore: v.optional(v.number()),
    sessionCount: v.number(),
  }).index("by_user", ["userId"]),

  phases: defineTable({
    scriptId: v.id("scripts"),
    name: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    aiContext: v.optional(v.string()),
    estimatedMinutes: v.optional(v.number()),
    bestScore: v.optional(v.number()),
    lastPracticedAt: v.optional(v.number()),
  }).index("by_script", ["scriptId"]),

  scenarios: defineTable({
    phaseId: v.id("phases"),
    name: v.string(),
    order: v.number(),
    context: v.string(),
    characterBehavior: v.optional(v.string()),
    openingLine: v.optional(v.string()),
    expectedResponses: v.array(v.string()),
    successCriteria: v.optional(v.string()),
    commonMistakes: v.array(v.string()),
    focusAreas: v.array(v.string()),
  }).index("by_phase", ["phaseId"]),

  focusAreas: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    masteryScore: v.number(),
    totalAttempts: v.number(),
    successfulAttempts: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  sessions: defineTable({
    userId: v.id("users"),
    scriptId: v.id("scripts"),
    phaseId: v.optional(v.id("phases")),
    livekitRoomName: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    correctionCount: v.number(),
    perfectDrillCount: v.number(),
    primaryFocusArea: v.optional(v.string()),
    status: v.string(),
    lastScenarioId: v.optional(v.id("scenarios")),
    deviceType: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_script", ["scriptId"])
    .index("by_user_started", ["userId", "startedAt"]),

  transcriptEntries: defineTable({
    sessionId: v.id("sessions"),
    scenarioId: v.optional(v.id("scenarios")),
    speaker: v.string(),
    content: v.string(),
    timestampMs: v.number(),
    durationMs: v.optional(v.number()),
    isCorrection: v.boolean(),
    isModelPhrase: v.boolean(),
    wasInterrupted: v.boolean(),
  }).index("by_session", ["sessionId"]),

  feedbackEvents: defineTable({
    sessionId: v.id("sessions"),
    scenarioId: v.optional(v.id("scenarios")),
    transcriptEntryId: v.optional(v.id("transcriptEntries")),
    type: v.string(),
    errorType: v.optional(v.string()),
    expectedText: v.optional(v.string()),
    actualText: v.optional(v.string()),
    focusAreaId: v.optional(v.id("focusAreas")),
    drillRound: v.optional(v.number()),
    drillTotal: v.optional(v.number()),
    drillSuccess: v.optional(v.boolean()),
    timestampMs: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_type", ["type"]),
});
