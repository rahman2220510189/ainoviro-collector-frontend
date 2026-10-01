'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { ProgressBar, QuotaMeter, WorkerNotice } from '@/components/jobs/quota-meter';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { fmt, searchProgress, useJobs, useQuotaStatus, when } from '@/lib/jobs';

const newJobLink = (
  <Link
    href="/jobs/new"
    className="inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
  >
    New job
  </Link>
);

/** Spec §14: every job with its status and progress, and the quota meter. */
export default function JobsPage() {
  const router = useRouter();
  const jobs = useJobs();
  const quota = useQuotaStatus(jobs.data?.some((j) => j.status === 'RUNNING') ?? false);

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Each job searches Google for businesses; their websites are then crawled for emails."
        actions={newJobLink}
      />
      <WorkerNotice quota={quota.data} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {jobs.isPending ? (
            <LoadingState label="Loading jobs…" />
          ) : jobs.isError ? (
            <ErrorState message={jobs.error.message} onRetry={() => void jobs.refetch()} />
          ) : jobs.data.length === 0 ? (
            <EmptyState
              title="No jobs yet"
              description="Start a job: choose districts or cities and categories, check the estimate, start."
              action={newJobLink}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Job</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="w-48 px-4 py-2.5">Searches</th>
                    <th className="px-4 py-2.5 text-right">Results</th>
                    <th className="px-4 py-2.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.data.map((job) => {
                    const p = searchProgress(job.tasks);
                    return (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="max-w-xs px-4 py-3">
                          <Link
                            href={`/jobs/${job.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate font-medium text-slate-900 hover:underline"
                          >
                            #{job.id} {job.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-3">
                          <ProgressBar
                            value={p.done}
                            max={p.total}
                            label={`Job ${job.id} searches done`}
                            tone={job.status === 'COMPLETED' ? 'green' : 'brand'}
                          />
                          <span className="mt-1 block text-xs tabular-nums text-slate-500">
                            {fmt(p.done)} / {fmt(p.total)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {fmt(job.resultsReturned)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {when(job.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <QuotaMeter />
        </aside>
      </div>
    </>
  );
}
