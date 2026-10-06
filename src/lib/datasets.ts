import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';

// ---- types (same shapes as the backend) --------------------------------------------------

export interface OvertureImport {
  id: number;
  release: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  placesKept: number | null;
  error: string | null;
}

export interface RefreshState {
  state: 'IDLE' | 'REQUESTED' | 'RUNNING' | 'DONE' | 'FAILED';
  countryCode: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  step: string | null;
  updatedAt: string | null;
  error: string | null;
  result: {
    release: string;
    placesInImport: number;
    newBusinesses: number;
    newEmails: number;
    duplicatesMerged: number;
    readyBefore: number;
    readyAfter: number;
  } | null;
}

export interface OvertureStatus {
  countryCode: string;
  current: OvertureImport | null;
  history: OvertureImport[];
  businesses: number;
  businessesWithEmail: number;
  websitesWaiting: number;
  minConfidence: number;
  pinnedRelease: string | null;
  refresh: RefreshState;
  /** Whole database in bytes. */
  databaseBytes: number;
}

export interface MappingReport {
  total: number;
  mapped: number;
  mappedWithEmail: number;
  excluded: number;
  unmapped: number;
  byCategory: { category: string; places: number; withEmail: number }[];
  byExclusion: { reason: string; places: number; withEmail: number }[];
  topUnmapped: { category: string; places: number }[];
}

/** Same 30-minute rule as the backend: a run that stopped moving was abandoned. */
export function refreshBusy(r: RefreshState | undefined): boolean {
  if (!r || (r.state !== 'REQUESTED' && r.state !== 'RUNNING')) return false;
  const last = Date.parse(r.updatedAt ?? r.requestedAt ?? '');
  return Number.isFinite(last) && Date.now() - last < 30 * 60_000;
}

// ---- queries -----------------------------------------------------------------------------

export function useOvertureStatus(country: string) {
  return useQuery({
    queryKey: ['datasets', 'overture', country],
    queryFn: async () =>
      (await api.get<{ overture: OvertureStatus }>('/datasets/overture', { params: { country } }))
        .data.overture,
    // While an update runs, follow its progress.
    refetchInterval: (query) => (refreshBusy(query.state.data?.refresh) ? 5_000 : false),
  });
}

export function useOvertureLatest(country: string) {
  return useQuery({
    queryKey: ['datasets', 'overture', country, 'latest'],
    queryFn: async () =>
      (
        await api.get<{ latest: { release: string | null; newer: boolean; error: string | null } }>(
          '/datasets/overture/latest',
          { silent: true, params: { country } },
        )
      ).data.latest,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

export function useOvertureReport(country: string, enabled: boolean) {
  return useQuery({
    queryKey: ['datasets', 'overture', country, 'report'],
    queryFn: async () =>
      (
        await api.get<{ report: MappingReport }>('/datasets/overture/report', {
          params: { country },
        })
      ).data.report,
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useRequestOvertureRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (country: string) =>
      (
        await api.post<{ refresh: RefreshState }>('/datasets/overture/refresh', null, {
          params: { country },
        })
      ).data.refresh,
    onSuccess: () => {
      toast.success('Update requested. The worker starts it within a minute.');
      void queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
}

/** 12.2 MB, 1.50 GB */
export const formatBytes = (n: number): string =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(2)} GB`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)} MB`
      : `${Math.round(n / 1e3)} kB`;
