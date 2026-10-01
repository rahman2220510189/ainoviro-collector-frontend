'use client';

import { useEffect, useState } from 'react';
import {
  LEAD_STATUSES,
  STATUS_LABEL,
  useCategories,
  useLeadFacets,
  type LeadFilters,
} from '@/lib/leads';

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm text-slate-700 focus:border-brand-500 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/** Filter bar of the leads page (spec §14). Every change goes into the URL. */
export function LeadFiltersBar({
  filters,
  onChange,
  onReset,
}: {
  filters: LeadFilters;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
}) {
  const facets = useLeadFacets(filters.country);
  const categories = useCategories();
  const [q, setQ] = useState(filters.q ?? '');

  // Search waits until typing pauses, so not every key press reloads the table.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.q ?? '') !== q.trim()) onChange({ q: q.trim() || undefined });
    }, 400);
    return () => clearTimeout(timer);
  }, [q, filters.q, onChange]);

  const subcategories =
    categories.data?.find((c) => c.slug === filters.category)?.subcategories ?? [];

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <Field label="Search">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email or website"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>
        <Field label="City">
          <select
            className={selectClass}
            value={filters.city ?? ''}
            onChange={(e) => onChange({ city: e.target.value || undefined })}
          >
            <option value="">All cities</option>
            {facets.data?.cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            className={selectClass}
            value={filters.category ?? ''}
            onChange={(e) =>
              onChange({ category: e.target.value || undefined, subcategory: undefined })
            }
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subcategory">
          <select
            className={selectClass}
            value={filters.subcategory ?? ''}
            disabled={subcategories.length === 0}
            onChange={(e) => onChange({ subcategory: e.target.value || undefined })}
          >
            <option value="">{filters.category ? 'All' : '—'}</option>
            {subcategories.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className={selectClass}
            value={filters.status ?? ''}
            onChange={(e) =>
              onChange({ status: (e.target.value || undefined) as LeadFilters['status'] })
            }
          >
            <option value="">Any status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exported">
          <select
            className={selectClass}
            value={filters.exported ?? ''}
            onChange={(e) =>
              onChange({ exported: (e.target.value || undefined) as LeadFilters['exported'] })
            }
          >
            <option value="">All</option>
            <option value="new">Not exported yet</option>
            <option value="exported">Already exported</option>
          </select>
        </Field>
        <Field label="Needs review">
          <select
            className={selectClass}
            value={filters.needsReview ?? ''}
            onChange={(e) =>
              onChange({
                needsReview: (e.target.value || undefined) as LeadFilters['needsReview'],
              })
            }
          >
            <option value="">Any</option>
            <option value="yes">Needs review</option>
            <option value="no">Passed the checks</option>
          </select>
        </Field>
        <Field label="Email type">
          <select
            className={selectClass}
            value={filters.emailType ?? ''}
            onChange={(e) =>
              onChange({ emailType: (e.target.value || undefined) as LeadFilters['emailType'] })
            }
          >
            <option value="">Any</option>
            <option value="GENERIC">Generic (info@, hello@ …)</option>
            <option value="PERSONAL">Personal (maria@ …)</option>
          </select>
        </Field>
        <Field label="Min. score">
          <select
            className={selectClass}
            value={filters.minScore ?? ''}
            onChange={(e) =>
              onChange({ minScore: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Any</option>
            {[25, 50, 65, 75].map((s) => (
              <option key={s} value={s}>
                {s}+
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chains">
          <select
            className={selectClass}
            value={filters.chain ?? ''}
            onChange={(e) =>
              onChange({ chain: (e.target.value || undefined) as LeadFilters['chain'] })
            }
          >
            <option value="">Include chains</option>
            <option value="no">No chains</option>
            <option value="yes">Chains only</option>
          </select>
        </Field>
        <Field label="Email">
          <select
            className={selectClass}
            value={filters.hasEmail ?? 'yes'}
            onChange={(e) =>
              onChange({ hasEmail: e.target.value as NonNullable<LeadFilters['hasEmail']> })
            }
          >
            <option value="yes">With email</option>
            <option value="no">Without email</option>
            <option value="any">All places</option>
          </select>
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setQ('');
              onReset();
            }}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  );
}
