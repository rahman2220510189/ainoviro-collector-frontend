'use client';

import { Spinner } from '@/components/ui';
import { useCategories } from '@/lib/jobs';

/** The 16 categories as checkboxes; each one searches all keywords of its subcategories. */
export function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const categories = useCategories();

  if (categories.isPending) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
        <Spinner /> Loading categories…
      </div>
    );
  }
  if (categories.isError) {
    return <p className="py-4 text-sm text-red-700">Could not load the categories.</p>;
  }

  const all = categories.data;
  const allSelected = all.length > 0 && selected.length === all.length;
  const toggle = (slug: string) =>
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">More categories = more searches.</span>
        <button
          type="button"
          className="font-medium text-brand-700 hover:underline"
          onClick={() => onChange(allSelected ? [] : all.map((c) => c.slug))}
        >
          {allSelected ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {all.map((c) => {
          const checked = selected.includes(c.slug);
          return (
            <label
              key={c.slug}
              title={c.subcategories.map((s) => s.displayName).join(', ')}
              className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm ${
                checked
                  ? 'border-brand-300 bg-brand-50/60'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(c.slug)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="min-w-0">
                <span className="block font-medium text-slate-900">{c.displayName}</span>
                <span className="block text-xs text-slate-500">
                  {c.subcategories.length} subcategories
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
