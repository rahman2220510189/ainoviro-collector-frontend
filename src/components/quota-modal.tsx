'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onQuotaModal } from '@/lib/quota-events';
import { Button } from './ui';

/**
 * Opens when the backend answers QUOTA_PAUSED (spec §8). Step 3.1 only tells the user
 * what happened; the two choices (free sources / extra EUR budget) arrive with the
 * jobs pages in step 3.4.
 */
export function QuotaModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => onQuotaModal(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quota-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="quota-title" className="text-base font-semibold text-slate-900">
          Google quota reached
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The free monthly Google limit is used up, so Google searches are paused. Nothing is lost:
          the job continues from where it stopped once you choose how to go on.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Link
            href="/jobs"
            onClick={() => setOpen(false)}
            className="inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to jobs
          </Link>
        </div>
      </div>
    </div>
  );
}
