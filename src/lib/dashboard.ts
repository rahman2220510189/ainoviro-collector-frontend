import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Same shape as the backend's DashboardSummary. */
export interface DashboardSummary {
  country: string;
  generatedAt: string;
  leads: {
    totalPlaces: number;
    withEmail: number;
    ready: number;
    needsReview: number;
    chains: number;
    closed: number;
    byStatus: Record<string, number>;
  };
  emails: {
    total: number;
    generic: number;
    personal: number;
    ownDomain: number;
    freeMail: number;
    noMailServer: number;
    bounced: number;
    unsubscribed: number;
    exported: number;
    newThisMonth: number;
  };
  websites: {
    withWebsite: number;
    crawled: number;
    emailFound: number;
    noEmailFound: number;
    failed: number;
    robotsBlocked: number;
    waiting: number;
  };
  google: { months: { period: string; requests: number; paid: number }[] };
  exports: { batches: number; rows: number; rowsThisMonth: number; lastExportAt: string | null };
  suppression: { total: number; byReason: Record<string, number> };
  jobs: { byStatus: Record<string, number> };
  topCities: { name: string; withEmail: number; ready: number }[];
  topCategories: { name: string; withEmail: number; ready: number }[];
  activity: { date: string; newPlaces: number; newEmails: number; exported: number }[];
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () =>
      (await api.get<{ dashboard: DashboardSummary }>('/dashboard', { params: { country: 'CY' } }))
        .data.dashboard,
    // The worker keeps finding emails in the background: refresh every minute.
    refetchInterval: 60_000,
  });
}

/** "2026-10" -> "Oct". */
export const monthShort = (period: string) =>
  new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short' });

/** "2026-10-02" -> "2 Oct". */
export const dayShort = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
