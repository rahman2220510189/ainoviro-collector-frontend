'use client';

import { ChainList } from '@/components/settings/chain-list';
import { CountriesPanel } from '@/components/settings/countries-panel';
import { OverturePanel } from '@/components/settings/overture-panel';
import { SectionForm, type FieldGroup } from '@/components/settings/section-form';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { fmt } from '@/lib/jobs';
import { useSettings } from '@/lib/settings';

// ---- what each section shows (values keep the backend's names and units) ---------------

const QUOTA: FieldGroup[] = [
  {
    fields: [
      {
        path: 'freeLimit',
        label: 'Free Google requests per month',
        help: 'Jobs pause when these are used up. Must not be more than Google really gives for free.',
        type: 'number',
        min: 0,
        max: 100000,
        unit: 'requests',
      },
      {
        path: 'warnAt',
        label: 'Warn when this much is used',
        help: 'A warning appears in the job events.',
        type: 'percent',
        min: 0,
        max: 100,
        unit: '%',
      },
      {
        path: 'monthlyHardCapEur',
        label: 'Most that may be paid per month',
        help: '0 = paid requests are impossible. Above 0, a job can only pay after you approve a budget for it.',
        type: 'number',
        min: 0,
        max: 500,
        step: 1,
        unit: 'EUR',
      },
    ],
  },
  {
    title: 'Prices (check against Google’s price list)',
    advanced: true,
    fields: [
      {
        path: 'pricePer1000Usd',
        label: 'Price per 1,000 requests',
        type: 'number',
        min: 0,
        step: 0.01,
        unit: 'USD',
      },
      {
        path: 'usdToEurRate',
        label: 'Dollar to euro rate',
        help: '1 USD = this many EUR.',
        type: 'number',
        min: 0.01,
        step: 0.01,
      },
      {
        path: 'hardStop',
        label: 'Stop the free requests at',
        help: '100% = use all of them. Lower keeps a reserve.',
        type: 'percent',
        min: 0,
        max: 100,
        unit: '%',
      },
    ],
  },
];

const DATASETS: FieldGroup[] = [
  {
    fields: [
      {
        path: 'overture.minConfidence',
        label: 'Keep Overture places with a confidence of at least',
        help: 'Overture rates how sure it is that a place exists. Lower keeps more places, but more closed or wrong ones. Used by the next update.',
        type: 'percent',
        min: 0,
        max: 100,
        unit: '%',
      },
      {
        path: 'overture.onlyWithContact',
        label: 'Only keep places with an email or their own website',
        help: 'The others can never become a lead (the CSV needs an email). Keeps the database small. Used by the next update.',
        type: 'boolean',
      },
      {
        path: 'storageLimitMb',
        label: 'Never let the database grow past',
        help: 'An update or a new country that would pass this stops before saving anything. Neon’s free plan has 1,000 MB; keep some room for leads and crawls.',
        type: 'number',
        min: 100,
        step: 50,
        unit: 'MB',
      },
    ],
  },
];

const SEARCH: FieldGroup[] = [
  {
    fields: [
      {
        path: 'cooldownDays',
        label: 'Do not repeat a search for',
        help: 'The same place + keyword is skipped for this many days (saves requests). 0 = never skip.',
        type: 'number',
        min: 0,
        max: 365,
        unit: 'days',
      },
      {
        path: 'minCityPopulation',
        label: 'Own search for places with at least',
        help: 'Smaller places are covered by their district’s village search.',
        type: 'number',
        min: 0,
        step: 500,
        unit: 'people',
      },
      {
        path: 'includeRural',
        label: 'Include small villages when a job does not say',
        help: 'The New job page always asks; this is for jobs made from the command line.',
        type: 'boolean',
      },
    ],
  },
];

const CRAWLER: FieldGroup[] = [
  {
    fields: [
      {
        path: 'maxPagesPerDomain',
        label: 'Pages read per website',
        help: 'The home page plus contact, about and legal pages.',
        type: 'number',
        min: 1,
        max: 20,
        unit: 'pages',
      },
      {
        path: 'retryWithoutEmailDays',
        label: 'Try a website again (no email found) after',
        type: 'number',
        min: 1,
        max: 365,
        unit: 'days',
      },
      {
        path: 'delayMs',
        label: 'Pause between two pages of the same website',
        help: 'Polite crawling; at least 1 second.',
        type: 'seconds',
        min: 1,
        max: 60,
        step: 0.5,
        unit: 'seconds',
      },
      {
        path: 'concurrency',
        label: 'Websites at the same time',
        help: 'Takes effect when the worker restarts.',
        type: 'number',
        min: 1,
        max: 20,
      },
    ],
  },
  {
    title: 'Limits',
    advanced: true,
    fields: [
      {
        path: 'timeoutMs',
        label: 'Give up on a page after',
        type: 'seconds',
        min: 1,
        max: 60,
        unit: 'seconds',
      },
      {
        path: 'maxCrawlDelaySeconds',
        label: 'Longest robots.txt "Crawl-delay" respected',
        type: 'number',
        min: 1,
        max: 60,
        unit: 'seconds',
      },
      { path: 'maxRedirects', label: 'Redirects followed', type: 'number', min: 0, max: 5 },
    ],
  },
];

const LEAD_RULES: FieldGroup[] = [
  {
    title: 'Hold a lead back for review when',
    fields: [
      {
        path: 'quality.emailMx',
        label: 'The email’s domain has no mail server',
        help: 'Such an email would bounce.',
        type: 'boolean',
      },
      {
        path: 'quality.realCity',
        label: 'No real city is known',
        type: 'boolean',
      },
      {
        path: 'quality.category',
        label: 'No category is known',
        type: 'boolean',
      },
      {
        path: 'quality.validPhone',
        label: 'No valid phone number',
        type: 'boolean',
      },
    ],
  },
  {
    title: 'Chains',
    fields: [
      {
        path: 'chains.minPlacesPerDomain',
        label: 'A website used by this many places is a chain',
        type: 'number',
        min: 2,
        max: 100,
        unit: 'places',
      },
    ],
  },
  {
    title: 'Lead score (best leads first)',
    advanced: true,
    fields: [
      {
        path: 'score.ownDomainEmail',
        label: 'Email on own domain',
        type: 'number',
        unit: 'points',
      },
      { path: 'score.hasWebsite', label: 'Has a website', type: 'number', unit: 'points' },
      { path: 'score.validPhone', label: 'Valid phone', type: 'number', unit: 'points' },
      { path: 'score.goodRating', label: 'Good Google rating', type: 'number', unit: 'points' },
      {
        path: 'score.goodRatingMin',
        label: 'Good rating means at least',
        type: 'number',
        min: 0,
        max: 5,
        step: 0.1,
        unit: 'stars',
      },
      {
        path: 'score.goodRatingMinCount',
        label: '… with at least',
        type: 'number',
        min: 0,
        unit: 'ratings',
      },
      { path: 'score.open', label: 'Open (not closed on Google)', type: 'number', unit: 'points' },
      { path: 'score.chain', label: 'Chain', type: 'number', unit: 'points' },
      {
        path: 'score.sellsOnline',
        label: 'Already sells online',
        help: 'Its website has a shop, a cart or a link to its marketplace shop (Etsy, Amazon, Skroutz…).',
        type: 'number',
        unit: 'points',
      },
    ],
  },
  {
    title: 'Same business twice',
    advanced: true,
    fields: [
      {
        path: 'dedupe.sameKeyMaxMeters',
        label: 'Same website or phone, at most this far apart',
        type: 'number',
        min: 0,
        max: 5000,
        unit: 'metres',
      },
      {
        path: 'dedupe.sameNameMaxMeters',
        label: 'Almost the same name, at most this far apart',
        type: 'number',
        min: 0,
        max: 1000,
        unit: 'metres',
      },
      {
        path: 'dedupe.nameSimilarity',
        label: 'How similar names must be',
        type: 'percent',
        min: 50,
        max: 100,
        unit: '%',
      },
    ],
  },
];

const NAV = [
  { id: 'google', label: 'Google requests' },
  { id: 'search', label: 'Searching' },
  { id: 'crawler', label: 'Email search on websites' },
  { id: 'leads', label: 'Lead quality' },
  { id: 'chains', label: 'Chain list' },
  { id: 'countries', label: 'Countries' },
  { id: 'overture', label: 'Free data (Overture)' },
  { id: 'sources', label: 'Data sources' },
];

export default function SettingsPage() {
  const settings = useSettings();

  if (settings.isPending) return <LoadingState label="Loading settings…" />;
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />;
  }
  const s = settings.data.sections;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Changes apply within a minute, without restarting anything. Every change is recorded."
      />
      <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Settings sections">
          <ul className="sticky top-6 space-y-1 text-sm">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="block rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl space-y-6">
          <div id="google" className="scroll-mt-6">
            <SectionForm
              key={s.quota.updatedAt ?? 'default'}
              section="quota"
              view={s.quota}
              groups={QUOTA}
              title="Google requests"
              description="The safety limits for the Google Places API. The quota guard checks them before every request."
              confirmSave={(draft, saved) => {
                const cap = Number(draft.monthlyHardCapEur);
                const free = Number(draft.freeLimit);
                if (cap > Number(saved.monthlyHardCapEur)) {
                  return `Allow paid Google requests up to ${cap} EUR a month?\n\nA job still pays only after you approve a budget for it in the quota box.`;
                }
                if (free > Number(saved.freeLimit) && free > 1000) {
                  return `Raise the free limit to ${fmt(free)} requests a month?\n\nCheck in Google Cloud that this many are really free; above it Google charges.`;
                }
                return null;
              }}
              footer={(draft) => {
                const price =
                  (Number(draft.pricePer1000Usd) / 1000) * Number(draft.usdToEurRate) || 0;
                const cap = Number(draft.monthlyHardCapEur) || 0;
                return (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    One paid request costs about {price.toFixed(4)} EUR.{' '}
                    {cap > 0 && price > 0
                      ? `${cap} EUR a month allows at most ${fmt(Math.floor(cap / price))} paid requests.`
                      : 'Paid requests are off.'}
                  </p>
                );
              }}
            />
          </div>

          <div id="search" className="scroll-mt-6">
            <SectionForm
              key={s.search.updatedAt ?? 'default'}
              section="search"
              view={s.search}
              groups={SEARCH}
              title="Searching"
              description="How a job decides where to search. Used by the estimate on the New job page."
            />
          </div>

          <div id="crawler" className="scroll-mt-6">
            <SectionForm
              key={s.crawler.updatedAt ?? 'default'}
              section="crawler"
              view={s.crawler}
              groups={CRAWLER}
              title="Email search on websites"
              description="How the worker reads businesses' own websites. It always respects robots.txt and identifies itself."
            />
          </div>

          <div id="leads" className="scroll-mt-6">
            <SectionForm
              key={s.leadRules.updatedAt ?? 'default'}
              section="leadRules"
              view={s.leadRules}
              groups={LEAD_RULES}
              title="Lead quality"
              description="Which leads are held back for review, which count as chains, and how leads are ranked. Saving updates all leads at once."
            />
          </div>

          <div id="chains" className="scroll-mt-6">
            <ChainList chains={settings.data.chains} />
          </div>

          <div id="countries" className="scroll-mt-6">
            <CountriesPanel />
          </div>

          <div id="overture" className="scroll-mt-6 space-y-6">
            <OverturePanel />
            <SectionForm
              key={s.datasets.updatedAt ?? 'default'}
              section="datasets"
              view={s.datasets}
              groups={DATASETS}
              title="Overture import"
              description="Which Overture places are kept when the data is updated."
            />
          </div>

          <section id="sources" className="scroll-mt-6 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Data sources</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Where the data comes from, and the credit each source asks for.
              </p>
            </div>
            <dl className="divide-y divide-slate-100 px-5 text-sm">
              <div className="py-3">
                <dt className="font-medium text-slate-900">Google Places API</dt>
                <dd className="mt-0.5 text-slate-600">
                  Business names, addresses, phones, websites and ratings. Used under Google’s
                  terms; Google data is refreshed, not kept forever.
                </dd>
              </div>
              <div className="py-3">
                <dt className="font-medium text-slate-900">GeoNames</dt>
                <dd className="mt-0.5 text-slate-600">
                  Countries, districts and cities. Licensed under{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    CC BY 4.0
                  </a>
                  , ©{' '}
                  <a
                    href="https://www.geonames.org/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    GeoNames
                  </a>
                  .
                </dd>
              </div>
              <div className="py-3">
                <dt className="font-medium text-slate-900">Businesses’ own websites</dt>
                <dd className="mt-0.5 text-slate-600">
                  Public business emails, read politely: robots.txt is respected, pages are read
                  slowly, and the crawler names itself (ainoviroBot).
                </dd>
              </div>
              <div className="py-3">
                <dt className="font-medium text-slate-900">Overture Maps Foundation</dt>
                <dd className="mt-0.5 text-slate-600">
                  Places (businesses, categories, websites, phones, emails). © Overture Maps
                  Foundation, licensed under{' '}
                  <a
                    href="https://cdla.dev/permissive-2-0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    CDLA Permissive 2.0
                  </a>
                  . Some of the data comes from{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    © OpenStreetMap contributors
                  </a>{' '}
                  (ODbL). More:{' '}
                  <a
                    href="https://docs.overturemaps.org/attribution/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    docs.overturemaps.org/attribution
                  </a>
                  .
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-slate-400">Foursquare Open Places</dt>
                <dd className="mt-0.5 text-slate-400">
                  Not used: its download needs an account with extra terms (decided in Phase 4).
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
