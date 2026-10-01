'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DownloadCsvButton } from '@/components/download-csv-button';
import { LeadDrawer } from '@/components/leads/lead-drawer';
import { LeadFiltersBar } from '@/components/leads/lead-filters';
import { LeadTable } from '@/components/leads/lead-table';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useExportPreview, type ExportProfile } from '@/lib/exports';
import { useBulkReject, useLeads, type LeadFilters } from '@/lib/leads';

const FILTER_KEYS = [
  'city',
  'category',
  'subcategory',
  'status',
  'emailType',
  'minScore',
  'needsReview',
  'exported',
  'chain',
  'hasEmail',
  'q',
] as const;

/** Filters live in the URL, so a link like /leads?needsReview=yes opens the right list. */
function readFilters(params: URLSearchParams): LeadFilters {
  const f: Record<string, unknown> = { country: 'CY', page: Number(params.get('page')) || 1 };
  for (const key of FILTER_KEYS) {
    const v = params.get(key);
    if (v) f[key] = key === 'minScore' ? Number(v) : v;
  }
  return f as unknown as LeadFilters;
}

function LeadsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => readFilters(new URLSearchParams(params.toString())), [params]);
  const [profile, setProfile] = useState<ExportProfile>('mailer_v1');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const leads = useLeads(filters);
  // The export uses the filters it understands; it always takes only new, checked rows.
  const exportFilters = {
    country: filters.country,
    city: filters.city,
    category: filters.category,
    subcategory: filters.subcategory,
    minScore: filters.minScore,
  };
  const preview = useExportPreview(exportFilters);
  const bulkReject = useBulkReject();

  const setFilters = useCallback(
    (patch: Partial<LeadFilters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      setSelected(new Set());
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const data = leads.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = FILTER_KEYS.some((k) => params.get(k));

  return (
    <>
      <PageHeader
        title="Leads"
        description="Businesses found by the jobs, best leads first."
        actions={
          <DownloadCsvButton
            filters={exportFilters}
            profile={profile}
            onProfileChange={setProfile}
            preview={preview.data}
            loadingPreview={preview.isPending}
          />
        }
      />

      <LeadFiltersBar
        filters={filters}
        onChange={setFilters}
        onReset={() => router.replace(pathname, { scroll: false })}
      />

      <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {data ? (
            <>
              <span className="font-medium text-slate-900">{data.total}</span> lead
              {data.total === 1 ? '' : 's'}
              {leads.isFetching && <span className="ml-2 text-slate-400">updating…</span>}
            </>
          ) : (
            ' '
          )}
        </p>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{selected.size} selected</span>
            <Button variant="secondary" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button variant="danger" onClick={() => setConfirmReject(true)}>
              Reject selected
            </Button>
          </div>
        )}
      </div>

      {leads.isPending ? (
        <LoadingState label="Loading leads…" />
      ) : leads.isError ? (
        <ErrorState message={leads.error.message} onRetry={() => void leads.refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No leads match these filters' : 'No leads yet'}
          description={
            filtered
              ? 'Try removing a filter.'
              : 'Run a job to find businesses; their emails are collected from their websites.'
          }
          action={
            filtered ? (
              <Button variant="secondary" onClick={() => router.replace(pathname)}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : data ? (
        <>
          <LeadTable
            rows={data.items}
            selected={selected}
            onOpen={setOpenId}
            onToggle={(id) =>
              setSelected((s) => {
                const next = new Set(s);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onToggleAll={() =>
              setSelected((s) =>
                data.items.every((r) => s.has(r.id))
                  ? new Set()
                  : new Set([...s, ...data.items.map((r) => r.id)]),
              )
            }
          />
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
              <Button
                variant="secondary"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
              >
                Previous
              </Button>
              <span className="text-slate-600">
                Page {filters.page} of {pages}
              </span>
              <Button
                variant="secondary"
                disabled={filters.page >= pages}
                onClick={() => setFilters({ page: filters.page + 1 })}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      ) : null}

      <LeadDrawer id={openId} onClose={() => setOpenId(null)} />

      <ConfirmDialog
        open={confirmReject}
        title={`Reject ${selected.size} lead${selected.size === 1 ? '' : 's'}?`}
        message="Rejected leads are never exported. You can change the status back later in the lead's details."
        confirmLabel="Reject"
        danger
        loading={bulkReject.isPending}
        onCancel={() => setConfirmReject(false)}
        onConfirm={() =>
          bulkReject.mutate([...selected], {
            onSuccess: () => {
              setConfirmReject(false);
              setSelected(new Set());
            },
          })
        }
      />
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LeadsView />
    </Suspense>
  );
}
