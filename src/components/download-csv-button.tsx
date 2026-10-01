'use client';

import Link from 'next/link';
import {
  EXPORT_PROFILES,
  useDownloadCsv,
  type ExportFilters,
  type ExportPreview,
  type ExportProfile,
} from '@/lib/exports';
import { Button } from './ui';

/**
 * Spec §14: a prominent "Download CSV (N new)" button that respects the active filters,
 * downloads in one click with no dialog, plus a small profile dropdown and a
 * "N need review" link.
 */
export function DownloadCsvButton({
  filters,
  profile,
  onProfileChange,
  preview,
  loadingPreview,
}: {
  filters: ExportFilters;
  profile: ExportProfile;
  onProfileChange: (p: ExportProfile) => void;
  preview: ExportPreview | undefined;
  loadingPreview: boolean;
}) {
  const download = useDownloadCsv();
  const count = preview?.newRows ?? 0;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {preview && preview.needsReview > 0 && (
        <Link
          href="/leads?needsReview=yes"
          className="text-sm font-medium text-amber-700 hover:underline"
        >
          {preview.needsReview} need review
        </Link>
      )}
      <label className="sr-only" htmlFor="export-profile">
        Export format
      </label>
      <select
        id="export-profile"
        value={profile}
        onChange={(e) => onProfileChange(e.target.value as ExportProfile)}
        className="rounded-md border border-slate-300 bg-white py-2 pl-2 pr-7 text-sm text-slate-700"
      >
        {EXPORT_PROFILES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {profile !== 'mailer_v1' && (
        <span
          className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
          title="The mailer imports only the 7-column format"
        >
          Not for the mailer
        </span>
      )}
      <Button
        onClick={() => download.mutate({ filters, profile })}
        loading={download.isPending}
        disabled={loadingPreview || count === 0}
        title={count === 0 ? 'No new rows to export' : undefined}
      >
        {loadingPreview ? 'Download CSV' : `Download CSV (${count} new)`}
      </Button>
    </div>
  );
}
