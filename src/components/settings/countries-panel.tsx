'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button, ErrorState, Spinner } from '@/components/ui';
import {
  languageName,
  useAddCountry,
  useCountries,
  useCountry,
  useSetCountryExport,
  type CountryView,
} from '@/lib/countries';
import { refreshBusy, useOvertureStatus } from '@/lib/datasets';
import { fmt } from '@/lib/jobs';

/**
 * Settings, Countries (step 6.2): which countries are in use, whether their leads may go
 * into a CSV (a safety switch, off for every new country), and adding a country. Adding
 * runs in the worker: cities from GeoNames, then businesses from Overture.
 */
export function CountriesPanel() {
  const countries = useCountries();
  const { code } = useCountry();
  // The worker runs one dataset job at a time; its state is shown here too.
  const refresh = useOvertureStatus(code).data?.refresh;
  const setExport = useSetCountryExport();
  const add = useAddCountry();
  const [toAdd, setToAdd] = useState('');
  const [confirmAdd, setConfirmAdd] = useState<CountryView | null>(null);
  const [confirmExport, setConfirmExport] = useState<CountryView | null>(null);

  if (countries.isPending) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <Spinner /> Loading…
      </section>
    );
  }
  if (countries.isError) {
    return (
      <ErrorState message={countries.error.message} onRetry={() => void countries.refetch()} />
    );
  }
  const inUse = countries.data.filter((c) => c.imported);
  const available = countries.data.filter((c) => !c.imported);
  const busy = refreshBusy(refresh);
  const chosen = available.find((c) => c.code === toAdd);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Countries</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Leads of a country go into a CSV only when its switch is on. Every new country starts
          switched off.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-2 font-medium">Country</th>
              <th className="px-3 py-2 text-right font-medium">Businesses</th>
              <th className="px-3 py-2 text-right font-medium">Ready leads</th>
              <th className="px-3 py-2 font-medium">Overture data</th>
              <th className="px-3 py-2 font-medium">Keywords</th>
              <th className="px-5 py-2 font-medium">CSV allowed</th>
            </tr>
          </thead>
          <tbody>
            {inUse.map((c) => (
              <tr key={c.code} className="border-b border-slate-50">
                <td className="px-5 py-2.5 font-medium text-slate-900">{c.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {fmt(c.places)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {fmt(c.readyLeads)}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {c.overtureRelease ?? 'Not imported'}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {c.languages.map(languageName).join(', ')}
                </td>
                <td className="px-5 py-2.5">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.exportEnabled}
                      disabled={setExport.isPending}
                      onChange={(e) =>
                        e.target.checked
                          ? setConfirmExport(c)
                          : setExport.mutate({ code: c.code, exportEnabled: false })
                      }
                      className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                    />
                    <span className={c.exportEnabled ? 'text-emerald-700' : 'text-slate-500'}>
                      {c.exportEnabled ? 'On' : 'Off'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 border-t border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Add a country</h3>
        {busy && refresh ? (
          <p className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
            <Spinner className="h-3.5 w-3.5" />
            The worker is busy with {refresh.countryCode ?? 'an import'}
            {refresh.step ? `: ${refresh.step}` : ''}. Adding another country can start after it.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="add-country">
              Country to add
            </label>
            <select
              id="add-country"
              value={toAdd}
              onChange={(e) => setToAdd(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Choose a country…</option>
              {available.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!chosen}
              loading={add.isPending}
              onClick={() => chosen && setConfirmAdd(chosen)}
            >
              Add country
            </Button>
          </div>
        )}
        <p className="text-xs text-slate-500">
          The worker downloads the country&apos;s cities (GeoNames) and businesses with an email or
          website (Overture). A small country takes minutes, a big one longer. Check the database
          size afterwards: the free Neon plan has little room.
        </p>
      </div>

      <ConfirmDialog
        open={confirmAdd !== null}
        title={`Add ${confirmAdd?.name ?? ''}?`}
        message={
          <>
            The worker imports {confirmAdd?.name}&apos;s cities and businesses. Nothing is charged.
            CSV export for it stays off until you switch it on here.
          </>
        }
        confirmLabel="Add country"
        loading={add.isPending}
        onCancel={() => setConfirmAdd(null)}
        onConfirm={() =>
          confirmAdd &&
          add.mutate(confirmAdd.code, {
            onSettled: () => {
              setConfirmAdd(null);
              setToAdd('');
            },
          })
        }
      />
      <ConfirmDialog
        open={confirmExport !== null}
        title={`Allow CSV export for ${confirmExport?.name ?? ''}?`}
        message="Switch this on only for countries where emailing these businesses has been approved."
        confirmLabel="Allow CSV export"
        loading={setExport.isPending}
        onCancel={() => setConfirmExport(null)}
        onConfirm={() =>
          confirmExport &&
          setExport.mutate(
            { code: confirmExport.code, exportEnabled: true },
            { onSettled: () => setConfirmExport(null) },
          )
        }
      />
    </section>
  );
}
