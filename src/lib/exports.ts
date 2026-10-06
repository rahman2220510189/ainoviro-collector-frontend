import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, downloadFile } from './api';

/** Filters the export accepts (same names as the backend query string). */
export interface ExportFilters {
  country?: string;
  city?: string;
  category?: string;
  subcategory?: string;
  minScore?: number;
  sellsOnline?: 'yes' | 'no';
}

export type ExportProfile = 'mailer_v1' | 'legacy_9col' | 'full';

export const EXPORT_PROFILES: { value: ExportProfile; label: string }[] = [
  { value: 'mailer_v1', label: 'Mailer (7 columns)' },
  { value: 'legacy_9col', label: 'Legacy (9 columns)' },
  { value: 'full', label: 'Full (all fields)' },
];

export interface ExportPreview {
  newRows: number;
  needsReview: number;
}

const clean = (filters: ExportFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));

export function useExportPreview(filters: ExportFilters) {
  return useQuery({
    queryKey: ['exports', 'preview', clean(filters)],
    queryFn: async () =>
      (await api.get<{ preview: ExportPreview }>('/exports/preview', { params: clean(filters) }))
        .data.preview,
  });
}

/**
 * The one-click export: downloads the CSV straight away (no dialog) and refreshes the
 * counts, because the exported rows are now marked and will not come again.
 */
export function useDownloadCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { filters: ExportFilters; profile: ExportProfile }) =>
      downloadFile('/exports/csv', {
        ...clean(input.filters),
        profile: input.profile,
        scope: 'new',
      }),
    onSuccess: (headers) => {
      const rows = Number(headers['x-export-row-count'] ?? 0);
      if (rows === 0) toast.info('No new rows: everything was already exported.');
      else toast.success(`Downloaded ${rows} new lead${rows === 1 ? '' : 's'}.`);
      void queryClient.invalidateQueries({ queryKey: ['exports'] });
    },
  });
}

export interface ExportBatch {
  id: number;
  profile: string;
  scope: string;
  filename: string;
  rowCount: number;
  status: 'ACTIVE' | 'UNDONE';
  createdAt: string;
  undoneAt: string | null;
  createdBy: string | null;
}

export function useExportBatches() {
  return useQuery({
    queryKey: ['exports', 'batches'],
    queryFn: async () =>
      (await api.get<{ batches: ExportBatch[] }>('/exports/batches', { params: { limit: 100 } }))
        .data.batches,
  });
}

/** Downloads an earlier batch again: same rows, same order, nothing new is marked. */
export function useRedownloadBatch() {
  return useMutation({
    mutationFn: async (id: number) => downloadFile(`/exports/batches/${id}/download`),
  });
}

/** Undo: the rows go back to "new" (unless someone already acted on them). */
export function useUndoBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (
        await api.post<{ undo: { batchId: number; returned: number; kept: number } }>(
          `/exports/batches/${id}/undo`,
        )
      ).data.undo,
    onSuccess: ({ batchId, returned, kept }) => {
      toast.success(
        `Batch #${batchId} undone: ${returned} row${returned === 1 ? '' : 's'} back to new` +
          (kept > 0 ? `, ${kept} kept (already contacted or changed).` : '.'),
      );
      void queryClient.invalidateQueries({ queryKey: ['exports'] });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
