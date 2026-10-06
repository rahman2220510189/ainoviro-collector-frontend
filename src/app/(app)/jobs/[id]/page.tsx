'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { languageName } from '@/lib/countries';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { ProgressBar, QuotaMeter, WorkerNotice } from '@/components/jobs/quota-meter';
import { Button, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import {
  fmt,
  useApproveBudget,
  useCategories,
  useJob,
  useJobAction,
  useQuotaStatus,
  when,
  type JobAction,
  type JobDetail,
  type QuotaStatus,
} from '@/lib/jobs';

function Stage({
  title,
  value,
  max,
  tone,
  children,
}: {
  title: string;
  value: number;
  max: number;
  tone: 'brand' | 'green';
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {fmt(value)}
        <span className="text-base font-normal text-slate-400"> / {fmt(max)}</span>
      </p>
      <div className="mt-2">
        <ProgressBar value={value} max={max} tone={tone} label={title} />
      </div>
      <div className="mt-2 text-xs text-slate-500">{children}</div>
    </section>
  );
}

/** Spec §8: what to do when the free Google requests are used up. */
function QuotaPausedPanel({ job, quota }: { job: JobDetail; quota: QuotaStatus | undefined }) {
  const action = useJobAction();
  const budget = useApproveBudget();
  const [eur, setEur] = useState('');
  const paidAllowed = (quota?.monthlyHardCapEur ?? 0) > 0;
  const price = quota?.pricePerRequestEur ?? 0;
  // Remaining searches x about 2 pages each, at the price per request.
  const estimate = job.stages.search.toDo * 2 * price;
  const freeBack = (quota?.freeRemaining ?? 0) > 0;
  const amount = Number(eur);
  const free = job.stages.free;

  return (
    <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-950">
        Paused: the free Google requests are used up
      </h2>
      <p className="mt-1 text-sm text-amber-900">
        Nothing is lost. {fmt(job.stages.search.toDo)} Google searches are waiting.
        {free && ' The free data keeps running.'} Websites already found are still crawled for
        emails.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-emerald-300 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Continue with free sources{' '}
            <span className="font-normal text-emerald-700">(recommended)</span>
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {free
              ? `Finish with the free Overture data (${fmt(free.businesses)} businesses so far) and website crawling.`
              : 'Finish the job with what was found; websites are still crawled for emails.'}{' '}
            The Google searches wait; Resume runs them later
            {freeBack ? '.' : ', e.g. next month when Google gives new free requests.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              loading={action.isPending && action.variables?.action === 'continue-free'}
              onClick={() => action.mutate({ id: job.id, action: 'continue-free' })}
            >
              Continue with free sources
            </Button>
            {freeBack && (
              <Button
                variant="secondary"
                loading={action.isPending && action.variables?.action === 'resume'}
                onClick={() => action.mutate({ id: job.id, action: 'resume' })}
              >
                Use {fmt(quota?.freeRemaining ?? 0)} free Google requests
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Continue with Google (paid)</h3>
          {paidAllowed ? (
            <>
              <p className="mt-1 text-sm text-slate-600">
                {price.toFixed(4)} EUR per request. The rest of this job costs about{' '}
                <b>{estimate.toFixed(2)} EUR</b>. Paid requests stop when this budget is spent.
              </p>
              <form
                className="mt-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  budget.mutate({ id: job.id, extraBudgetEur: amount });
                }}
              >
                <label className="sr-only" htmlFor="budget">
                  Extra budget in EUR
                </label>
                <input
                  id="budget"
                  type="number"
                  min="0.5"
                  step="0.5"
                  max={quota?.monthlyHardCapEur}
                  value={eur}
                  onChange={(e) => setEur(e.target.value)}
                  placeholder="EUR"
                  className="w-24 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  loading={budget.isPending}
                  disabled={!(amount > 0)}
                >
                  Approve and continue
                </Button>
              </form>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Turned off: the monthly limit for paid requests is 0 EUR, so nothing can be charged.
              It can be changed in Settings if ever needed.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const ACTIONS: Record<string, JobAction[]> = {
  QUEUED: ['start', 'cancel'],
  RUNNING: ['pause', 'cancel'],
  PAUSED_USER: ['resume', 'cancel'],
  PAUSED_QUOTA: ['cancel'],
  FAILED: ['resume', 'cancel'],
};

/** Google searches waiting after "Continue with free sources": Resume runs them. */
function GoogleWaitingNote({ job }: { job: JobDetail }) {
  const action = useJobAction();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p>
        Finished with the free sources. <b>{fmt(job.googleDeferred)}</b> Google searches are
        waiting; running them uses the free Google requests.
      </p>
      <Button
        variant="secondary"
        loading={action.isPending}
        onClick={() => action.mutate({ id: job.id, action: 'resume' })}
      >
        Run the Google searches
      </Button>
    </div>
  );
}

const ACTION_LABEL: Record<JobAction, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel job',
  'continue-free': 'Continue with free sources',
};

const LEVEL_STYLE: Record<string, string> = {
  INFO: 'text-slate-400',
  WARN: 'text-amber-600',
  ERROR: 'text-red-600',
};

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const job = useJob(id);
  const status = job.data?.status;
  const quota = useQuotaStatus(status === 'RUNNING');
  const queryClient = useQueryClient();
  // When the job changes state (e.g. finished or paused), show the final counter at once.
  useEffect(() => {
    if (status) void queryClient.invalidateQueries({ queryKey: ['jobs', 'quota'] });
  }, [status, queryClient]);
  const categories = useCategories();
  const action = useJobAction();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!Number.isInteger(id) || id <= 0) return <ErrorState message="Unknown job." />;
  if (job.isPending) return <LoadingState label="Loading job…" />;
  if (job.isError)
    return <ErrorState message={job.error.message} onRetry={() => void job.refetch()} />;

  const j = job.data;
  const s = j.stages;
  const searchesTotal = s.search.total - s.search.skipped;
  const categoryNames = j.options.categorySlugs.map(
    (slug) => categories.data?.find((c) => c.slug === slug)?.displayName ?? slug,
  );
  const crawlNote =
    s.places.waitingForCrawl > 0
      ? `${fmt(s.places.waitingForCrawl)} websites waiting.`
      : s.places.withWebsite > 0
        ? 'All websites checked.'
        : 'No new websites yet.';

  return (
    <>
      <PageHeader
        title={`#${j.id} ${j.name ?? ''}`}
        description={
          j.options.scopeLabel && j.options.scopeLabel !== j.name ? j.options.scopeLabel : undefined
        }
        actions={
          <>
            <JobStatusBadge status={j.status} />
            {(ACTIONS[j.status] ?? []).map((a) => (
              <Button
                key={a}
                variant={a === 'cancel' ? 'ghost' : a === 'pause' ? 'secondary' : 'primary'}
                className={a === 'cancel' ? 'text-red-700 hover:bg-red-50 hover:text-red-800' : ''}
                loading={action.isPending && action.variables?.action === a}
                onClick={() =>
                  a === 'cancel' ? setConfirmCancel(true) : action.mutate({ id: j.id, action: a })
                }
              >
                {ACTION_LABEL[a]}
              </Button>
            ))}
          </>
        }
      />

      {(j.status === 'RUNNING' || j.status === 'QUEUED' || s.places.waitingForCrawl > 0) && (
        <WorkerNotice quota={quota.data} />
      )}
      {j.status === 'PAUSED_QUOTA' && <QuotaPausedPanel job={j} quota={quota.data} />}
      {j.status === 'COMPLETED' && j.googleDeferred > 0 && <GoogleWaitingNote job={j} />}
      {j.status === 'FAILED' && j.lastError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">The job stopped with an error</p>
          <p className="mt-0.5">{j.lastError}</p>
          <p className="mt-1 text-red-700">Fix the cause, then press Resume.</p>
        </div>
      )}

      {s.free && (
        <section className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-emerald-950">Free data (Overture)</h2>
            <p className="text-xs text-emerald-800">
              {s.free.toDo > 0
                ? `${fmt(s.free.done)} of ${fmt(s.free.total)} areas done`
                : `All ${fmt(s.free.total)} areas done`}
              {s.free.failed > 0 && `, ${fmt(s.free.failed)} failed (retried on Resume)`}
            </p>
          </div>
          <p className="text-sm text-emerald-950">
            <b className="text-lg tabular-nums">{fmt(s.free.businesses)}</b> businesses
          </p>
          <p className="text-sm text-emerald-950">
            <b className="text-lg tabular-nums">{fmt(s.free.withEmail)}</b> with email
          </p>
          {s.free.withEmail > 0 && (
            <Link href="/leads" className="text-sm font-medium text-emerald-800 hover:underline">
              See leads
            </Link>
          )}
        </section>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stage
          title="1. Google searches"
          value={s.search.done}
          max={searchesTotal}
          tone={j.status === 'COMPLETED' ? 'green' : 'brand'}
        >
          {s.search.total === 0
            ? 'Not used in this job (free data only).'
            : `${fmt(j.resultsReturned)} results returned`}
          {s.search.failed > 0 && `, ${fmt(s.search.failed)} failed (retried on Resume)`}
          {s.search.skipped > 0 && `, ${fmt(s.search.skipped)} skipped`}
          {j.googleDeferred > 0 && `, ${fmt(j.googleDeferred)} waiting`}
          {s.search.total > 0 && '.'}
        </Stage>
        <Stage
          title="2. Websites checked"
          value={s.places.websitesChecked}
          max={s.places.withWebsite}
          tone={s.places.waitingForCrawl === 0 && s.places.withWebsite > 0 ? 'green' : 'brand'}
        >
          {fmt(s.places.newPlaces)} new businesses, {fmt(s.places.withWebsite)} with their own
          website. {crawlNote}
        </Stage>
        <Stage
          title="3. New businesses with email"
          value={s.places.withEmail}
          max={s.places.newPlaces}
          tone="green"
        >
          {s.places.withEmail > 0 ? (
            <Link href="/leads?exported=new" className="font-medium text-brand-700 hover:underline">
              See them on the Leads page
            </Link>
          ) : (
            'Emails appear while websites are checked.'
          )}
        </Stage>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Events
          </h2>
          {j.events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Nothing yet.</p>
          ) : (
            <ol className="max-h-[28rem] divide-y divide-slate-50 overflow-y-auto">
              {[...j.events].reverse().map((e, i) => (
                <li key={`${e.createdAt}-${i}`} className="flex gap-3 px-4 py-2 text-sm">
                  <span className="whitespace-nowrap text-xs tabular-nums text-slate-400">
                    {new Date(e.createdAt).toLocaleTimeString('en-GB')}
                  </span>
                  <span className={`text-xs font-semibold ${LEVEL_STYLE[e.level] ?? ''}`}>
                    {e.level === 'INFO' ? '•' : e.level}
                  </span>
                  <span className="min-w-0 break-words text-slate-700">{e.message}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          <QuotaMeter compact />
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h2 className="mb-2 font-semibold text-slate-900">Details</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-slate-500">Categories</dt>
                <dd className="text-slate-700">
                  {categoryNames.length > 0 ? categoryNames.join(', ') : 'All categories'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Keywords</dt>
                <dd className="text-slate-700">
                  {j.options.languages.length > 0
                    ? j.options.languages.map(languageName).join(' and ')
                    : 'English'}
                  {j.options.includeRural === false && ' · no small villages'}
                  {j.options.forceRerun && ' · recent searches repeated'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sources</dt>
                <dd className="text-slate-700">
                  {j.sources
                    .map((src) => (src === 'OVERTURE' ? 'Free data (Overture)' : 'Google'))
                    .join(' + ')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Mode</dt>
                <dd className="text-slate-700">
                  {j.options.mode === 'MOCK' ? 'Test (mock server)' : 'Real Google'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Created / started / finished</dt>
                <dd className="text-slate-700">
                  {when(j.createdAt)} / {j.startedAt ? when(j.startedAt) : '—'} /{' '}
                  {j.finishedAt ? when(j.finishedAt) : '—'}
                </dd>
              </div>
              {j.estimate?.estimated !== undefined && (
                <div>
                  <dt className="text-xs text-slate-500">Estimated Google requests</dt>
                  <dd className="text-slate-700">~{fmt(j.estimate.estimated)}</dd>
                </div>
              )}
              {j.paidRequestsUsed > 0 && (
                <div>
                  <dt className="text-xs text-slate-500">Paid requests</dt>
                  <dd className="text-slate-700">
                    {fmt(j.paidRequestsUsed)} (budget {j.extraBudgetEur ?? 0} EUR)
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel job #${j.id}?`}
        message="Searches not yet done are dropped. Businesses and emails already found stay. A cancelled job cannot be restarted; start a new one instead."
        confirmLabel="Cancel job"
        danger
        loading={action.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() =>
          action.mutate(
            { id: j.id, action: 'cancel' },
            { onSettled: () => setConfirmCancel(false) },
          )
        }
      />
    </>
  );
}
