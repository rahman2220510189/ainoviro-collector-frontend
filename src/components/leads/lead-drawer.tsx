'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button, ErrorState, LoadingState } from '@/components/ui';
import {
  LEAD_STATUSES,
  REVIEW_REASON_LABEL,
  STATUS_LABEL,
  useEraseLead,
  useLead,
  useSetLeadStatus,
  type LeadStatus,
} from '@/lib/leads';
import { StatusBadge, Tag } from './badges';

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

const HISTORY_LABEL: Record<string, string> = {
  'lead.status': 'Status changed',
  'lead.erase': 'Personal data erased',
  'place.merge': 'Duplicate merged into this business',
  'export.create': 'Exported',
};

function historyText(action: string, d: Record<string, unknown> | null): string {
  if (!d) return '';
  if (action === 'lead.status')
    return `${d.from ? `${STATUS_LABEL[String(d.from)] ?? d.from} → ` : ''}${STATUS_LABEL[String(d.to)] ?? d.to}${d.bulk ? ' (bulk)' : ''}`;
  if (action === 'export.create') return `${d.file ?? ''}${d.undone ? ' (undone)' : ''}`;
  if (action === 'place.merge' && Array.isArray(d.merged))
    return (d.merged as { name?: string }[]).map((m) => m.name).join(', ');
  if (action === 'lead.erase') return `${d.emailsErased ?? 0} email(s)`;
  return '';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

/** Right-side panel with everything about one lead (spec §14: sources, emails, history). */
export function LeadDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const lead = useLead(id);
  const setStatus = useSetLeadStatus();
  const erase = useEraseLead();
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    if (id === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirmErase && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose, confirmErase]);

  if (id === null) return null;
  const l = lead.data;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Lead details"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{l?.name ?? 'Lead'}</h2>
            {l && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={l.status} />
                <Tag>Score {l.score}</Tag>
                {l.isChain && <Tag tone="red">Chain</Tag>}
                {l.businessStatus !== 'OPERATIONAL' && (
                  <Tag tone="amber">{l.businessStatus.replaceAll('_', ' ').toLowerCase()}</Tag>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {lead.isPending && <LoadingState />}
        {lead.isError && (
          <ErrorState message={lead.error.message} onRetry={() => void lead.refetch()} />
        )}
        {l && (
          <>
            {l.needsReview && (
              <div className="mx-5 mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">Needs review — not exported until fixed</p>
                <ul className="mt-1 list-disc pl-5">
                  {l.reviewReasons.map((r) => (
                    <li key={r}>{REVIEW_REASON_LABEL[r] ?? r}</li>
                  ))}
                </ul>
              </div>
            )}

            <Section title="Status">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Status"
                  value={l.status}
                  disabled={setStatus.isPending}
                  onChange={(e) =>
                    setStatus.mutate({ id: l.id, status: e.target.value as LeadStatus })
                  }
                  className="rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                {setStatus.isPending && <span className="text-xs text-slate-500">Saving…</span>}
              </div>
            </Section>

            <Section title="Contact">
              <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-slate-900">
                  {l.phone ?? '—'} {l.phone && !l.phoneValid && <Tag tone="amber">not valid</Tag>}
                </dd>
                <dt className="text-slate-500">Website</dt>
                <dd className="truncate">
                  {l.website ? (
                    <a
                      href={l.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      {l.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt className="text-slate-500">Address</dt>
                <dd className="text-slate-900">{l.address ?? '—'}</dd>
                <dt className="text-slate-500">City</dt>
                <dd className="text-slate-900">{l.city ?? '—'}</dd>
                <dt className="text-slate-500">Rating</dt>
                <dd className="text-slate-900">
                  {l.rating !== null ? `${l.rating} (${l.ratingCount ?? 0} reviews)` : '—'}
                </dd>
              </dl>
            </Section>

            <Section title={`Emails (${l.emails.length})`}>
              {l.emails.length === 0 ? (
                <p className="text-sm text-slate-500">No email found on the website.</p>
              ) : (
                <ul className="space-y-2">
                  {l.emails.map((e) => (
                    <li key={e.id} className="text-sm">
                      <p className="font-medium text-slate-900">{e.email}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {e.isPrimary && <Tag tone="green">Primary</Tag>}
                        <Tag>{e.emailType === 'PERSONAL' ? 'Personal' : 'Generic'}</Tag>
                        {e.isOwnDomain && <Tag>Own domain</Tag>}
                        {e.mxValid === false && <Tag tone="red">No mail server</Tag>}
                        {e.exportedAt && <Tag>Exported {date(e.exportedAt)}</Tag>}
                        <Tag title={e.sourceUrl ?? undefined}>found via {e.source}</Tag>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Categories">
              <ul className="space-y-1 text-sm">
                {l.subcategories.map((s) => (
                  <li key={s.name} className="text-slate-800">
                    {s.name} <span className="text-slate-400">· {s.category}</span>{' '}
                    {s.isPrimary && <Tag tone="green">Primary</Tag>}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Sources">
              <ul className="space-y-1 text-sm text-slate-700">
                {l.sources.map((s) => (
                  <li key={`${s.source}:${s.recordId}`}>
                    {s.source.replace('_', ' ')} · fetched {date(s.fetchedAt)}
                  </li>
                ))}
                <li className="text-slate-500">
                  First seen {date(l.firstSeenAt)} · website checked {date(l.lastCrawledAt)}
                </li>
              </ul>
            </Section>

            <Section title="History">
              {l.history.length === 0 ? (
                <p className="text-sm text-slate-500">No changes yet.</p>
              ) : (
                <ol className="space-y-1.5 text-sm">
                  {l.history.map((h, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-24 shrink-0 text-slate-500">{date(h.at)}</span>
                      <span className="text-slate-800">
                        {HISTORY_LABEL[h.action] ?? h.action}
                        <span className="text-slate-500"> {historyText(h.action, h.details)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Privacy">
              <p className="mb-3 text-sm text-slate-600">
                If this business asks to be forgotten: its emails and phone are deleted, and the
                addresses are blocked so they are never collected again.
              </p>
              <Button variant="danger" onClick={() => setConfirmErase(true)}>
                Erase personal data
              </Button>
            </Section>

            <ConfirmDialog
              open={confirmErase}
              title="Erase personal data?"
              message={
                <>
                  All {l.emails.length} email(s) and the phone number of <b>{l.name}</b> will be
                  deleted and the lead set to Rejected. This cannot be undone.
                </>
              }
              confirmLabel="Erase"
              danger
              loading={erase.isPending}
              onCancel={() => setConfirmErase(false)}
              onConfirm={() => erase.mutate(l.id, { onSuccess: () => setConfirmErase(false) })}
            />
          </>
        )}
      </aside>
    </div>
  );
}
