'use client';

import { Tag } from '@/components/leads/badges';
import { fmt, useQuotaStatus, type QuotaStatus } from '@/lib/jobs';

export function ProgressBar({
  value,
  max,
  tone = 'brand',
  label,
}: {
  value: number;
  max: number;
  tone?: 'brand' | 'amber' | 'red' | 'green';
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tones = {
    brand: 'bg-brand-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
    green: 'bg-emerald-600',
  };
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const MONTH = (period: string) =>
  new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

/** Free Google requests this month (spec §14: quota meter). */
export function QuotaMeter({ compact = false }: { compact?: boolean }) {
  const quota = useQuotaStatus();
  if (!quota.data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        {quota.isError ? 'Quota status not available.' : 'Loading quota…'}
      </div>
    );
  }
  const q = quota.data;
  // "used" also counts paid requests; the meter shows the free ones.
  const freeUsed = Math.min(q.used - q.paidCount, q.freeCap);
  const tone = q.freeRemaining === 0 ? 'red' : freeUsed >= q.warnAt ? 'amber' : 'brand';
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Google requests · {MONTH(q.period)}
        </h2>
        {q.mode === 'MOCK' ? (
          <Tag tone="amber" title="The backend points at the local mock server, not real Google">
            Test mode (mock)
          </Tag>
        ) : (
          <Tag tone={q.liveRequestsEnabled ? 'green' : 'slate'}>
            {q.liveRequestsEnabled ? 'Real Google: on' : 'Real Google: off'}
          </Tag>
        )}
      </div>
      <div className="mt-3">
        <ProgressBar value={freeUsed} max={q.freeCap} tone={tone} label="Free requests used" />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        <span className="font-medium text-slate-900">{fmt(freeUsed)}</span> of {fmt(q.freeCap)} free
        used · <span className="font-medium text-slate-900">{fmt(q.freeRemaining)}</span> left
        {q.paidCount > 0 && ` · ${fmt(q.paidCount)} paid`}
      </p>
      {!compact && (
        <p className="mt-1 text-xs text-slate-500">
          {q.monthlyHardCapEur > 0
            ? `Paid requests allowed up to ${q.monthlyHardCapEur} EUR a month, only with an approved budget.`
            : 'Paid requests are off: when the free requests run out, jobs pause until next month.'}
        </p>
      )}
    </section>
  );
}

/** Warns when jobs cannot move: the worker is not running, or real Google is switched off. */
export function WorkerNotice({ quota }: { quota: QuotaStatus | undefined }) {
  if (!quota) return null;
  const w = quota.worker;
  let title: string | null = null;
  let text: React.ReactNode = null;

  if (!w.running) {
    title = 'The background worker is not running';
    text = (
      <>
        Jobs only move forward while it runs. In a new command window, go to the{' '}
        <code className="rounded bg-amber-100 px-1">backend</code> folder and run{' '}
        <code className="rounded bg-amber-100 px-1">npm run worker</code>.
        {w.lastSeenAt && ` Last seen ${new Date(w.lastSeenAt).toLocaleString('en-GB')}.`}
      </>
    );
  } else if (!w.searching) {
    title = 'Google searches are switched off';
    text =
      quota.mode === 'LIVE'
        ? 'Real Google requests need GOOGLE_LIVE_REQUESTS=true in backend/.env (then restart the worker). Jobs wait until then; websites are still crawled for emails.'
        : 'The worker has no Google key set, so jobs wait. Websites are still crawled for emails.';
  } else if (w.mode && w.mode !== quota.mode) {
    title = 'The worker and the website use different modes';
    text = `The website plans ${quota.mode === 'MOCK' ? 'test (mock)' : 'real Google'} jobs, but the worker runs ${w.mode === 'MOCK' ? 'test (mock)' : 'real Google'} jobs. Check GOOGLE_PLACES_BASE_URL in backend/.env and restart both.`;
  }

  if (!title) return null;
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}
