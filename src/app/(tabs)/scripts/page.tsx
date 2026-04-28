"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@/hooks/use-user";

export default function ScriptsPage() {
  const { userId, isLoading: userLoading } = useUser();
  const scripts = useQuery(
    api.scripts.list,
    userId ? { userId } : "skip"
  );

  if (userLoading || scripts === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scripts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {scripts.length} script{scripts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/scripts/new">
          <Button size="icon" variant="outline" className="h-9 w-9">
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {scripts.map((script) => (
          <Link key={script._id} href={`/scripts/${script._id}`}>
            <Card className="border-border/30 bg-card/30 p-4 transition-colors hover:bg-card/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{script.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {script.phaseCount} phases
                  </p>
                </div>
                <div className="text-right">
                  {script.averageScore != null ? (
                    <div className="text-lg font-bold tabular-nums">
                      {script.averageScore}%
                    </div>
                  ) : (
                    <div className="text-lg font-bold tabular-nums text-muted-foreground">
                      --
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {script.sessionCount} sessions
                  </div>
                </div>
              </div>
              {script.averageScore != null && (
                <div className="mt-3">
                  <Progress value={script.averageScore} className="h-1.5" />
                </div>
              )}
            </Card>
          </Link>
        ))}

        <Link href="/scripts/new">
          <Card className="mt-4 border-dashed border-border/30 bg-transparent p-6 text-center transition-colors hover:bg-card/20">
            <Plus className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Add New Script
            </span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
