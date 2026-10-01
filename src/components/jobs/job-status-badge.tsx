import { JOB_STATUS_LABEL, type JobStatus } from '@/lib/jobs';

const STYLE: Record<JobStatus, string> = {
  QUEUED: 'bg-slate-100 text-slate-700 ring-slate-200',
  RUNNING: 'bg-sky-50 text-sky-700 ring-sky-200',
  PAUSED_USER: 'bg-amber-50 text-amber-800 ring-amber-200',
  PAUSED_QUOTA: 'bg-amber-50 text-amber-800 ring-amber-300',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLE[status] ?? STYLE.QUEUED}`}
    >
      {status === 'RUNNING' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" aria-hidden />
      )}
      {JOB_STATUS_LABEL[status] ?? status}
    </span>
  );
}
