'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CategoryPicker } from '@/components/jobs/category-picker';
import {
  LocationPicker,
  selectionToIds,
  type LocationSelection,
} from '@/components/jobs/location-picker';
import { WorkerNotice } from '@/components/jobs/quota-meter';
import { languageName, useCountry } from '@/lib/countries';
import { Tag } from '@/components/leads/badges';
import { Button, ErrorState, LoadingState, PageHeader, Spinner } from '@/components/ui';
import {
  fmt,
  useCreateAndStartJob,
  useJobPreview,
  useLocationChildren,
  useQuotaStatus,
  type JobPreview,
  type JobRequest,
} from '@/lib/jobs';

const VERDICT = {
  FITS: {
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    text: 'Fits in the free requests left this month.',
  },
  MAY_NOT_FIT: {
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    text: 'Probably fits, but busy areas can need extra searches. If the free requests run out, the job pauses safely and nothing is charged.',
  },
  DOES_NOT_FIT: {
    tone: 'border-red-200 bg-red-50 text-red-900',
    text: 'Does not fit in the free requests left. The job will pause when they run out and can continue next month.',
  },
} as const;

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Option({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
      />
      <span>
        <span className="block font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

function EstimatePanel({
  preview,
  loading,
  error,
  missing,
}: {
  preview: JobPreview | undefined;
  loading: boolean;
  error: string | null;
  missing: string | null;
}) {
  if (missing) {
    return <p className="text-sm text-slate-500">{missing}</p>;
  }
  if (error) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>;
  }
  if (!preview) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Calculating…
      </div>
    );
  }
  const c = preview.cost;
  const verdict = VERDICT[c.verdict];
  const google = preview.sources.includes('GOOGLE_PLACES');
  const free = preview.sources.includes('OVERTURE');
  return (
    <div className={loading ? 'opacity-60 transition-opacity' : ''}>
      <p className="text-sm text-slate-600">{preview.scopeLabel}</p>
      {free && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-900">Free data (Overture)</p>
          <p className="mt-0.5 text-sm text-emerald-900">
            <b className="tabular-nums">{fmt(preview.overtureKnown.businesses)}</b> businesses here,{' '}
            <b className="tabular-nums">{fmt(preview.overtureKnown.withEmail)}</b> with email. Costs
            nothing.
          </p>
        </div>
      )}
      {!google ? (
        <p className="mt-3 text-xs text-slate-500">
          Google is not used: nothing counts against the free requests.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Searches</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {fmt(preview.tasksToRun)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Google requests (estimate)</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                ~{fmt(c.estimated)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">At least / at most</dt>
              <dd className="tabular-nums text-slate-700">
                {fmt(c.minimum)} / {fmt(c.maximumWithoutSplits)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Free left this month</dt>
              <dd className="tabular-nums text-slate-700">{fmt(c.freeRemaining)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            {preview.areas} search area{preview.areas === 1 ? '' : 's'} × {preview.keywordCount}{' '}
            keywords
            {preview.absorbedTowns > 0 &&
              `; ${preview.absorbedTowns} towns lie inside a bigger city`}
            .
          </p>
          {preview.skippedByCooldown > 0 && (
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {fmt(preview.skippedByCooldown)} searches are skipped: they ran in the last{' '}
              {preview.cooldownDays} days. Tick &quot;Search again&quot; to repeat them.
            </p>
          )}
          <p className={`mt-3 rounded-md border px-3 py-2 text-xs ${verdict.tone}`}>
            {verdict.text}
          </p>
        </>
      )}
    </div>
  );
}

/** The country comes from the sidebar; a new country starts a fresh form. */
export default function NewJobPage() {
  const { code, country } = useCountry();
  return <NewJobForm key={code} countryCode={code} localLanguages={country?.languages ?? []} />;
}

function NewJobForm({
  countryCode,
  localLanguages,
}: {
  countryCode: string;
  localLanguages: string[];
}) {
  const router = useRouter();
  const countries = useLocationChildren(null);
  const quota = useQuotaStatus();
  const create = useCreateAndStartJob();

  const [locations, setLocations] = useState<LocationSelection>(new Map());
  const [categories, setCategories] = useState<string[]>([]);
  const [local, setLocal] = useState(false);
  const [includeRural, setIncludeRural] = useState(true);
  const [forceRerun, setForceRerun] = useState(false);
  const [useGoogle, setUseGoogle] = useState(true);
  const [useFree, setUseFree] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const otherLanguages = localLanguages.filter((l) => l !== 'en');

  const country = countries.data?.find((c) => c.countryCode === countryCode);
  const locationIds = useMemo(() => selectionToIds(locations), [locations]);

  const request: JobRequest | null = useMemo(
    () =>
      locationIds.length > 0 && categories.length > 0
        ? {
            countryCode,
            locationIds: [...locationIds].sort((a, b) => a - b),
            categorySlugs: [...categories].sort(),
            greek: false,
            localLanguages: local,
            includeRural,
            forceRerun,
            // Both ticked = the default (free data is added only when it is imported).
            ...(useGoogle && useFree
              ? {}
              : { sources: useGoogle ? ['GOOGLE_PLACES' as const] : ['OVERTURE' as const] }),
          }
        : null,
    [countryCode, locationIds, categories, local, includeRural, forceRerun, useGoogle, useFree],
  );

  // The estimate waits until clicking pauses, so ticking ten boxes is one request.
  const [debounced, setDebounced] = useState<JobRequest | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(request), 400);
    return () => clearTimeout(timer);
  }, [request]);
  const preview = useJobPreview(debounced);
  const settled = debounced === request && !preview.isFetching;

  const missing =
    locationIds.length === 0 && categories.length === 0
      ? 'Choose where to search and at least one category.'
      : locationIds.length === 0
        ? 'Choose at least one district or city.'
        : categories.length === 0
          ? 'Choose at least one category.'
          : null;

  const usesGoogle = (preview.data?.tasksToRun ?? 0) > 0;
  const live = preview.data?.mode === 'LIVE' && usesGoogle;
  // Free data shows as unavailable once the backend says it is not imported for this country.
  const freeMissing = preview.data !== undefined && !preview.data.overtureAvailable;
  const canStart =
    request !== null &&
    settled &&
    preview.isSuccess &&
    (preview.data.tasksToRun > 0 || preview.data.overtureTasks > 0);

  const start = () => {
    if (!request) return;
    create.mutate(request, {
      onSuccess: (jobId) => router.push(`/jobs/${jobId}`),
      onSettled: () => setConfirm(false),
    });
  };

  if (countries.isPending) return <LoadingState />;
  if (countries.isError) {
    return (
      <ErrorState message={countries.error.message} onRetry={() => void countries.refetch()} />
    );
  }
  if (!country) {
    return (
      <ErrorState
        message={`${countryCode} is not in the location list yet. Add it in Settings, Countries.`}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="New job"
        description="Choose where and what to search. Emails are then collected from the businesses' own websites."
        actions={
          <Link href="/jobs" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to jobs
          </Link>
        }
      />
      <WorkerNotice quota={quota.data} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Section step={1} title={`Where (${country.name})`}>
            <LocationPicker countryId={country.id} selection={locations} onChange={setLocations} />
          </Section>

          <Section step={2} title="What">
            <CategoryPicker selected={categories} onChange={setCategories} />
          </Section>

          <Section step={3} title="Sources">
            <Option
              checked={useFree && !freeMissing}
              onChange={(v) => {
                setUseFree(v);
                if (!v) setUseGoogle(true);
              }}
              label="Free data (Overture Maps)"
              hint={
                freeMissing
                  ? `Not imported for ${country.name} yet (Settings, Free data).`
                  : 'Businesses from the free Overture dataset. Costs nothing and keeps running when Google is paused.'
              }
            />
            <Option
              checked={useGoogle}
              onChange={(v) => {
                if (!v && freeMissing) return; // Google is the only source then
                setUseGoogle(v);
                if (!v) setUseFree(true);
              }}
              label="Google searches"
              hint="Finds the newest businesses. Uses the free monthly Google requests."
            />
          </Section>

          <Section step={4} title="Options">
            <Option
              checked={includeRural}
              onChange={setIncludeRural}
              label="Include small villages"
              hint="Places too small for their own search are covered by one search per district."
            />
            {otherLanguages.length > 0 && (
              <Option
                checked={local}
                onChange={setLocal}
                label={`Also search with ${otherLanguages.map(languageName).join(' and ')} keywords`}
                hint={`Finds businesses listed only in ${otherLanguages.map(languageName).join(' or ')}. Adds more Google searches.`}
              />
            )}
            <Option
              checked={forceRerun}
              onChange={setForceRerun}
              label="Search again what was searched recently"
              hint="Normally searches from the last 30 days are skipped to save requests."
            />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Estimate</h2>
              {preview.data &&
                usesGoogle &&
                (live ? (
                  <Tag tone="green">Real Google</Tag>
                ) : (
                  <Tag tone="amber" title="Runs against the local mock server">
                    Test mode
                  </Tag>
                ))}
            </div>
            <EstimatePanel
              preview={request ? preview.data : undefined}
              loading={!settled}
              error={request && preview.isError ? preview.error.message : null}
              missing={missing}
            />
            <Button
              className="mt-5 w-full"
              disabled={!canStart}
              loading={create.isPending}
              onClick={() => (live ? setConfirm(true) : start())}
            >
              Start job
            </Button>
            {preview.data && !canStart && request && settled && preview.isSuccess && (
              <p className="mt-2 text-xs text-slate-500">
                Nothing to search: everything ran recently.
              </p>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Start with real Google requests?"
        message={
          preview.data && (
            <>
              This job sends real requests to Google: about{' '}
              <b>{fmt(preview.data.cost.estimated)}</b> (at least {fmt(preview.data.cost.minimum)},
              at most {fmt(preview.data.cost.maximumWithoutSplits)} before splitting busy areas).{' '}
              {fmt(preview.data.cost.freeRemaining)} free requests are left this month. When they
              run out the job pauses; nothing is paid without your approval.
            </>
          )
        }
        confirmLabel="Start job"
        loading={create.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={start}
      />
    </>
  );
}
