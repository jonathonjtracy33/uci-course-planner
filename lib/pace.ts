// How fast a student wants to finish, turned into a graduation target for the planner.
//   on time:  4 years from their first Fall. Ahead? The balancer gives lighter quarters on its own.
//             Behind? Summer classes are added only if the plan can't finish without them.
//   early:    the quarter they chose, with summer classes.
//   balanced: a steady load (~14 units a quarter, above UCI's 12-unit full-time minimum), even if
//             that runs past 4 years.
export type Pace = "ontime" | "early" | "balanced";
export const ON_TIME_QUARTERS = 12;
export const BALANCED_UNITS = 14;
export const TYPICAL_UNITS = 15; // a usual quarter at UCI, for "ahead / behind" (180 over 12 quarters)

export function paceTarget(pace: Pace, opts: { grad: number; firstQuarter: number; unitsLeft: number }): { grad: number; summers: boolean | "if-needed" } {
  if (pace === "early") return { grad: Math.min(ON_TIME_QUARTERS - 1, Math.max(opts.firstQuarter + 1, opts.grad)), summers: true };
  if (pace === "balanced") {
    const needed = Math.ceil(Math.max(0, opts.unitsLeft) / BALANCED_UNITS);
    return { grad: Math.min(18, Math.max(ON_TIME_QUARTERS, opts.firstQuarter + needed)), summers: false };
  }
  return { grad: ON_TIME_QUARTERS, summers: "if-needed" };
}

// Units ahead of (+) or behind (-) a typical 4-year pace at this point.
export const unitsAhead = (unitsDone: number, firstQuarter: number) => unitsDone - Math.floor(firstQuarter) * TYPICAL_UNITS;
