"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const PARSE_PROMPT = `You are a script parser for a sales training practice app. Analyze the following script and extract its structure.

Extract:
1. PHASES - Major sections/stages of the script (e.g., "Warm-Up", "Getting Past Front Desk", "Discovery", "Demo", "Objections", "Closing")
2. SCENARIOS - Individual practice situations within each phase
3. For each scenario:
   - context: The situation setup (what's happening)
   - character_behavior: How the AI practice partner should act (personality, resistance level, etc.)
   - opening_line: What the AI says to start this scenario
   - expected_responses: Array of acceptable response variations the user should say
   - success_criteria: What makes a response correct
   - common_mistakes: What users typically do wrong here
   - focus_areas: Skills being tested (e.g., "credential intro", "benefit statement", "scarcity close")

Output ONLY valid JSON matching this schema:
{
  "title": "string",
  "description": "string",
  "phases": [{
    "name": "string",
    "description": "string",
    "ai_context": "string (instructions for how the AI coach should behave during this entire phase)",
    "estimated_minutes": number,
    "scenarios": [{
      "name": "string",
      "context": "string",
      "character_behavior": "string",
      "opening_line": "string",
      "expected_responses": ["string"],
      "success_criteria": "string",
      "common_mistakes": ["string"],
      "focus_areas": ["string"]
    }]
  }]
}

Be thorough. Extract every distinct scenario you can identify. For expected_responses, include the core response plus reasonable variations. For common_mistakes, think about what a novice would likely do wrong.`;

// ─── Shared GPT parsing helper ───

type PhaseData = {
  name: string;
  description?: string;
  ai_context?: string;
  estimated_minutes?: number;
  scenarios?: Array<{
    name: string;
    context: string;
    character_behavior?: string;
    opening_line?: string;
    expected_responses?: string[];
    success_criteria?: string;
    common_mistakes?: string[];
    focus_areas?: string[];
  }>;
};

async function _parseWithOpenAI(name: string, content: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PARSE_PROMPT },
        {
          role: "user",
          content: `Script name: ${name}\n\nScript content:\n${content}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenAI error:", err);
    throw new Error("Failed to parse script");
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  const phases = (parsed.phases || []).map(
    (phase: PhaseData, i: number) => ({
      name: phase.name,
      description: phase.description,
      aiContext: phase.ai_context,
      estimatedMinutes: phase.estimated_minutes,
      order: i,
      scenarios: (phase.scenarios || []).map(
        (
          s: {
            name: string;
            context: string;
            character_behavior?: string;
            opening_line?: string;
            expected_responses?: string[];
            success_criteria?: string;
            common_mistakes?: string[];
            focus_areas?: string[];
          },
          j: number
        ) => ({
          name: s.name,
          order: j,
          context: s.context,
          characterBehavior: s.character_behavior,
          openingLine: s.opening_line,
          expectedResponses: s.expected_responses || [],
          successCriteria: s.success_criteria,
          commonMistakes: s.common_mistakes || [],
          focusAreas: s.focus_areas || [],
        })
      ),
    })
  );

  return { parsed, phases };
}

export const parseScript = action({
  args: {
    name: v.string(),
    content: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({
    scriptId: v.id("scripts"),
    parsed: v.any(),
  }),
  handler: async (ctx, args): Promise<{ scriptId: Id<"scripts">; parsed: any }> => {
    const { parsed, phases } = await _parseWithOpenAI(args.name, args.content);

    const scriptId = await ctx.runMutation(api.scripts.create, {
      userId: args.userId,
      name: parsed.title || args.name,
      description: parsed.description,
      rawContent: args.content,
      phases,
    });

    return { scriptId, parsed };
  },
});

export const updateScript = action({
  args: {
    id: v.id("scripts"),
    name: v.string(),
    content: v.string(),
  },
  returns: v.object({
    scriptId: v.id("scripts"),
    parsed: v.any(),
  }),
  handler: async (ctx, args): Promise<{ scriptId: Id<"scripts">; parsed: any }> => {
    const { parsed, phases } = await _parseWithOpenAI(args.name, args.content);

    await ctx.runMutation(api.scripts.update, {
      id: args.id,
      name: parsed.title || args.name,
      description: parsed.description,
      rawContent: args.content,
      phases,
    });

    return { scriptId: args.id, parsed };
  },
});

export const generateLivekitToken = action({
  args: {
    sessionId: v.string(),
    scriptId: v.id("scripts"),
    phaseId: v.optional(v.id("phases")),
    convexSessionId: v.optional(v.id("sessions")),
  },
  returns: v.object({
    token: v.string(),
    url: v.string(),
    roomName: v.string(),
  }),
  handler: async (ctx, args): Promise<{ token: string; url: string; roomName: string }> => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new Error("LiveKit not configured");
    }

    // Fetch script and phase data for room metadata
    const script = await ctx.runQuery(api.scripts.get, { id: args.scriptId });
    if (!script) throw new Error("Script not found");

    // Find the specific phase if provided
    let phaseData = null;
    if (args.phaseId) {
      phaseData = script.phases.find(
        (p: { _id: string }) => p._id === args.phaseId
      );
    }

    const roomName = `session-${args.sessionId}`;
    const participantIdentity = `user-${Date.now()}`;

    // Build room metadata (this is what the Python agent reads via room.metadata)
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    const roomMetadata = JSON.stringify({
      session_id: args.sessionId,
      convex_session_id: args.convexSessionId ?? null,
      convex_site_url: convexSiteUrl ?? null,
      script: {
        id: args.scriptId,
        name: script.name,
      },
      phase: phaseData
        ? {
            id: args.phaseId,
            name: phaseData.name,
            scenarios: phaseData.scenarios.map(
              (s: {
                _id: string;
                name: string;
                context: string;
                characterBehavior?: string;
                openingLine?: string;
                expectedResponses: string[];
                successCriteria?: string;
                commonMistakes: string[];
                focusAreas: string[];
              }) => ({
                _id: s._id,
                name: s.name,
                context: s.context,
                character_behavior: s.characterBehavior,
                opening_line: s.openingLine,
                expected_responses: s.expectedResponses,
                success_criteria: s.successCriteria,
                common_mistakes: s.commonMistakes,
                focus_areas: s.focusAreas,
              })
            ),
          }
        : { id: null, name: "Full Run", scenarios: [] },
    });

    // Import LiveKit SDK (runs in Convex Node.js runtime)
    const { AccessToken, RoomServiceClient } = await import("livekit-server-sdk");

    // Step 1: Create the room with metadata so the agent can read ctx.room.metadata
    // RoomServiceClient needs https:// URL, convert from wss:// if needed
    const httpUrl = livekitUrl.replace("wss://", "https://").replace("ws://", "http://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 10 * 60, // 10 min
        metadata: roomMetadata,
      });
    } catch (e: unknown) {
      // Room may already exist — that's okay
      const msg = e instanceof Error ? e.message : String(e);
      console.log("Room create (may already exist):", msg);
    }

    // Step 2: Create a simple participant token (agent auto-dispatches to new rooms)
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: "Practitioner",
      ttl: 10 * 60, // 10 minutes
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return {
      token: jwt,
      url: livekitUrl,
      roomName,
    };
  },
});
