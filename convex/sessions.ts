import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_started", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 20);

    // Attach script and phase names
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const script = await ctx.db.get(session.scriptId);
        const phase = session.phaseId
          ? await ctx.db.get(session.phaseId)
          : null;
        return {
          ...session,
          scriptName: script?.name ?? "Unknown",
          phaseName: phase?.name ?? "Full Run",
        };
      })
    );

    return enriched;
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const script = await ctx.db.get(session.scriptId);
    const phase = session.phaseId
      ? await ctx.db.get(session.phaseId)
      : null;

    const transcript = await ctx.db
      .query("transcriptEntries")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    transcript.sort((a, b) => a.timestampMs - b.timestampMs);

    const feedback = await ctx.db
      .query("feedbackEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    feedback.sort((a, b) => a.timestampMs - b.timestampMs);

    return {
      ...session,
      scriptName: script?.name ?? "Unknown",
      phaseName: phase?.name ?? "Full Run",
      transcript,
      feedback,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    scriptId: v.id("scripts"),
    phaseId: v.optional(v.id("phases")),
    livekitRoomName: v.optional(v.string()),
    primaryFocusArea: v.optional(v.string()),
    deviceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      userId: args.userId,
      scriptId: args.scriptId,
      phaseId: args.phaseId,
      livekitRoomName: args.livekitRoomName,
      startedAt: Date.now(),
      correctionCount: 0,
      perfectDrillCount: 0,
      primaryFocusArea: args.primaryFocusArea,
      status: "active",
      deviceType: args.deviceType,
    });
  },
});

export const complete = mutation({
  args: {
    id: v.id("sessions"),
    overallScore: v.optional(v.number()),
    correctionCount: v.number(),
    perfectDrillCount: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return;

    const now = Date.now();
    const durationSeconds = Math.round((now - session.startedAt) / 1000);

    await ctx.db.patch(args.id, {
      endedAt: now,
      durationSeconds,
      overallScore: args.overallScore,
      correctionCount: args.correctionCount,
      perfectDrillCount: args.perfectDrillCount,
      status: "completed",
    });

    // Update script session count
    const script = await ctx.db.get(session.scriptId);
    if (script) {
      await ctx.db.patch(script._id, {
        sessionCount: script.sessionCount + 1,
        totalPracticeTime: script.totalPracticeTime + durationSeconds,
      });
    }

    // Update phase best score
    if (session.phaseId && args.overallScore) {
      const phase = await ctx.db.get(session.phaseId);
      if (phase) {
        const newBest =
          !phase.bestScore || args.overallScore > phase.bestScore
            ? args.overallScore
            : phase.bestScore;
        await ctx.db.patch(phase._id, {
          bestScore: newBest,
          lastPracticedAt: now,
        });
      }
    }

    // Calculate and update script average score
    if (script && args.overallScore != null) {
      const allSessions = await ctx.db
        .query("sessions")
        .withIndex("by_script", (q) => q.eq("scriptId", session.scriptId))
        .collect();
      const scored = allSessions.filter(
        (s) => s.status === "completed" && s.overallScore != null
      );
      if (scored.length > 0) {
        const avg = Math.round(
          scored.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) /
            scored.length
        );
        await ctx.db.patch(script._id, { averageScore: avg });
      }
    }

    // ─── Focus Area Scoring ───
    // Aggregate feedback events per scenario → per focus area
    const feedbackEvents = await ctx.db
      .query("feedbackEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    // Build a map of scenarioId → focusAreas by looking up scenarios
    const scenarioFocusCache = new Map<string, string[]>();
    for (const ev of feedbackEvents) {
      if (ev.scenarioId && !scenarioFocusCache.has(ev.scenarioId)) {
        const scenario = await ctx.db.get(ev.scenarioId);
        scenarioFocusCache.set(
          ev.scenarioId,
          scenario?.focusAreas ?? []
        );
      }
    }

    // Aggregate per focus area: total events and successful events
    const focusStats = new Map<
      string,
      { total: number; successful: number }
    >();
    for (const ev of feedbackEvents) {
      const areas = ev.scenarioId
        ? scenarioFocusCache.get(ev.scenarioId) ?? []
        : [];
      if (areas.length === 0) continue;

      const isSuccess =
        ev.type === "reinforcement" ||
        (ev.type === "drill_complete" && ev.drillSuccess === true);
      const isAttempt =
        ev.type === "correction" ||
        ev.type === "reinforcement" ||
        ev.type === "drill_complete";

      if (!isAttempt) continue;

      for (const area of areas) {
        const stats = focusStats.get(area) ?? { total: 0, successful: 0 };
        stats.total += 1;
        if (isSuccess) stats.successful += 1;
        focusStats.set(area, stats);
      }
    }

    // Upsert focusAreas records
    for (const [areaName, stats] of focusStats) {
      const existing = await ctx.db
        .query("focusAreas")
        .withIndex("by_user_name", (q) =>
          q.eq("userId", session.userId).eq("name", areaName)
        )
        .first();

      if (existing) {
        const newTotal = existing.totalAttempts + stats.total;
        const newSuccessful = existing.successfulAttempts + stats.successful;
        const masteryScore =
          newTotal > 0 ? Math.round((newSuccessful / newTotal) * 100) : 0;
        await ctx.db.patch(existing._id, {
          totalAttempts: newTotal,
          successfulAttempts: newSuccessful,
          masteryScore,
        });
      } else {
        const masteryScore =
          stats.total > 0
            ? Math.round((stats.successful / stats.total) * 100)
            : 0;
        await ctx.db.insert("focusAreas", {
          userId: session.userId,
          name: areaName,
          masteryScore,
          totalAttempts: stats.total,
          successfulAttempts: stats.successful,
        });
      }
    }
  },
});

export const addEvent = mutation({
  args: {
    sessionId: v.id("sessions"),
    scenarioId: v.optional(v.id("scenarios")),
    type: v.string(),
    errorType: v.optional(v.string()),
    expectedText: v.optional(v.string()),
    actualText: v.optional(v.string()),
    drillRound: v.optional(v.number()),
    drillTotal: v.optional(v.number()),
    drillSuccess: v.optional(v.boolean()),
    timestampMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("feedbackEvents", {
      sessionId: args.sessionId,
      scenarioId: args.scenarioId,
      type: args.type,
      errorType: args.errorType,
      expectedText: args.expectedText,
      actualText: args.actualText,
      drillRound: args.drillRound,
      drillTotal: args.drillTotal,
      drillSuccess: args.drillSuccess,
      timestampMs: args.timestampMs,
    });

    // Update session correction count if it's a correction
    if (args.type === "correction") {
      const session = await ctx.db.get(args.sessionId);
      if (session) {
        await ctx.db.patch(args.sessionId, {
          correctionCount: session.correctionCount + 1,
        });
      }
    }
  },
});

// ─── Real-time queries for live practice session ───

/** Live transcript entries for a session (used by frontend via useQuery) */
export const getLiveTranscript = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("transcriptEntries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    entries.sort((a, b) => a.timestampMs - b.timestampMs);
    return entries;
  },
});

/** Live feedback events for a session (corrections, drills, reinforcement) */
export const getLiveFeedback = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("feedbackEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    events.sort((a, b) => a.timestampMs - b.timestampMs);
    return events;
  },
});

/** Live session stats (correction count, drill count, status) */
export const getSessionStats = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    return {
      correctionCount: session.correctionCount,
      perfectDrillCount: session.perfectDrillCount,
      status: session.status,
      overallScore: session.overallScore,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
    };
  },
});

/** Get previous session's score for the same script (for computing score delta) */
export const getPreviousScore = query({
  args: {
    userId: v.id("users"),
    scriptId: v.id("scripts"),
    currentSessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_started", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);
    const prev = sessions.find(
      (s) =>
        s._id !== args.currentSessionId &&
        s.scriptId === args.scriptId &&
        s.status === "completed" &&
        s.overallScore != null
    );
    return prev?.overallScore ?? null;
  },
});

export const addTranscriptEntry = mutation({
  args: {
    sessionId: v.id("sessions"),
    scenarioId: v.optional(v.id("scenarios")),
    speaker: v.string(),
    content: v.string(),
    timestampMs: v.number(),
    durationMs: v.optional(v.number()),
    isCorrection: v.boolean(),
    isModelPhrase: v.boolean(),
    wasInterrupted: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transcriptEntries", args);
  },
});
