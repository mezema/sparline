"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

function PracticeSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scriptId = searchParams.get("script") as Id<"scripts"> | null;
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const script = useQuery(
    api.scripts.get,
    scriptId ? { id: scriptId } : "skip"
  );

  if (!scriptId || script === undefined) {
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

  const handleStart = () => {
    if (!selectedPhase) return;
    const sessionId = crypto.randomUUID();
    router.push(
      `/practice/${sessionId}?phase=${selectedPhase}&script=${scriptId}`
    );
  };

  return (
    <div className="mx-auto min-h-svh max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Select Phase</h1>
          <p className="text-xs text-muted-foreground">{script.name}</p>
        </div>
      </div>

      {/* Phase List */}
      <div className="space-y-2">
        {script.phases.map((phase) => {
          const isSelected = selectedPhase === phase._id;
          return (
            <button
              key={phase._id}
              onClick={() => setSelectedPhase(phase._id)}
              className="w-full text-left"
            >
              <Card
                className={`border-border/30 p-4 transition-all ${
                  isSelected
                    ? "border-foreground/30 bg-card/60 ring-1 ring-foreground/20"
                    : "bg-card/30 hover:bg-card/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{phase.name}</span>
                    </div>
                    {phase.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {phase.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {phase.scenarioCount} scenarios
                      {phase.estimatedMinutes
                        ? ` · ~${phase.estimatedMinutes} min`
                        : ""}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-col items-end">
                    {phase.bestScore != null ? (
                      <span className="text-lg font-bold tabular-nums">
                        {phase.bestScore}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                    {isSelected && (
                      <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                        <Check className="h-3 w-3 text-background" />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Start Button */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border/50 bg-background/80 p-4 backdrop-blur-xl safe-bottom">
        <div className="mx-auto max-w-lg">
          <Button
            onClick={handleStart}
            disabled={!selectedPhase}
            className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            <Play className="h-4 w-4" />
            Start Practice
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PracticeSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <PracticeSetupContent />
    </Suspense>
  );
}
