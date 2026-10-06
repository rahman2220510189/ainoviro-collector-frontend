'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button, ErrorState, Spinner } from '@/components/ui';
import {
  formatBytes,
  refreshBusy,
  useOvertureLatest,
  useOvertureReport,
  useOvertureStatus,
  useRequestOvertureRefresh,
  type OvertureStatus,
  type RefreshState,
} from '@/lib/datasets';
import { useCountry } from '@/lib/countries';
import { fmt, when } from '@/lib/jobs';

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-slate-900">{fmt(value)}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

/** What the last or current update is doing, in one box. */
function RefreshBox({ refresh, code }: { refresh: RefreshState; code: string }) {
  const busy = refreshBusy(refresh);
  // Only one update runs at a time (shown on every country), but a finished or failed
  // one belongs to its own country.
  if (!busy && refresh.countryCode && refresh.countryCode !== code) return null;
  if (busy) {
    return (
      <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <p className="flex items-center gap-2 font-medium">
          <Spinner className="h-3.5 w-3.5" />
          {refresh.state === 'REQUESTED'
            ? 'Update requested: waiting for the worker'
            : 'Updating Overture data'}
          {refresh.countryCode && ` (${refresh.countryCode})`}
        </p>
        {refresh.state === 'RUNNING' && refresh.step && (
          <p className="mt-0.5 text-xs">{refresh.step}</p>
        )}
        <p className="mt-0.5 text-xs">
          This usually takes 10 to 30 minutes. You can leave this page.
        </p>
      </div>
    );
  }
  if (refresh.state === 'DONE' && refresh.result) {
    const r = refresh.result;
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <p className="font-medium">
          Last update finished{refresh.finishedAt ? ` ${when(refresh.finishedAt)}` : ''} (release{' '}
          {r.release})
        </p>
        <p className="mt-0.5 text-xs">
          {fmt(r.newBusinesses)} new businesses, {fmt(r.newEmails)} new emails,{' '}
          {fmt(r.duplicatesMerged)} duplicates merged. Ready to download: {fmt(r.readyBefore)} →{' '}
          {fmt(r.readyAfter)}.
        </p>
      </div>
    );
  }
  if (refresh.state === 'FAILED') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        <p className="font-medium">
          The last update failed{refresh.finishedAt ? ` (${when(refresh.finishedAt)})` : ''}
        </p>
        <p className="mt-0.5 break-words text-xs">{refresh.error}</p>
        <p className="mt-0.5 text-xs">The data from before is still in place. Try again later.</p>
      </div>
    );
  }
  if (refresh.state === 'REQUESTED' || refresh.state === 'RUNNING') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        The last update stopped without finishing (the worker was probably stopped). Start it again.
      </div>
    );
  }
  return null;
}

function CategoryBreakdown({ country }: { country: string }) {
  const [open, setOpen] = useState(false);
  const report = useOvertureReport(country, open);
  return (
    <details
      className="group border-t border-slate-100 px-5 py-3"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
        How the places are sorted into categories
      </summary>
      {report.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Counting…
        </p>
      ) : report.isError ? (
        <p className="mt-3 text-sm text-red-700">{report.error.message}</p>
      ) : (
        <div className="mt-3 grid gap-6 text-sm md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Kept: {fmt(report.data.mapped)} businesses
            </h3>
            <p className="mb-2 text-xs text-slate-500">
              Email counts are what Overture lists, before junk and mail-server checks.
            </p>
            <table className="w-full">
              <tbody>
                {report.data.byCategory.map((c) => (
                  <tr key={c.category} className="border-b border-slate-50">
                    <td className="py-1 text-slate-700">{c.category}</td>
                    <td className="py-1 text-right tabular-nums text-slate-900">{fmt(c.places)}</td>
                    <td className="py-1 pl-3 text-right text-xs tabular-nums text-slate-500">
                      {fmt(c.withEmail)} email
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.data.unmapped > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Plus {fmt(report.data.unmapped)} without a category in Overture: kept and held for
                review.
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Left out: {fmt(report.data.excluded)} (not businesses)
            </h3>
            <table className="w-full">
              <tbody>
                {report.data.byExclusion.map((c) => (
                  <tr key={c.reason} className="border-b border-slate-50">
                    <td className="py-1 text-slate-700">{c.reason}</td>
                    <td className="py-1 text-right tabular-nums text-slate-900">{fmt(c.places)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              The rules live in the backend file seed/overture-category-map.json.
            </p>
          </div>
        </div>
      )}
    </details>
  );
}

/** Settings: the free Overture dataset (status, update button, category breakdown). */
export function OverturePanel() {
  const { code, country } = useCountry();
  const status = useOvertureStatus(code);
  const latest = useOvertureLatest(code);
  const request = useRequestOvertureRefresh();
  const [confirm, setConfirm] = useState(false);
  const queryClient = useQueryClient();

  // When an update finishes, every page with lead counts is out of date.
  const lastState = useRef<string | undefined>(undefined);
  const state = status.data?.refresh.state;
  useEffect(() => {
    if (lastState.current && lastState.current !== state && state === 'DONE') {
      for (const key of ['dashboard', 'leads', 'jobs', 'countries']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
    lastState.current = state;
  }, [state, queryClient]);

  if (status.isPending) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <Spinner /> Loading…
      </section>
    );
  }
  if (status.isError) {
    return <ErrorState message={status.error.message} onRetry={() => void status.refetch()} />;
  }
  const o: OvertureStatus = status.data;
  const busy = refreshBusy(o.refresh);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Free data: Overture Maps · {country?.name ?? code}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          A free, open dataset of businesses, updated by Overture every month. Jobs use it with no
          Google requests.
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Data from</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {o.current ? o.current.release : 'Not imported'}
            </dd>
            {o.current?.finishedAt && (
              <dd className="text-xs text-slate-500">imported {when(o.current.finishedAt)}</dd>
            )}
          </div>
          <Stat label="Businesses" value={o.businesses} hint={`in ${o.countryCode}`} />
          <Stat label="With email" value={o.businessesWithEmail} />
          <Stat label="Websites to check" value={o.websitesWaiting} hint="by the worker" />
        </dl>

        <p className="text-xs text-slate-500">
          {latest.data?.release &&
            (latest.data.newer
              ? `A newer release is available: ${latest.data.release}. `
              : `This is the newest release (${latest.data.release}). `)}
          Database size: {formatBytes(o.databaseBytes)} (compare with your Neon plan&apos;s limit).
        </p>

        <RefreshBox refresh={o.refresh} code={code} />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={latest.data?.newer ? 'primary' : 'secondary'}
            disabled={busy}
            loading={request.isPending}
            onClick={() => setConfirm(true)}
          >
            Update Overture data
          </Button>
          <p className="text-xs text-slate-500">
            Downloads only the part for {o.countryCode}, adds new businesses and emails, then merges
            duplicates. Done by the worker.
          </p>
        </div>
      </div>

      <CategoryBreakdown key={code} country={code} />

      <ConfirmDialog
        open={confirm}
        title="Update the Overture data?"
        message={
          <>
            The worker downloads the newest Overture release for {o.countryCode} (about 10 to 30
            minutes). Businesses and emails you already have stay; nothing is charged. The worker
            must be running.
          </>
        }
        confirmLabel="Start update"
        loading={request.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => request.mutate(code, { onSettled: () => setConfirm(false) })}
      />
    </section>
  );
}
