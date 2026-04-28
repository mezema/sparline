"use client";

import type { DrillProgress } from "@/types/coaching";

interface DrillCounterProps {
  drill: DrillProgress;
}

export function DrillCounter({ drill }: DrillCounterProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Target phrase */}
      {drill.targetPhrase && (
        <div className="max-w-xs text-center text-sm font-medium text-blue-400">
          &ldquo;{drill.targetPhrase}&rdquo;
        </div>
      )}

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Drill
        </span>
        <div className="flex gap-1">
          {Array.from({ length: drill.totalRounds }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all ${
                i < drill.currentRound
                  ? i < drill.successfulRounds
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {drill.currentRound}/{drill.totalRounds}
        </span>
      </div>
    </div>
  );
}
