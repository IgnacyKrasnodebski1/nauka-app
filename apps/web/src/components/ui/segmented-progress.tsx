import { cn } from "@/lib/utils";

/** One segment per step; `done` segments filled green, `current` half-filled. Collapses to a single bar above 40 steps. */
export function SegmentedProgress({ total, done, label }: { total: number; done: number; label?: string }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 100;
  if (total > 40 || total === 0) {
    return (
      <div className="segbar single" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="seg on"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
      </div>
    );
  }
  return (
    <div className="segbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={cn("seg", i < done && "on", i === done && "cur")}><i /></div>
      ))}
    </div>
  );
}
