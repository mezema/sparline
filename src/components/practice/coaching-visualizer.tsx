"use client";

import type { CoachingState } from "@/types/coaching";

interface CoachingVisualizerProps {
  state: CoachingState;
  className?: string;
}

const stateConfig: Record<
  CoachingState,
  { glow: string; bg: string; label: string; sublabel: string }
> = {
  pre_session: {
    glow: "",
    bg: "bg-muted/30",
    label: "",
    sublabel: "",
  },
  listening: {
    glow: "glow-green",
    bg: "bg-emerald-500/10",
    label: "Keep going...",
    sublabel: "",
  },
  interrupted: {
    glow: "glow-amber",
    bg: "bg-amber-500/20",
    label: "Hold on",
    sublabel: "",
  },
  modeling: {
    glow: "glow-blue",
    bg: "bg-blue-500/10",
    label: "Listen closely",
    sublabel: "",
  },
  user_repeat: {
    glow: "",
    bg: "bg-muted/20",
    label: "Your turn",
    sublabel: "",
  },
  drilling: {
    glow: "",
    bg: "bg-muted/20",
    label: "Again",
    sublabel: "",
  },
  reinforcing: {
    glow: "glow-green",
    bg: "bg-emerald-500/10",
    label: "Perfect",
    sublabel: "",
  },
  transitioning: {
    glow: "",
    bg: "bg-muted/10",
    label: "Next scenario...",
    sublabel: "",
  },
  paused: {
    glow: "",
    bg: "bg-muted/10",
    label: "Paused",
    sublabel: "Tap to resume",
  },
  wrapping_up: {
    glow: "glow-green",
    bg: "bg-emerald-500/5",
    label: "Coach wrapping up...",
    sublabel: "",
  },
  completed: {
    glow: "",
    bg: "bg-emerald-500/5",
    label: "Session complete",
    sublabel: "",
  },
};

export function CoachingVisualizer({
  state,
  className = "",
}: CoachingVisualizerProps) {
  const config = stateConfig[state];

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Main visualizer orb */}
      <div
        className={`coaching-transition flex h-32 w-32 items-center justify-center rounded-full ${config.bg} ${config.glow}`}
      >
        <div
          className={`h-16 w-16 rounded-full coaching-transition ${
            state === "listening" || state === "wrapping_up"
              ? "bg-emerald-400/40"
              : state === "interrupted"
                ? "bg-amber-400/50"
                : state === "modeling"
                  ? "bg-blue-400/40"
                  : state === "reinforcing"
                    ? "bg-emerald-400/40"
                    : "bg-muted/30"
          }`}
        />
      </div>

      {/* State label */}
      {config.label && (
        <div className="text-center">
          <div
            className={`text-sm font-semibold uppercase tracking-widest ${
              state === "interrupted"
                ? "text-amber-400"
                : state === "reinforcing"
                  ? "text-emerald-400"
                  : state === "modeling"
                    ? "text-blue-400"
                    : "text-muted-foreground"
            }`}
          >
            {config.label}
          </div>
          {config.sublabel && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {config.sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
