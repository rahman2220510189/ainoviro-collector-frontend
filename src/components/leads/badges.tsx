import { STATUS_LABEL } from '@/lib/leads';

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-sky-50 text-sky-700 ring-sky-200',
  EXPORTED: 'bg-slate-100 text-slate-700 ring-slate-200',
  CONTACTED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  REPLIED: 'bg-violet-50 text-violet-700 ring-violet-200',
  ONBOARDED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PRODUCT_ADDED: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status] ?? STATUS_STYLE.EXPORTED}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Tag({
  children,
  tone = 'slate',
  title,
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'amber' | 'red' | 'green';
  title?: string;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      title={title}
      className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
