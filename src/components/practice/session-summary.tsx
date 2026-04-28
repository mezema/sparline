"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, RotateCcw, Check, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Id } from "../../../convex/_generated/dataModel";

export interface Recommendation {
  phaseId: Id<"phases">;
  phaseName: string;
  reason: string;
  scriptId: Id<"scripts">;
}

interface SessionSummaryProps {
  sessionId: string;
  score: number;
  scoreChange: number;
  duration: string;
  corrections: number;
  perfectDrills: number;
  focusArea: string | null;
  focusAreaScore: number | null;
  phaseName: string;
  onPracticeAgain: () => void;
  recommendation?: Recommendation | null;
}

export function SessionSummary({
  sessionId,
  score,
  scoreChange,
  duration,
  corrections,
  perfectDrills,
  focusArea,
  focusAreaScore,
  phaseName,
  onPracticeAgain,
  recommendation,
}: SessionSummaryProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Session Complete
        </div>

        {/* Score */}
        <div className="mb-1 text-6xl font-bold tabular-nums">{score}%</div>
        {scoreChange !== 0 && (
          <div className="mb-6 flex items-center justify-center gap-1 text-sm text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+{scoreChange} pts</span>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="border-border/30 bg-card/30 p-3">
            <div className="text-lg font-bold tabular-nums">{duration}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Duration
            </div>
          </Card>
          <Card className="border-border/30 bg-card/30 p-3">
            <div className="text-lg font-bold tabular-nums">{corrections}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Corrections
            </div>
          </Card>
          <Card className="border-border/30 bg-card/30 p-3">
            <div className="text-lg font-bold tabular-nums">
              {perfectDrills}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Drills
            </div>
          </Card>
        </div>

        {/* Focus Area */}
        {focusArea && focusAreaScore !== null && (
          <Card className="mb-6 border-border/30 bg-card/30 p-4 text-left">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Focus Area
            </div>
            <div className="mt-1 text-sm font-medium">{focusArea}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {focusAreaScore}%
            </div>
          </Card>
        )}

        {/* Recommendation */}
        {recommendation && (
          <Card className="mb-6 border-emerald-500/20 bg-emerald-500/5 p-4 text-left">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-emerald-400">
              <Sparkles className="h-3 w-3" />
              Up Next
            </div>
            <div className="mt-1.5 text-sm font-medium">
              {recommendation.phaseName}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {recommendation.reason}
            </div>
            <Link
              href={`/practice/${crypto.randomUUID()}?script=${recommendation.scriptId}&phase=${recommendation.phaseId}`}
            >
              <Button
                size="sm"
                className="mt-3 w-full gap-1.5 bg-emerald-500 text-white hover:bg-emerald-600"
              >
                <Play className="h-3.5 w-3.5" />
                Practice This
              </Button>
            </Link>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push(`/history/${sessionId}`)}
            variant="outline"
            className="w-full gap-2"
          >
            <Check className="h-4 w-4" />
            View Transcript
          </Button>
          <Button
            onClick={onPracticeAgain}
            className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            <RotateCcw className="h-4 w-4" />
            Practice Again
          </Button>
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
