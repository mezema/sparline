import { v } from "convex/values";
import { query } from "./_generated/server";

export const getOverview = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all sessions for user
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");

    // Overall average score
    const scoredSessions = completedSessions.filter(
      (s) => s.overallScore != null
    );
    const averageScore =
      scoredSessions.length > 0
        ? Math.round(
            scoredSessions.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) /
              scoredSessions.length
          )
        : null;

    // This week's sessions
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekSessions = completedSessions.filter(
      (s) => s.startedAt > oneWeekAgo
    );
    const thisWeekScored = thisWeekSessions.filter(
      (s) => s.overallScore != null
    );
    const thisWeekAvg =
      thisWeekScored.length > 0
        ? Math.round(
            thisWeekScored.reduce(
              (sum, s) => sum + (s.overallScore ?? 0),
              0
            ) / thisWeekScored.length
          )
        : null;

    // Last week comparison
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const lastWeekSessions = completedSessions.filter(
      (s) => s.startedAt > twoWeeksAgo && s.startedAt <= oneWeekAgo
    );
    const lastWeekScored = lastWeekSessions.filter(
      (s) => s.overallScore != null
    );
    const lastWeekAvg =
      lastWeekScored.length > 0
        ? Math.round(
            lastWeekScored.reduce(
              (sum, s) => sum + (s.overallScore ?? 0),
              0
            ) / lastWeekScored.length
          )
        : null;

    const scoreChange =
      thisWeekAvg != null && lastWeekAvg != null
        ? thisWeekAvg - lastWeekAvg
        : null;

    // Streak calculation (consecutive days with at least one session)
    const daySet = new Set(
      completedSessions.map((s) => {
        const d = new Date(s.startedAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    // Total practice time
    const totalPracticeTime = completedSessions.reduce(
      (sum, s) => sum + (s.durationSeconds ?? 0),
      0
    );

    return {
      averageScore,
      thisWeekAvg,
      scoreChange,
      streak,
      totalSessions: completedSessions.length,
      totalPracticeTime,
      thisWeekSessions: thisWeekSessions.length,
    };
  },
});

export const getFocusAreas = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const areas = await ctx.db
      .query("focusAreas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by mastery score ascending (weakest first)
    return areas.sort((a, b) => a.masteryScore - b.masteryScore);
  },
});

export const getScoreHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_started", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    const scored = sessions
      .filter((s) => s.status === "completed" && s.overallScore != null)
      .reverse(); // Chronological order (oldest first)

    return scored.map((s) => ({
      date: new Date(s.startedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: s.overallScore!,
    }));
  },
});

export const getCommonMistakes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get user's sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get all correction events
    const corrections: { errorType: string }[] = [];
    for (const session of sessions) {
      const events = await ctx.db
        .query("feedbackEvents")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      corrections.push(
        ...events
          .filter((e) => e.type === "correction" && e.errorType)
          .map((e) => ({ errorType: e.errorType! }))
      );
    }

    // Count by error type
    const counts = corrections.reduce(
      (acc, c) => {
        acc[c.errorType] = (acc[c.errorType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Map raw error type codes to human-readable labels
    const errorLabels: Record<string, string> = {
      wrong_phrase: "Wrong phrase",
      missing_element: "Missing key element",
      wrong_order: "Wrong order",
      filler_words: "Filler words",
      wrong_tone: "Wrong tone",
      off_script: "Off script",
    };

    return Object.entries(counts)
      .map(([type, count]) => ({
        text: errorLabels[type] ?? type.replace(/_/g, " "),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  },
});

export const getRecommendation = query({
  args: {
    userId: v.id("users"),
    scriptId: v.id("scripts"),
  },
  handler: async (ctx, args) => {
    // Get all phases for the script
    const phases = await ctx.db
      .query("phases")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    phases.sort((a, b) => a.order - b.order);

    if (phases.length === 0) return null;

    // Find the first unpracticed phase
    const unpracticed = phases.find((p) => p.bestScore == null);
    if (unpracticed) {
      return {
        phaseId: unpracticed._id,
        phaseName: unpracticed.name,
        reason: "You haven't practiced this phase yet",
        scriptId: args.scriptId,
      };
    }

    // Otherwise, find the lowest-scoring phase
    const lowestPhase = phases.reduce((min, p) => {
      if (p.bestScore == null) return min;
      if (min.bestScore == null) return p;
      return p.bestScore < min.bestScore ? p : min;
    }, phases[0]);

    return {
      phaseId: lowestPhase._id,
      phaseName: lowestPhase.name,
      reason: `Lowest score at ${lowestPhase.bestScore}%`,
      scriptId: args.scriptId,
    };
  },
});
