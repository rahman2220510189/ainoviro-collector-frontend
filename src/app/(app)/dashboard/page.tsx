'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BarList, ColumnChart } from '@/components/dashboard/column-chart';
import { ProgressBar, WorkerNotice } from '@/components/jobs/quota-meter';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { dayShort, monthShort, pct, useDashboard, type DashboardSummary } from '@/lib/dashboard';
import { fmt, useQuotaStatus, when, type QuotaStatus } from '@/lib/jobs';
import { STATUS_LABEL } from '@/lib/leads';
import { REASON_LABEL } from '@/lib/suppression';

// ---- small building blocks ---------------------------------------------------------------

function Card({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({
  label,
  value,
  note,
  href,
  hero = false,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  href?: string;
  hero?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 font-semibold tracking-tight text-slate-900 ${hero ? 'text-5xl' : 'text-3xl'}`}
      >
        {value}
      </p>
      {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
    </>
  );
  const cls = `block rounded-lg border bg-white p-5 ${
    hero ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-200'
  }`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-brand-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A label/value list; a row with a link opens the matching filtered list. */
function Facts({
  rows,
}: {
  rows: { label: string; value: string; href?: string; muted?: boolean }[];
}) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className={r.muted ? 'text-slate-400' : 'text-slate-600'}>
            {r.href ? (
              <Link href={r.href} className="hover:text-slate-900 hover:underline">
                {r.label}
              </Link>
            ) : (
              r.label
            )}
          </dt>
          <dd className="tabular-nums font-medium text-slate-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const StatusDot = ({ ok }: { ok: boolean }) => (
  <span
    aria-hidden
    className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`}
  />
);

// ---- sections ----------------------------------------------------------------------------

type Metric = 'newEmails' | 'newPlaces' | 'exported';
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'newEmails', label: 'New emails', unit: 'new emails' },
  { key: 'newPlaces', label: 'New businesses', unit: 'new businesses' },
  { key: 'exported', label: 'Exported rows', unit: 'rows exported' },
];

function ActivityCard({ d }: { d: DashboardSummary }) {
  const [metric, setMetric] = useState<Metric>('newEmails');
  const [table, setTable] = useState(false);
  const m = METRICS.find((x) => x.key === metric) ?? METRICS[0]!;
  const total = d.activity.reduce((a, r) => a + r[metric], 0);
  return (
    <Card
      title="Last 30 days"
      className="lg:col-span-2"
      action={
        <div className="flex items-center gap-1" role="group" aria-label="What to show">
          {METRICS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={metric === x.key}
              onClick={() => setMetric(x.key)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                metric === x.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        <span className="text-2xl font-semibold text-slate-900">{fmt(total)}</span> {m.unit} in 30
        days
      </p>
      {table ? (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1">Day</th>
                <th className="py-1 text-right">New emails</th>
                <th className="py-1 text-right">New businesses</th>
                <th className="py-1 text-right">Exported</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-slate-700">
              {[...d.activity].reverse().map((r) => (
                <tr key={r.date} className="border-t border-slate-100">
                  <td className="py-1">{dayShort(r.date)}</td>
                  <td className="py-1 text-right">{r.newEmails}</td>
                  <td className="py-1 text-right">{r.newPlaces}</td>
                  <td className="py-1 text-right">{r.exported}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ColumnChart
          title={`${m.label} per day, last 30 days`}
          columns={d.activity.map((r) => ({
            label: dayShort(r.date),
            value: r[metric],
            tooltip: [dayShort(r.date), `${fmt(r[metric])} ${m.unit}`],
          }))}
        />
      )}
      <button
        type="button"
        onClick={() => setTable((t) => !t)}
        className="mt-3 text-xs font-medium text-brand-700 hover:underline"
      >
        {table ? 'Show chart' : 'Show as table'}
      </button>
    </Card>
  );
}

function SystemCard({ d, quota }: { d: DashboardSummary; quota: QuotaStatus | undefined }) {
  const jobs = d.jobs.byStatus;
  const w = quota?.worker;
  return (
    <Card
      title="System"
      action={
        <Link href="/jobs" className="text-xs font-medium text-brand-700 hover:underline">
          Jobs
        </Link>
      }
    >
      <ul className="space-y-2 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <StatusDot ok={w?.running ?? false} />
          Worker {w?.running ? 'running' : 'not running'}
        </li>
        <li className="flex items-center gap-2">
          <StatusDot ok={(w?.running && w.searching) ?? false} />
          Google searches{' '}
          {quota?.mode === 'MOCK'
            ? '(test mode)'
            : w?.running && w.searching
              ? 'on'
              : quota?.liveRequestsEnabled
                ? 'ready'
                : 'off'}
        </li>
        <li className="flex items-center gap-2">
          <StatusDot ok={(w?.running && w.crawling) ?? false} />
          Email search on websites {w?.running && w.crawling ? 'on' : 'off'}
        </li>
      </ul>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <Facts
          rows={[
            { label: 'Jobs running', value: fmt(jobs.RUNNING ?? 0) },
            {
              label: 'Jobs paused',
              value: fmt((jobs.PAUSED_USER ?? 0) + (jobs.PAUSED_QUOTA ?? 0)),
            },
            { label: 'Jobs finished', value: fmt(jobs.COMPLETED ?? 0) },
            {
              label: 'Websites waiting for email search',
              value: fmt(d.websites.waiting),
            },
          ]}
        />
      </div>
    </Card>
  );
}

const FUNNEL = [
  'NEW',
  'EXPORTED',
  'CONTACTED',
  'REPLIED',
  'ONBOARDED',
  'PRODUCT_ADDED',
  'REJECTED',
];

function GoogleCard({ d, quota }: { d: DashboardSummary; quota: QuotaStatus | undefined }) {
  const current = d.google.months.at(-1);
  const thisPeriod = quota?.period;
  const realThisMonth =
    current && current.period === thisPeriod ? current.requests : thisPeriod ? 0 : null;
  const perEmail =
    realThisMonth && d.emails.newThisMonth > 0 ? realThisMonth / d.emails.newThisMonth : null;
  const freeUsed = quota ? Math.min(quota.used - quota.paidCount, quota.freeCap) : 0;
  return (
    <Card title="Google requests">
      {quota && (
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-slate-600">
              This month{quota.mode === 'MOCK' ? ' (test counter)' : ''}
            </span>
            <span className="tabular-nums text-slate-900">
              <b>{fmt(freeUsed)}</b> / {fmt(quota.freeCap)} free
            </span>
          </div>
          <ProgressBar
            value={freeUsed}
            max={quota.freeCap}
            tone={quota.freeRemaining === 0 ? 'red' : freeUsed >= quota.warnAt ? 'amber' : 'brand'}
            label="Free Google requests used this month"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            {fmt(quota.freeRemaining)} left · resets on the 1st ·{' '}
            {quota.monthlyHardCapEur > 0
              ? `paid allowed up to ${quota.monthlyHardCapEur} EUR`
              : 'paid requests off'}
          </p>
        </div>
      )}
      {d.google.months.length > 0 ? (
        <>
          <p className="mb-2 text-xs text-slate-500">Real Google requests per month</p>
          <ColumnChart
            height={96}
            title="Real Google requests per month"
            columns={d.google.months.map((m) => ({
              label: monthShort(m.period),
              value: m.requests,
              tooltip: [
                monthShort(m.period),
                `${fmt(m.requests)} requests`,
                ...(m.paid > 0 ? [`${fmt(m.paid)} paid`] : []),
              ],
            }))}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">No real Google requests yet.</p>
      )}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <Facts
          rows={[
            {
              label: 'Requests per new email (this month)',
              value: perEmail === null ? '—' : perEmail.toFixed(1),
            },
            {
              label: 'Price if it were paid',
              value:
                perEmail === null || !quota
                  ? '—'
                  : `${(perEmail * quota.pricePerRequestEur).toFixed(3)} EUR / email`,
              muted: true,
            },
          ]}
        />
      </div>
    </Card>
  );
}

// ---- page --------------------------------------------------------------------------------

/** Spec §14 (dashboard) and Phase 5 (cost per new email): everything at a glance. */
export default function DashboardPage() {
  const dash = useDashboard();
  const quota = useQuotaStatus();

  if (dash.isPending) return <LoadingState label="Loading the dashboard…" />;
  if (dash.isError) {
    return <ErrorState message={dash.error.message} onRetry={() => void dash.refetch()} />;
  }
  const d = dash.data;
  const l = d.leads;
  const e = d.emails;
  const w = d.websites;
  const checked = w.emailFound + w.noEmailFound;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Cyprus · updated ${new Date(d.generatedAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        })} (refreshes every minute)`}
        actions={
          <Link
            href="/jobs/new"
            className="inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New job
          </Link>
        }
      />
      <WorkerNotice quota={quota.data} />

      {/* Headline numbers */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          hero
          label="Ready to download"
          value={fmt(l.ready)}
          href="/leads"
          note={
            <>
              New, checked emails for the mailer.
              {l.needsReview > 0 && (
                <span className="font-medium text-amber-700"> {l.needsReview} need review.</span>
              )}
            </>
          }
        />
        <Tile
          label="New emails this month"
          value={fmt(e.newThisMonth)}
          note={`${fmt(e.total)} emails in total`}
        />
        <Tile
          label="Businesses with email"
          value={fmt(l.withEmail)}
          note={`of ${fmt(l.totalPlaces)} businesses found (${pct(l.withEmail, l.totalPlaces)})`}
          href="/leads?hasEmail=yes"
        />
        <Tile
          label="Exported"
          value={fmt(d.exports.rows)}
          note={
            d.exports.lastExportAt
              ? `Last download ${when(d.exports.lastExportAt)} · ${fmt(d.exports.rowsThisMonth)} this month`
              : 'Nothing downloaded yet'
          }
          href="/exports"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <ActivityCard d={d} />
        <SystemCard d={d} quota={quota.data} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card
          title="Leads by status"
          action={
            <Link href="/leads" className="text-xs font-medium text-brand-700 hover:underline">
              Leads
            </Link>
          }
        >
          <BarList
            emptyText="No leads yet."
            rows={FUNNEL.filter((s) => (l.byStatus[s] ?? 0) > 0).map((s) => ({
              label: STATUS_LABEL[s] ?? s,
              value: l.byStatus[s] ?? 0,
              href: `/leads?status=${s}`,
            }))}
          />
          <div className="mt-4 border-t border-slate-100 pt-3">
            <Facts
              rows={[
                { label: 'Need review', value: fmt(l.needsReview), href: '/leads?needsReview=yes' },
                { label: 'Chains (held back)', value: fmt(l.chains), href: '/leads?chain=yes' },
                { label: 'Closed on Google', value: fmt(l.closed), muted: true },
              ]}
            />
          </div>
        </Card>

        <Card title="Emails">
          <Facts
            rows={[
              { label: 'All emails', value: fmt(e.total) },
              {
                label: 'General (info@, contact@ …)',
                value: `${fmt(e.generic)} · ${pct(e.generic, e.total)}`,
                href: '/leads?emailType=GENERIC',
              },
              {
                label: 'Personal (a name)',
                value: `${fmt(e.personal)} · ${pct(e.personal, e.total)}`,
                href: '/leads?emailType=PERSONAL',
              },
              { label: 'On the business’s own domain', value: fmt(e.ownDomain) },
              { label: 'Free mail (gmail, yahoo …)', value: fmt(e.freeMail) },
              { label: 'Exported', value: fmt(e.exported) },
              { label: 'No mail server (held back)', value: fmt(e.noMailServer), muted: true },
              { label: 'Bounced', value: fmt(e.bounced), muted: true },
              { label: 'Unsubscribed', value: fmt(e.unsubscribed), muted: true },
            ]}
          />
        </Card>

        <Card title="Email search on websites">
          {checked > 0 ? (
            <p className="mb-1 text-sm text-slate-600">
              Email found on{' '}
              <span className="text-2xl font-semibold text-slate-900">
                {pct(w.emailFound, checked)}
              </span>{' '}
              of the websites read
            </p>
          ) : (
            <p className="mb-1 text-sm text-slate-600">No website has been read successfully yet.</p>
          )}
          <div className="mb-4">
            <ProgressBar
              value={w.emailFound}
              max={checked}
              tone="green"
              label="Websites with an email"
            />
          </div>
          <Facts
            rows={[
              { label: 'Businesses with their own website', value: fmt(w.withWebsite) },
              { label: 'Websites crawled', value: fmt(w.crawled) },
              { label: 'Email found', value: fmt(w.emailFound) },
              { label: 'No email on the website', value: fmt(w.noEmailFound) },
              { label: 'Could not be read', value: fmt(w.failed), muted: true },
              { label: 'robots.txt said no', value: fmt(w.robotsBlocked), muted: true },
              { label: 'Waiting', value: fmt(w.waiting) },
            ]}
          />
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Top cities">
          <BarList
            emptyText="No emails yet."
            rows={d.topCities.map((c) => ({
              label: c.name,
              value: c.withEmail,
              note: `${fmt(c.ready)} ready`,
              href: c.name === 'Unknown' ? undefined : `/leads?city=${encodeURIComponent(c.name)}`,
            }))}
          />
          <p className="mt-3 text-xs text-slate-400">Businesses with email · ready to download</p>
        </Card>
        <Card title="Top categories">
          <BarList
            emptyText="No emails yet."
            rows={d.topCategories.map((c) => ({
              label: c.name,
              value: c.withEmail,
              note: `${fmt(c.ready)} ready`,
            }))}
          />
          <p className="mt-3 text-xs text-slate-400">Businesses with email · ready to download</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GoogleCard d={d} quota={quota.data} />
        <Card
          title="Exports"
          action={
            <Link href="/exports" className="text-xs font-medium text-brand-700 hover:underline">
              Exports
            </Link>
          }
        >
          <Facts
            rows={[
              { label: 'Downloads (batches)', value: fmt(d.exports.batches) },
              { label: 'Rows exported', value: fmt(d.exports.rows) },
              { label: 'Rows this month', value: fmt(d.exports.rowsThisMonth) },
              {
                label: 'Last download',
                value: d.exports.lastExportAt ? when(d.exports.lastExportAt) : '—',
              },
              { label: 'Ready for the next download', value: fmt(l.ready) },
            ]}
          />
        </Card>
        <Card
          title="Suppression"
          action={
            <Link
              href="/suppression"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Suppression
            </Link>
          }
        >
          <p className="mb-3 text-sm text-slate-600">
            <span className="text-2xl font-semibold text-slate-900">
              {fmt(d.suppression.total)}
            </span>{' '}
            addresses never get an email
          </p>
          {d.suppression.total > 0 ? (
            <Facts
              rows={Object.entries(d.suppression.byReason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, n]) => ({ label: REASON_LABEL[reason] ?? reason, value: fmt(n) }))}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Import your current contacts and vendors before the first campaign.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
