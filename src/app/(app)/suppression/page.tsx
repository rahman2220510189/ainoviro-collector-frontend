'use client';

import { useEffect, useState } from 'react';
import { Tag } from '@/components/leads/badges';
import {
  AddEmailCard,
  ImportListCard,
  MailerResultsCard,
} from '@/components/suppression/import-cards';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { REASON_LABEL, useSuppressionList } from '@/lib/suppression';

const REASONS = Object.keys(REASON_LABEL);

/** Spec §14: import contacts / bounces / unsubscribes, add one email, import mailer results. */
export default function SuppressionPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const list = useSuppressionList({ q, reason, page });

  // Search waits until typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const totalBlocked = data ? Object.values(data.counts).reduce((s, n) => s + n, 0) : 0;

  return (
    <>
      <PageHeader
        title="Suppression"
        description="Addresses that are never collected again and never exported. The list is checked when saving and again at every export."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <AddEmailCard />
        <ImportListCard />
        <MailerResultsCard />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Blocked addresses</h2>
            {data && (
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                <span>{totalBlocked} in total:</span>
                {REASONS.filter((r) => data.counts[r]).map((r) => (
                  <Tag key={r}>
                    {REASON_LABEL[r]} {data.counts[r]}
                  </Tag>
                ))}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email or domain"
              aria-label="Search"
              className="w-56 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <select
              value={reason}
              aria-label="Reason"
              onChange={(e) => {
                setReason(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm"
            >
              <option value="">All reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={q || reason ? 'Nothing matches' : 'The list is empty'}
              description={
                q || reason
                  ? 'Try another search or reason.'
                  : 'Import your existing contacts first, so they never get a cold email.'
              }
            />
          </div>
        ) : data ? (
          <>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-xs truncate px-4 py-2.5 text-slate-900">
                      {s.email ?? (
                        <span className="text-slate-400" title="Only a hash is kept">
                          hidden{s.domain ? ` (…@${s.domain})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Tag
                        tone={
                          s.reason === 'BOUNCED' || s.reason === 'UNSUBSCRIBED' ? 'amber' : 'slate'
                        }
                      >
                        {REASON_LABEL[s.reason] ?? s.reason}
                      </Tag>
                    </td>
                    <td
                      className="max-w-[14rem] truncate px-4 py-2.5 text-slate-600"
                      title={s.sourceFile ?? ''}
                    >
                      {s.sourceFile ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {new Date(s.addedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <nav className="flex items-center justify-between border-t border-slate-100 p-3 text-sm">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-slate-600">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}
