"use client";

// Optional: the student's total units so far (from their unofficial transcript), for students who
// don't want to enter every course they've taken.
export function UnitsDoneInput({ value, onChange }: { value: number; onChange: (units: number) => void }) {
  return (
    <label className="block text-xs font-medium text-muted">
      Total units completed so far <span className="font-normal">(optional, from your unofficial transcript)</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={400}
        value={value || ""}
        placeholder="e.g. 48"
        onChange={(e) => onChange(Math.max(0, Math.min(400, Math.round(Number(e.target.value) || 0))))}
        className="mt-1 block w-32 rounded-lg border border-border bg-subtle px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}
