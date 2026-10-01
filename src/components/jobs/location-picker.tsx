'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useLocationChildren, type LocationNode } from '@/lib/jobs';

/**
 * What is selected, per district: the whole district, or only some of its cities.
 * A district that is not in the map is not selected at all.
 */
export type LocationSelection = Map<number, 'all' | number[]>;

/** The ids sent to the backend: whole districts and single cities. */
export function selectionToIds(selection: LocationSelection): number[] {
  const ids: number[] = [];
  for (const [districtId, value] of selection) {
    if (value === 'all') ids.push(districtId);
    else ids.push(...value);
  }
  return ids;
}

/** A checkbox that can also show "some selected" (spec §5: tri-state). */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 accent-brand-600"
    />
  );
}

const population = (n: number | null) =>
  n === null ? '' : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

function CityList({
  district,
  value,
  onChange,
}: {
  district: LocationNode;
  value: 'all' | number[] | undefined;
  onChange: (next: 'all' | number[] | undefined) => void;
}) {
  const cities = useLocationChildren(district.id);
  const [filter, setFilter] = useState('');

  if (cities.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 pl-9 text-sm text-slate-500">
        <Spinner /> Loading cities…
      </div>
    );
  }
  if (cities.isError) {
    return <p className="py-2 pl-9 text-sm text-red-700">Could not load the cities.</p>;
  }

  // Biggest places first: they are where most businesses are.
  const all = [...cities.data].sort(
    (a, b) => (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name),
  );
  const allIds = all.map((c) => c.id);
  const q = filter.trim().toLowerCase();
  const shown = q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.nameLocal?.toLowerCase().includes(q))
    : all;

  const isChecked = (id: number) => value === 'all' || (value?.includes(id) ?? false);
  const toggle = (id: number) => {
    const current = value === 'all' ? allIds : (value ?? []);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    if (next.length === 0) onChange(undefined);
    else if (next.length === allIds.length) onChange('all');
    else onChange(next);
  };

  return (
    <div className="pb-3 pl-9 pr-3">
      {all.length > 8 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Find a place in ${district.name}`}
          aria-label={`Find a place in ${district.name}`}
          className="mb-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
      )}
      <ul className="max-h-64 space-y-0.5 overflow-y-auto">
        {shown.map((city) => (
          <li key={city.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={isChecked(city.id)}
                onChange={() => toggle(city.id)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="flex-1 truncate">{city.name}</span>
              <span className="text-xs tabular-nums text-slate-400">
                {population(city.population)}
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="py-1 text-sm text-slate-500">No match.</li>}
      </ul>
    </div>
  );
}

/** Districts of the country, each with its cities on demand. */
export function LocationPicker({
  countryId,
  selection,
  onChange,
}: {
  countryId: number;
  selection: LocationSelection;
  onChange: (next: LocationSelection) => void;
}) {
  const districts = useLocationChildren(countryId);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const setDistrict = (id: number, value: 'all' | number[] | undefined) => {
    const next = new Map(selection);
    if (value === undefined) next.delete(id);
    else next.set(id, value);
    onChange(next);
  };

  if (districts.isPending) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
        <Spinner /> Loading districts…
      </div>
    );
  }
  if (districts.isError) {
    return <p className="py-4 text-sm text-red-700">Could not load the districts.</p>;
  }

  // A district with no places (a GeoNames quirk, e.g. a single village filed as a district)
  // cannot be searched, so it is not shown.
  const list = districts.data.filter((d) => d.childCount > 0);
  const allSelected = list.length > 0 && list.every((d) => selection.get(d.id) === 'all');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Tick a district for all its places, or open it to pick single cities.
        </span>
        <button
          type="button"
          className="font-medium text-brand-700 hover:underline"
          onClick={() =>
            onChange(allSelected ? new Map() : new Map(list.map((d) => [d.id, 'all' as const])))
          }
        >
          {allSelected ? 'Clear' : 'Select all'}
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {list.map((district) => {
          const value = selection.get(district.id);
          const isOpen = open.has(district.id);
          const some = Array.isArray(value) ? value.length : 0;
          return (
            <li key={district.id}>
              <div className="flex items-center gap-3 px-3 py-2">
                <TriCheckbox
                  label={district.name}
                  checked={value === 'all'}
                  indeterminate={Array.isArray(value)}
                  onChange={() => setDistrict(district.id, value === 'all' ? undefined : 'all')}
                />
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpen((s) => {
                      const next = new Set(s);
                      if (next.has(district.id)) next.delete(district.id);
                      else next.add(district.id);
                      return next;
                    })
                  }
                  className="flex flex-1 items-center justify-between gap-2 text-left text-sm"
                >
                  <span className="font-medium text-slate-900">
                    {district.name}
                    {district.nameLocal && (
                      <span className="ml-1.5 font-normal text-slate-400">
                        {district.nameLocal}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {value === 'all'
                      ? 'all places'
                      : some > 0
                        ? `${some} selected`
                        : `${district.childCount} places`}
                    <span
                      aria-hidden
                      className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    >
                      ›
                    </span>
                  </span>
                </button>
              </div>
              {isOpen && (
                <CityList
                  district={district}
                  value={value}
                  onChange={(v) => setDistrict(district.id, v)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
