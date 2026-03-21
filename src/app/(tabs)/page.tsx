"use client";

import Link from "next/link";
import { Play, Plus, ChevronRight, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@/hooks/use-user";

export default function HomePage() {
  const { userId, isLoading: userLoading } = useUser();
  const scripts = useQuery(
    api.scripts.list,
    userId ? { userId } : "skip"
  );
  const sessions = useQuery(
    api.sessions.list,
    userId ? { userId, limit: 3 } : "skip"
  );
  const progress = useQuery(
    api.progress.getOverview,
    userId ? { userId } : "skip"
  );

  if (userLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const currentScript = scripts?.[0];

  return (
    <div className="mx-auto max-w-lg px-4 pt-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">ScriptDrill</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Master your scripts through practice
        </p>
      </div>

      {/* Streak */}
      {progress && progress.streak > 0 && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="font-medium">{progress.streak} day streak</span>
          <span className="text-muted-foreground">Keep it going</span>
        </div>
      )}

      {/* Current Script Card */}
      {currentScript && (
        <Card className="mb-6 overflow-hidden border-border/50 bg-card/50 p-0">
          <div className="p-5">
            <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Current Script
            </div>
            <h2 className="text-lg font-semibold">{currentScript.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {currentScript.phaseCount} phases &middot;{" "}
              {currentScript.sessionCount} sessions
            </p>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1">
                {currentScript.averageScore != null && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {currentScript.averageScore}%
                    </span>
                    {progress?.scoreChange != null && (
                      <span className="flex items-center text-xs font-medium text-emerald-400">
                        <Zap className="mr-0.5 h-3 w-3" />
                        {progress.scoreChange > 0 ? "+" : ""}
                        {progress.scoreChange}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Link href={`/practice?script=${currentScript._id}`} className="flex-1">
                <Button className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90">
                  <Play className="h-4 w-4" />
                  Quick Practice
                </Button>
              </Link>
              <Link href={`/practice?script=${currentScript._id}&select=true`}>
                <Button variant="outline" className="gap-1.5">
                  Choose Phase
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* No Script State */}
      {scripts && scripts.length === 0 && (
        <Card className="mb-6 border-dashed border-border/50 bg-transparent p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium">Add your first script</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste or upload a script to start practicing
          </p>
          <Link href="/scripts/new">
            <Button className="mt-4" variant="outline">
              Add Script
            </Button>
          </Link>
        </Card>
      )}

      {/* Recent Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Recent
            </h3>
            <Link
              href="/history"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {sessions.map((session) => (
              <Link key={session._id} href={`/history/${session._id}`}>
                <Card className="border-border/30 bg-card/30 p-3.5 transition-colors hover:bg-card/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {session.phaseName}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(session.startedAt).toLocaleDateString()}{" "}
                        {new Date(session.startedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        &middot; {session.correctionCount} corrections
                      </div>
                    </div>
                    <div className="text-right">
                      {session.overallScore != null && (
                        <div className="text-lg font-bold tabular-nums">
                          {session.overallScore}%
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
