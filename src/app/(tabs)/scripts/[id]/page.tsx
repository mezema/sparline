"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface ScriptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ScriptDetailPage({ params }: ScriptDetailPageProps) {
  const { id } = use(params);
  const script = useQuery(api.scripts.get, {
    id: id as Id<"scripts">,
  });

  if (script === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (script === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Script not found</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/scripts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{script.name}</h1>
          {script.description && (
            <p className="text-xs text-muted-foreground">
              {script.description}
            </p>
          )}
        </div>
        <Link href={`/scripts/${id}/edit`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-4 text-center">
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {script.averageScore != null ? `${script.averageScore}%` : "--"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Avg Score
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {script.sessionCount}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Sessions
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {script.phases.length}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Phases
          </div>
        </div>
      </div>

      {/* Phases */}
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Phases
      </h3>
      <div className="space-y-2">
        {script.phases.map((phase) => (
          <Card
            key={phase._id}
            className="border-border/30 bg-card/30 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">{phase.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {phase.scenarioCount} scenarios
                  {phase.estimatedMinutes
                    ? ` · ~${phase.estimatedMinutes} min`
                    : ""}
                </div>
                {phase.bestScore != null && (
                  <div className="mt-2">
                    <Progress value={phase.bestScore} className="h-1.5" />
                  </div>
                )}
              </div>
              <div className="ml-3 text-right">
                {phase.bestScore != null ? (
                  <span className="text-lg font-bold tabular-nums">
                    {phase.bestScore}%
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">--</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Practice Button */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border/50 bg-background/80 p-4 backdrop-blur-xl safe-bottom">
        <div className="mx-auto max-w-lg">
          <Link href={`/practice?script=${id}`}>
            <Button className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90">
              <Play className="h-4 w-4" />
              Practice This Script
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
