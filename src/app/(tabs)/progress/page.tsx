"use client";

import { Flame, TrendingUp, Target, AlertCircle, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@/hooks/use-user";
import { ScoreChart } from "@/components/progress/score-chart";

export default function ProgressPage() {
  const { userId, isLoading: userLoading } = useUser();
  const overview = useQuery(
    api.progress.getOverview,
    userId ? { userId } : "skip"
  );
  const mistakes = useQuery(
    api.progress.getCommonMistakes,
    userId ? { userId } : "skip"
  );
  const scoreHistory = useQuery(
    api.progress.getScoreHistory,
    userId ? { userId } : "skip"
  );
  // Get scripts for phase breakdown
  const scripts = useQuery(
    api.scripts.list,
    userId ? { userId } : "skip"
  );
  const firstScriptId = scripts?.[0]?._id;
  const scriptDetail = useQuery(
    api.scripts.get,
    firstScriptId ? { id: firstScriptId } : "skip"
  );

  if (userLoading || overview === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your practice trajectory
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="border-border/30 bg-card/30 p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">
            {overview.averageScore != null ? `${overview.averageScore}%` : "--"}
          </div>
          {overview.scoreChange != null && (
            <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              {overview.scoreChange > 0 ? "+" : ""}
              {overview.scoreChange}%
            </div>
          )}
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Overall
          </div>
        </Card>
        <Card className="border-border/30 bg-card/30 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-2xl font-bold tabular-nums">
            {overview.streak}
            {overview.streak > 0 && (
              <Flame className="h-5 w-5 text-orange-400" />
            )}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Day Streak
          </div>
        </Card>
        <Card className="border-border/30 bg-card/30 p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">
            {overview.totalSessions}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Sessions
          </div>
        </Card>
      </div>

      {/* Score Trend Chart */}
      {scoreHistory && scoreHistory.length >= 2 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Score Trend
          </h3>
          <Card className="border-border/30 bg-card/30 p-4">
            <ScoreChart data={scoreHistory} />
          </Card>
        </div>
      )}

      {/* Phase Breakdown */}
      {scriptDetail && scriptDetail.phases.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Phase Breakdown
          </h3>
          <Card className="border-border/30 bg-card/30 p-4">
            <div className="space-y-3">
              {scriptDetail.phases.map((phase) => (
                <div key={phase._id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span
                      className={
                        !phase.bestScore ? "text-muted-foreground" : ""
                      }
                    >
                      {phase.name}
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      {phase.bestScore != null ? `${phase.bestScore}%` : "--"}
                    </span>
                  </div>
                  <Progress
                    value={phase.bestScore ?? 0}
                    className={`h-1.5 ${!phase.bestScore ? "opacity-30" : ""}`}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Common Mistakes */}
      {mistakes && mistakes.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Common Mistakes
          </h3>
          <Card className="border-border/30 bg-card/30 p-4">
            <div className="space-y-3">
              {mistakes.map((mistake, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{mistake.text}</span>
                  <span className="ml-3 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                    {mistake.count}x
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {overview.totalSessions === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Complete some practice sessions to see your progress
        </div>
      )}
    </div>
  );
}
