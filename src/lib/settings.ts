import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';

export type SettingsSection = 'quota' | 'search' | 'crawler' | 'leadRules' | 'datasets';

export interface SectionView {
  values: Record<string, unknown>;
  defaults: Record<string, unknown>;
  updatedAt: string | null;
}

export interface ChainEntry {
  id: number;
  name: string;
  domain: string | null;
  addedAt: string;
}

export interface AllSettings {
  sections: Record<SettingsSection, SectionView>;
  chains: ChainEntry[];
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: AllSettings }>('/settings')).data.settings,
  });
}

/** Everything a settings change can move: quota meter, estimates, lead counts. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['settings', 'jobs', 'dashboard', 'leads', 'exports']) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useSaveSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      section,
      values,
    }: {
      section: SettingsSection;
      values: Record<string, unknown>;
    }) =>
      // Validation problems are shown next to the form, not as a toast.
      (
        await api.put<{ section: SectionView }>(
          `/settings/${section}`,
          { values },
          { silent: true },
        )
      ).data.section,
    onSuccess: () => {
      toast.success('Settings saved.');
      invalidateAll(queryClient);
    },
  });
}

export function useAddChain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; domain?: string }) =>
      (await api.post<{ chains: ChainEntry[] }>('/settings/chains', input)).data.chains,
    onSuccess: (_, input) => {
      toast.success(`${input.name} is now on the chain list; leads were updated.`);
      invalidateAll(queryClient);
    },
  });
}

export function useRemoveChain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ chains: ChainEntry[] }>(`/settings/chains/${id}`)).data.chains,
    onSuccess: () => {
      toast.success('Removed from the chain list; leads were updated.');
      invalidateAll(queryClient);
    },
  });
}

/** Reads "quality.emailMx" from a nested object. */
export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

/** Returns a copy of obj with "quality.emailMx" set to value. */
export function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (!head) return obj;
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = (obj[head] ?? {}) as Record<string, unknown>;
  return { ...obj, [head]: setPath(child, rest.join('.'), value) };
}
