'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, createElement, useCallback, useContext, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api } from './api';
import type { RefreshState } from './datasets';

export interface CountryView {
  code: string;
  name: string;
  /** In the location tree: jobs, leads and imports can use it. */
  imported: boolean;
  exportEnabled: boolean;
  languages: string[];
  places: number;
  readyLeads: number;
  overtureRelease: string | null;
}

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: async () => (await api.get<{ countries: CountryView[] }>('/countries')).data.countries,
    staleTime: 60_000,
  });
}

export function useSetCountryExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, exportEnabled }: { code: string; exportEnabled: boolean }) =>
      (await api.put<{ countries: CountryView[] }>(`/countries/${code}`, { exportEnabled })).data
        .countries,
    onSuccess: (countries, { code, exportEnabled }) => {
      queryClient.setQueryData(['countries'], countries);
      const name = countries.find((c) => c.code === code)?.name ?? code;
      toast.success(`CSV export for ${name} is now ${exportEnabled ? 'on' : 'off'}.`);
      void queryClient.invalidateQueries({ queryKey: ['exports'] });
    },
  });
}

export function useAddCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<{ refresh: RefreshState }>(`/countries/${code}/add`)).data.refresh,
    onSuccess: () => {
      toast.success('Requested. The worker adds the country within a minute.');
      void queryClient.invalidateQueries({ queryKey: ['datasets'] });
      void queryClient.invalidateQueries({ queryKey: ['countries'] });
    },
  });
}

/** "el" -> "Greek" */
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
export function languageName(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// ---- the country the pages work on (chosen in the sidebar, remembered per browser) ------

const STORAGE_KEY = 'ainoviro.country';
const DEFAULT_COUNTRY = 'CY';

interface CountryContextValue {
  /** Code of the selected country, e.g. "CY". */
  code: string;
  setCode: (code: string) => void;
  /** The selected country's details once loaded. */
  country: CountryView | undefined;
  /** Countries in use (imported), for the picker. */
  inUse: CountryView[];
}

const CountryContext = createContext<CountryContextValue | null>(null);

/** The choice lives in localStorage; this keeps every component in step with it. */
const listeners = new Set<() => void>();
let memoryChoice: string | null = null;

function readStored(): string {
  if (memoryChoice) return memoryChoice;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function storeChoice(next: string): void {
  memoryChoice = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private window: the choice lasts until the page is closed.
  }
  for (const l of listeners) l();
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const countries = useCountries();
  // The server render (no window) uses the default; the browser then reads the choice.
  const code = useSyncExternalStore(subscribe, readStored, () => DEFAULT_COUNTRY);
  const setCode = useCallback((next: string) => storeChoice(next), []);
  const inUse = (countries.data ?? []).filter((c) => c.imported);
  // A remembered country that is no longer in use falls back to the first one in use.
  const effective =
    countries.data && inUse.length > 0 && !inUse.some((c) => c.code === code)
      ? (inUse[0]?.code ?? DEFAULT_COUNTRY)
      : code;
  const value: CountryContextValue = {
    code: effective,
    setCode,
    country: countries.data?.find((c) => c.code === effective),
    inUse,
  };
  return createElement(CountryContext.Provider, { value }, children);
}

export function useCountry(): CountryContextValue {
  const value = useContext(CountryContext);
  if (!value) throw new Error('useCountry needs <CountryProvider>');
  return value;
}
