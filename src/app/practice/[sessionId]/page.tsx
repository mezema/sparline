"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { X, Pause, Play, SkipForward, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoachingVisualizer } from "@/components/practice/coaching-visualizer";
import { DrillCounter } from "@/components/practice/drill-counter";
import { SessionSummary } from "@/components/practice/session-summary";
import { useHapticFeedback } from "@/hooks/use-haptic-feedback";
import { useUser } from "@/hooks/use-user";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import type { CoachingState, DrillProgress } from "@/types/coaching";

interface PracticeSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

function PracticeContent() {
  const assistant = useVoiceAssistant();

  return (
    <>
      <RoomAudioRenderer />
      {assistant.audioTrack && (
        <BarVisualizer
          state={assistant.state}
          barCount={5}
          trackRef={assistant.audioTrack}
          className="h-16 w-32 [&>div]:bg-foreground/40"
        />
      )}
    </>
  );
}

function SkipScenarioButton() {
  const room = useRoomContext();

  const handleSkip = useCallback(() => {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({ type: "skip_scenario" }));
    room.localParticipant.publishData(data, { reliable: true });
  }, [room]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground"
      onClick={handleSkip}
    >
      <SkipForward className="mr-1 h-3 w-3" />
      Skip
    </Button>
  );
}

function EndSessionButton({ onEndRequested, disabled }: { onEndRequested: () => void; disabled: boolean }) {
  const room = useRoomContext();

  const handleEnd = useCallback(() => {
    // Send data message to agent so it can give verbal wrap-up
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({ type: "end_session" }));
    room.localParticipant.publishData(data, { reliable: true });
    onEndRequested();
  }, [room, onEndRequested]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs"
      onClick={handleEnd}
      disabled={disabled}
    >
      {disabled ? "Wrapping up..." : "End Session"}
    </Button>
  );
}

export default function PracticeSessionPage({
  params,
}: PracticeSessionPageProps) {
  const { sessionId } = use(params);
  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center bg-background"><div className="text-sm text-muted-foreground">Loading session...</div></div>}>
      <PracticeSessionContent sessionId={sessionId} />
    </Suspense>
  );
}

function PracticeSessionContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const haptic = useHapticFeedback();
  const { userId } = useUser();
  const generateToken = useAction(api.actions.generateLivekitToken);
  const createSession = useMutation(api.sessions.create);
  const completeSession = useMutation(api.sessions.complete);

  const scriptId = searchParams.get("script") as Id<"scripts"> | null;
  const phaseId = searchParams.get("phase") as Id<"phases"> | null;

  const script = useQuery(
    api.scripts.get,
    scriptId ? { id: scriptId } : "skip"
  );

  const [coachingState, setCoachingState] =
    useState<CoachingState>("pre_session");
  const [isPaused, setIsPaused] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [convexSessionId, setConvexSessionId] = useState<Id<"sessions"> | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStartTime] = useState(() => Date.now());
  const [selectedFocusArea, setSelectedFocusArea] = useState<string | null>(null);
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // ─── Real-time Convex subscriptions ───
  // These auto-update as the Python agent POSTs events to Convex HTTP endpoints

  const liveTranscript = useQuery(
    api.sessions.getLiveTranscript,
    convexSessionId ? { sessionId: convexSessionId } : "skip"
  );

  const liveFeedback = useQuery(
    api.sessions.getLiveFeedback,
    convexSessionId ? { sessionId: convexSessionId } : "skip"
  );

  const sessionStats = useQuery(
    api.sessions.getSessionStats,
    convexSessionId ? { sessionId: convexSessionId } : "skip"
  );

  // Previous session score for computing score delta
  const previousScore = useQuery(
    api.sessions.getPreviousScore,
    userId && scriptId && convexSessionId
      ? { userId, scriptId, currentSessionId: convexSessionId }
      : "skip"
  );

  // Next-session recommendation
  const recommendation = useQuery(
    api.progress.getRecommendation,
    userId && scriptId ? { userId, scriptId } : "skip"
  );

  // Derive corrections count from real data
  const corrections = sessionStats?.correctionCount ?? 0;
  const perfectDrills = sessionStats?.perfectDrillCount ?? 0;

  // Derive drill progress from live feedback events
  const drill = useMemo<DrillProgress | null>(() => {
    if (!liveFeedback) return null;

    // Find the most recent drill_start event
    const drillEvents = liveFeedback.filter(
      (e) => e.type === "drill_start" || e.type === "drill_rep" || e.type === "drill_complete"
    );
    if (drillEvents.length === 0) return null;

    // Get the latest drill_start to know the current drill
    const lastStart = [...drillEvents].reverse().find((e) => e.type === "drill_start");
    if (!lastStart) return null;

    // Check if drill was completed
    const lastComplete = [...drillEvents].reverse().find((e) => e.type === "drill_complete");
    if (lastComplete && lastComplete.timestampMs > lastStart.timestampMs) {
      return null; // Drill is done
    }

    // Count reps since last start
    const repsSinceStart = drillEvents.filter(
      (e) => e.type === "drill_rep" && e.timestampMs > lastStart.timestampMs
    );

    const totalRounds = lastStart.drillTotal ?? 5;
    const currentRound = repsSinceStart.length;
    const successfulRounds = repsSinceStart.filter((e) => e.drillSuccess).length;

    return {
      targetPhrase: lastStart.expectedText ?? "",
      currentRound,
      totalRounds,
      successfulRounds,
    };
  }, [liveFeedback]);

  // Derive coaching state from feedback events
  useEffect(() => {
    if (!liveFeedback || liveFeedback.length === 0) return;
    if (coachingState === "pre_session" || coachingState === "completed" || coachingState === "paused" || coachingState === "wrapping_up") return;

    const lastEvent = liveFeedback[liveFeedback.length - 1];
    switch (lastEvent.type) {
      case "correction":
        setCoachingState("interrupted");
        haptic.tap();
        break;
      case "drill_start":
        setCoachingState("drilling");
        break;
      case "drill_rep":
        setCoachingState("drilling");
        break;
      case "drill_complete":
        setCoachingState("listening");
        break;
      case "reinforcement":
        setCoachingState("reinforcing");
        // Auto-transition back to listening after brief reinforcement
        setTimeout(() => setCoachingState("listening"), 1500);
        break;
      case "scenario_complete":
        setCoachingState("transitioning");
        setTimeout(() => setCoachingState("listening"), 2000);
        break;
    }
  }, [liveFeedback, coachingState, haptic]);

  // Map live transcript to display format
  const transcriptDisplay = useMemo(() => {
    if (!liveTranscript) return [];
    return liveTranscript.map((entry) => ({
      speaker: entry.speaker as "user" | "ai",
      content: entry.content,
      isCorrection: entry.isCorrection,
      isModel: entry.isModelPhrase,
    }));
  }, [liveTranscript]);

  // Derive phase info from script data
  const currentPhase = script?.phases.find((p) => p._id === phaseId);
  const phaseName = currentPhase?.name ?? "Practice";

  // Compute all unique focus areas from scenarios
  const allFocusAreas = useMemo(() => {
    if (!currentPhase?.scenarios) return [];
    const areas = new Set<string>();
    for (const s of currentPhase.scenarios) {
      for (const area of s.focusAreas ?? []) {
        areas.add(area);
      }
    }
    return Array.from(areas);
  }, [currentPhase]);

  const displayFocusArea =
    selectedFocusArea ?? allFocusAreas[0] ?? "General Practice";

  // Session creation deferred to handleReady so focus area is included
  const handleReady = useCallback(async () => {
    if (!scriptId || !userId) return;
    setIsConnecting(true);
    try {
      const roomName = `session-${sessionId}`;
      const dbSessionId = await createSession({
        userId: userId,
        scriptId: scriptId,
        phaseId: phaseId ?? undefined,
        livekitRoomName: roomName,
        primaryFocusArea: selectedFocusArea ?? allFocusAreas[0] ?? undefined,
      });
      setConvexSessionId(dbSessionId);

      const result = await generateToken({
        sessionId,
        scriptId: scriptId,
        phaseId: phaseId ?? undefined,
        convexSessionId: dbSessionId,
      });
      setToken(result.token);
      setLivekitUrl(result.url);
      setCoachingState("listening");
    } catch {
      setIsConnecting(false);
    }
  }, [
    scriptId, userId, sessionId, phaseId,
    selectedFocusArea, allFocusAreas,
    createSession, generateToken,
  ]);

  const handlePause = useCallback(() => {
    setIsPaused((p) => !p);
    setCoachingState((s) => (s === "paused" ? "listening" : "paused"));
    haptic.tap();
  }, [haptic]);

  const handleEndRequested = useCallback(() => {
    setCoachingState("wrapping_up");
    // Safety timeout: if agent doesn't finish wrap-up in 10s, force complete
    setTimeout(async () => {
      if (convexSessionId) {
        try {
          await completeSession({
            id: convexSessionId,
            correctionCount: corrections,
            perfectDrillCount: perfectDrills,
          });
        } catch {
          // Agent may have already completed it
        }
      }
      setShowSummary(true);
      setCoachingState("completed");
    }, 10000);
  }, [convexSessionId, completeSession, corrections, perfectDrills]);

  // Watch for agent-driven completion during wrap-up
  useEffect(() => {
    if (coachingState === "wrapping_up" && sessionStats?.status === "completed") {
      setShowSummary(true);
      setCoachingState("completed");
    }
  }, [sessionStats?.status, coachingState]);

  // Calculate real duration
  const durationDisplay = useMemo(() => {
    const elapsed = sessionStats?.durationSeconds
      ?? Math.round((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [sessionStats, sessionStartTime]);

  // Render pre-session screen
  if (coachingState === "pre_session") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          {/* Close button */}
          <div className="fixed right-4 top-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="h-8 w-8 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="mb-2 text-xl font-semibold">
            {phaseName}
          </h2>

          <div className="mb-8 space-y-4 text-left">
            <p className="text-sm leading-relaxed text-muted-foreground">
              &ldquo;I&rsquo;m going to stop you probably 30-40 times today.
              That&rsquo;s completely normal. That&rsquo;s how you get
              great.&rdquo;
            </p>
          </div>

          <div className="mb-8">
            <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Focus Area
            </div>
            <button
              onClick={() => allFocusAreas.length > 1 && setShowFocusPicker(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/30 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-card/50"
            >
              {displayFocusArea}
              {allFocusAreas.length > 1 && (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </div>

          <Button
            onClick={handleReady}
            disabled={isConnecting}
            className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting to coach...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                I&rsquo;m Ready
              </>
            )}
          </Button>

          {allFocusAreas.length > 1 && !isConnecting && (
            <button
              onClick={() => setShowFocusPicker(true)}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground"
            >
              Change focus area
            </button>
          )}

          {/* Focus Area Picker Bottom Sheet */}
          {showFocusPicker && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowFocusPicker(false)}
              />
              {/* Sheet */}
              <div className="relative w-full max-w-lg rounded-t-2xl border-t border-border/50 bg-background px-4 pb-8 pt-4 safe-bottom">
                <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-muted-foreground/30" />
                <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Choose Focus Area
                </h3>
                <div className="space-y-2">
                  {allFocusAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => {
                        setSelectedFocusArea(area);
                        setShowFocusPicker(false);
                      }}
                      className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                        area === displayFocusArea
                          ? "bg-foreground text-background"
                          : "bg-card/30 hover:bg-card/50"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowFocusPicker(false)}
                  className="mt-4 w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render session summary
  if (showSummary) {
    return (
      <SessionSummary
        sessionId={convexSessionId ?? sessionId}
        score={sessionStats?.overallScore ?? 0}
        scoreChange={
          previousScore != null && sessionStats?.overallScore != null
            ? sessionStats.overallScore - previousScore
            : 0
        }
        duration={durationDisplay}
        corrections={corrections}
        perfectDrills={perfectDrills}
        focusArea={displayFocusArea !== "General Practice" ? displayFocusArea : null}
        focusAreaScore={null}
        phaseName={phaseName}
        onPracticeAgain={() => {
          setShowSummary(false);
          setCoachingState("pre_session");
        }}
        recommendation={recommendation}
      />
    );
  }

  // Main practice session — inner content (must be inside LiveKitRoom for skip to work)
  const mainContent = (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="text-xs text-muted-foreground">
          {phaseName} &middot; {currentPhase?.scenarios?.[0]?.name ?? ""}
        </div>
        <div className="flex items-center gap-2">
          {/* Live correction counter */}
          {corrections > 0 && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-400">
              {corrections} corrections
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePause}
            className="h-8 w-8 text-muted-foreground"
          >
            {isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Center: Visualizer */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {token && livekitUrl ? (
          <PracticeContent />
        ) : (
          <CoachingVisualizer state={coachingState} />
        )}

        {/* Drill counter */}
        {drill && (
          <div className="mt-4">
            <DrillCounter drill={drill} />
          </div>
        )}
      </div>

      {/* Bottom: Transcript + Controls */}
      <div className="border-t border-border/20 bg-card/10 px-4 pb-6 pt-3 safe-bottom">
        {/* Live transcript */}
        <div className="mb-3 max-h-32 overflow-y-auto scrollbar-hide">
          {transcriptDisplay.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Listening...
            </p>
          )}
          {transcriptDisplay.slice(-3).map((entry, i) => (
            <div
              key={i}
              className={`mb-1.5 text-sm ${
                entry.isCorrection
                  ? "text-amber-400"
                  : entry.isModel
                    ? "text-blue-400"
                    : entry.speaker === "ai"
                      ? "text-muted-foreground"
                      : "text-foreground"
              }`}
            >
              <span className="mr-1 text-xs font-medium uppercase tracking-widest opacity-50">
                {entry.speaker === "user" ? "You" : "Coach"}
              </span>
              {entry.content}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {token && livekitUrl ? (
            <SkipScenarioButton />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              disabled
            >
              <SkipForward className="mr-1 h-3 w-3" />
              Skip
            </Button>
          )}

          {token && livekitUrl ? (
            <EndSessionButton
              onEndRequested={handleEndRequested}
              disabled={coachingState === "wrapping_up"}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleEndRequested}
              disabled={coachingState === "wrapping_up"}
            >
              {coachingState === "wrapping_up" ? "Wrapping up..." : "End Session"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Wrap everything in LiveKitRoom so child components can use room context
  if (token && livekitUrl) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={!isPaused}
        audio={true}
      >
        {mainContent}
      </LiveKitRoom>
    );
  }

  return mainContent;
}
