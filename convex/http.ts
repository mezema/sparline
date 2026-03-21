import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// Agent posts events (corrections, reinforcement, drill completions)
http.route({
  path: "/api/sessions/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { session_id, event_type, scenario_id, data } = body;

    if (!session_id || !event_type) {
      return new Response(
        JSON.stringify({ error: "session_id and event_type are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(api.sessions.addEvent, {
      sessionId: session_id as Id<"sessions">,
      scenarioId: scenario_id ? (scenario_id as Id<"scenarios">) : undefined,
      type: event_type,
      errorType: data?.error_type ?? undefined,
      expectedText: data?.expected ?? undefined,
      actualText: data?.actual ?? undefined,
      drillRound: data?.drill_round ?? undefined,
      drillTotal: data?.drill_total ?? undefined,
      drillSuccess: data?.drill_success ?? undefined,
      timestampMs: Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Agent posts transcript entries
http.route({
  path: "/api/sessions/transcript",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { session_id, scenario_id, speaker, content, timestamp_ms, duration_ms, is_correction, is_model_phrase, was_interrupted } = body;

    if (!session_id || !speaker || !content) {
      return new Response(
        JSON.stringify({ error: "session_id, speaker, and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(api.sessions.addTranscriptEntry, {
      sessionId: session_id as Id<"sessions">,
      scenarioId: scenario_id ? (scenario_id as Id<"scenarios">) : undefined,
      speaker,
      content,
      timestampMs: timestamp_ms ?? Date.now(),
      durationMs: duration_ms ?? undefined,
      isCorrection: is_correction ?? false,
      isModelPhrase: is_model_phrase ?? false,
      wasInterrupted: was_interrupted ?? false,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Agent posts session completion
http.route({
  path: "/api/sessions/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { session_id, overall_score, correction_count, perfect_drill_count } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(api.sessions.complete, {
      id: session_id as Id<"sessions">,
      overallScore: overall_score ?? undefined,
      correctionCount: correction_count ?? 0,
      perfectDrillCount: perfect_drill_count ?? 0,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
