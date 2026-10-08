// UCI counts three years of one language other than English in high school (with C grades or
// better) as GE VI, so those students don't need a language class.
export function LanguageCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm hover:border-brand">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
      <span>
        <span className="block font-medium">I took 3 years of one language other than English in high school</span>
        <span className="block text-xs text-muted">With a C or better each year. This covers GE VI (Language Other Than English).</span>
      </span>
    </label>
  );
}
