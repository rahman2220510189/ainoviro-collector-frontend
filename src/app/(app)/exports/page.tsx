'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Tag } from '@/components/leads/badges';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import {
  useExportBatches,
  useRedownloadBatch,
  useUndoBatch,
  type ExportBatch,
} from '@/lib/exports';

const PROFILE_LABEL: Record<string, string> = {
  mailer_v1: 'Mailer (7 columns)',
  legacy_9col: 'Legacy (9 columns)',
  full: 'Full',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Spec §14: batch history, re-download, undo. */
export default function ExportsPage() {
  const batches = useExportBatches();
  const redownload = useRedownloadBatch();
  const undo = useUndoBatch();
  const [toUndo, setToUndo] = useState<ExportBatch | null>(null);

  return (
    <>
      <PageHeader
        title="Exports"
        description="Every CSV you downloaded. Download a file again, or undo it so its rows come back as new."
      />

      {batches.isPending ? (
        <LoadingState label="Loading exports…" />
      ) : batches.isError ? (
        <ErrorState message={batches.error.message} onRetry={() => void batches.refetch()} />
      ) : batches.data.length === 0 ? (
        <EmptyState
          title="No exports yet"
          description="Exports appear here after you click Download CSV on the Leads page."
          action={
            <Link
              href="/leads"
              className="inline-flex rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to leads
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Batch</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">File</th>
                <th className="px-4 py-2.5 text-right">Rows</th>
                <th className="px-4 py-2.5">Format</th>
                <th className="px-4 py-2.5">By</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.data.map((b) => (
                <tr key={b.id} className={b.status === 'UNDONE' ? 'text-slate-400' : ''}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    #{b.id}{' '}
                    {b.status === 'UNDONE' && (
                      <Tag
                        tone="amber"
                        title={b.undoneAt ? `Undone ${when(b.undoneAt)}` : undefined}
                      >
                        Undone
                      </Tag>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{when(b.createdAt)}</td>
                  <td className="max-w-xs truncate px-4 py-3" title={b.filename}>
                    {b.filename}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.rowCount}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {PROFILE_LABEL[b.profile] ?? b.profile}
                    {b.scope === 'all' && <span className="text-slate-400"> · incl. old</span>}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3">
                    {b.createdBy ?? 'command line'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1.5 text-xs"
                        loading={redownload.isPending && redownload.variables === b.id}
                        onClick={() => redownload.mutate(b.id)}
                      >
                        Download again
                      </Button>
                      {b.status === 'ACTIVE' && (
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => setToUndo(b)}
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={toUndo !== null}
        title={`Undo batch #${toUndo?.id ?? ''}?`}
        message={
          <>
            Its {toUndo?.rowCount ?? 0} rows go back to <b>new</b> and will be in the next export
            again. Rows whose status changed since (contacted, replied …) stay as they are. Only
            undo a file you did <b>not</b> import into the mailer.
          </>
        }
        confirmLabel="Undo batch"
        danger
        loading={undo.isPending}
        onCancel={() => setToUndo(null)}
        onConfirm={() => toUndo && undo.mutate(toUndo.id, { onSuccess: () => setToUndo(null) })}
      />
    </>
  );
}
