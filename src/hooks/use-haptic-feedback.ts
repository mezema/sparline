"use client";

export function useHapticFeedback() {
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  return {
    interrupt: () => vibrate([100, 50, 100]),
    success: () => vibrate(50),
    tap: () => vibrate(10),
  };
}
