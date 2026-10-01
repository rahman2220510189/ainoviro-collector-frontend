import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const IMPORTABLE_REASONS = [
  'EXISTING_CONTACT',
  'EXISTING_VENDOR',
  'UNSUBSCRIBED',
  'BOUNCED',
  'MANUAL',
] as const;
export type ImportableReason = (typeof IMPORTABLE_REASONS)[number];

export const REASON_LABEL: Record<string, string> = {
  EXISTING_CONTACT: 'Existing contact',
  EXISTING_VENDOR: 'Existing vendor',
  UNSUBSCRIBED: 'Unsubscribed',
  BOUNCED: 'Bounced',
  MANUAL: 'Added by hand',
  ERASED: 'Erased (GDPR)',
};

export interface SuppressionEntry {
  id: number;
  email: string | null;
  domain: string | null;
  reason: string;
  sourceFile: string | null;
  addedAt: string;
}

export interface SuppressionPage {
  items: SuppressionEntry[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
}

export interface ImportResult {
  inserted: number;
  upgraded: number;
  alreadySuppressed: number;
}

export interface CsvImportResult extends ImportResult {
  rows: number;
  invalid: number;
  duplicatesInFile: number;
  empty: number;
  invalidExamples: string[];
}

export interface MailerImportResult {
  rows: number;
  byStatus: Record<string, number>;
  leadsUpdated: number;
  suppressed: number;
  unknownEmails: number;
  invalidRows: number;
  unknownStatuses: string[];
}

export function useSuppressionList(query: { q?: string; reason?: string; page: number }) {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
  return useQuery({
    queryKey: ['suppression', params],
    queryFn: async () => (await api.get<SuppressionPage>('/suppression', { params })).data,
    placeholderData: keepPreviousData,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['suppression'] });
    void queryClient.invalidateQueries({ queryKey: ['exports'] });
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
  };
}

export function useAddSuppression() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { email: string; reason: ImportableReason }) =>
      (await api.post<{ result: ImportResult }>('/suppression', input)).data.result,
    onSuccess: refresh,
  });
}

/** Big files can take a while on a remote database. */
const IMPORT_TIMEOUT = 5 * 60_000;

export function useImportSuppressionCsv() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: {
      csv: string;
      filename: string;
      column: string;
      reason: ImportableReason;
    }) =>
      (
        await api.post<{ result: CsvImportResult }>('/suppression/import', input, {
          timeout: IMPORT_TIMEOUT,
        })
      ).data.result,
    onSuccess: refresh,
  });
}

export function useImportMailerResults() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { csv: string; filename: string }) =>
      (
        await api.post<{ result: MailerImportResult }>('/suppression/mailer-results', input, {
          timeout: IMPORT_TIMEOUT,
        })
      ).data.result,
    onSuccess: refresh,
  });
}
