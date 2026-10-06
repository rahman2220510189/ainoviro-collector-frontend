'use client';

import { REVIEW_REASON_LABEL, type LeadRow, signalLabel } from '@/lib/leads';
import { StatusBadge, Tag } from './badges';

/** Paginated table of leads with row selection for bulk actions. */
export function LeadTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: LeadRow[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onOpen: (id: number) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-10 px-3 py-2.5">
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-4 w-4 rounded border-slate-300"
              />
            </th>
            <th className="px-3 py-2.5">Business</th>
            <th className="px-3 py-2.5">Email</th>
            <th className="px-3 py-2.5">City</th>
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5 text-right">Score</th>
            <th className="px-3 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r.id)}
              className={`cursor-pointer hover:bg-slate-50 ${selected.has(r.id) ? 'bg-brand-50/60' : ''}`}
            >
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`Select ${r.name}`}
                  checked={selected.has(r.id)}
                  onChange={() => onToggle(r.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </td>
              <td className="max-w-xs px-3 py-2.5">
                <p className="truncate font-medium text-slate-900" title={r.name}>
                  {r.name}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {r.needsReview && (
                    <Tag
                      tone="amber"
                      title={r.reviewReasons.map((x) => REVIEW_REASON_LABEL[x] ?? x).join(', ')}
                    >
                      Needs review
                    </Tag>
                  )}
                  {r.isChain && <Tag tone="red">Chain</Tag>}
                  {r.onlineSignals.length > 0 && (
                    <Tag tone="green" title={r.onlineSignals.map(signalLabel).join(', ')}>
                      Sells online
                    </Tag>
                  )}
                </div>
              </td>
              <td className="max-w-xs px-3 py-2.5">
                {r.email ? (
                  <>
                    <p className="truncate text-slate-800" title={r.email}>
                      {r.email}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.emailOwnDomain && <Tag tone="green">Own domain</Tag>}
                      <Tag>{r.emailType === 'PERSONAL' ? 'Personal' : 'Generic'}</Tag>
                      {r.extraEmails > 0 && <Tag>+{r.extraEmails} more</Tag>}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-400">No email</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{r.city ?? '—'}</td>
              <td
                className="max-w-[12rem] truncate px-3 py-2.5 text-slate-700"
                title={r.category ?? ''}
              >
                {r.category ?? '—'}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{r.score}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
