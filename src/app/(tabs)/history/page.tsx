"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@/hooks/use-user";

function formatDuration(seconds: number | undefined) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const { userId, isLoading: userLoading } = useUser();
  const sessions = useQuery(
    api.sessions.list,
    userId ? { userId } : "skip"
  );

  if (userLoading || sessions === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Group by date
  const grouped = sessions.reduce(
    (acc, session) => {
      const dateKey = formatDate(session.startedAt);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(session);
      return acc;
    },
    {} as Record<string, typeof sessions>
  );

  return (
    <div className="mx-auto max-w-lg px-4 pt-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {sessions.length} practice session{sessions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No sessions yet. Start practicing!
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateSessions]) => (
            <div key={date}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {date}
              </h3>
              <div className="space-y-2">
                {dateSessions.map((session) => (
                  <Link key={session._id} href={`/history/${session._id}`}>
                    <Card className="border-border/30 bg-card/30 p-3.5 transition-colors hover:bg-card/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {session.phaseName}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(session.startedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            &middot; {formatDuration(session.durationSeconds)}{" "}
                            &middot; {session.correctionCount} corrections
                          </div>
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                          {session.overallScore != null
                            ? `${session.overallScore}%`
                            : "--"}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
