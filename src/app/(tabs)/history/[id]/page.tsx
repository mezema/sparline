"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

function formatDuration(seconds: number | undefined) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimestamp(ms: number, sessionStartMs: number) {
  const elapsed = Math.max(0, Math.floor((ms - sessionStartMs) / 1000));
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface HistoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function HistoryDetailPage({
  params,
}: HistoryDetailPageProps) {
  const { id } = use(params);

  // Skip query if ID is not a valid Convex document ID
  // Convex IDs are alphanumeric without dashes; UUIDs contain dashes
  const isValidId = id && !id.includes("-") && id !== "latest";
  const session = useQuery(
    api.sessions.get,
    isValidId ? { id: id as Id<"sessions"> } : "skip"
  );

  if (!isValidId) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Session not found</div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Session not found</div>
      </div>
    );
  }

  const correctionEvents = session.feedback.filter(
    (e) => e.type === "correction"
  );
  const drillEvents = session.feedback.filter(
    (e) => e.type === "drill_complete" && e.drillSuccess
  );

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/history">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold">{session.phaseName}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date(session.startedAt).toLocaleDateString()}{" "}
            {new Date(session.startedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-2">
        <Card className="border-border/30 bg-card/30 p-2.5 text-center">
          <div className="text-xl font-bold tabular-nums">
            {session.overallScore != null ? `${session.overallScore}%` : "--"}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Score
          </div>
        </Card>
        <Card className="border-border/30 bg-card/30 p-2.5 text-center">
          <div className="text-xl font-bold tabular-nums">
            {formatDuration(session.durationSeconds)}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Time
          </div>
        </Card>
        <Card className="border-border/30 bg-card/30 p-2.5 text-center">
          <div className="text-xl font-bold tabular-nums">
            {session.correctionCount}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Fixes
          </div>
        </Card>
        <Card className="border-border/30 bg-card/30 p-2.5 text-center">
          <div className="text-xl font-bold tabular-nums">
            {drillEvents.length}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Drills
          </div>
        </Card>
      </div>

      {/* Transcript */}
      {session.transcript.length > 0 && (
        <>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Transcript
          </h3>
          <div className="space-y-3">
            {session.transcript.map((entry) => (
              <div
                key={entry._id}
                className={`rounded-lg p-3 ${
                  entry.isCorrection
                    ? "border border-amber-500/20 bg-amber-500/5"
                    : entry.isModelPhrase
                      ? "border border-blue-500/20 bg-blue-500/5"
                      : "bg-card/20"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest ${
                      entry.speaker === "user"
                        ? "text-foreground/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    {entry.speaker === "user" ? "You" : "Coach"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/50">
                    {formatTimestamp(entry.timestampMs, session.startedAt)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{entry.content}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {session.transcript.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No transcript recorded for this session
        </div>
      )}

      {/* Practice Again */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border/50 bg-background/80 p-4 backdrop-blur-xl safe-bottom">
        <div className="mx-auto max-w-lg">
          <Link href={`/practice?script=${session.scriptId}`}>
            <Button className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90">
              <RotateCcw className="h-4 w-4" />
              Practice Again
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
