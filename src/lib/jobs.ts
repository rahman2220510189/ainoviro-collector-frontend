import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';

// ---- types (same shapes as the backend) --------------------------------------------------

export type JobStatus =
  'QUEUED' | 'RUNNING' | 'PAUSED_USER' | 'PAUSED_QUOTA' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type RunMode = 'LIVE' | 'MOCK';
export type JobAction = 'start' | 'pause' | 'resume' | 'cancel' | 'continue-free';
export type JobSource = 'GOOGLE_PLACES' | 'OVERTURE';

export interface JobRequest {
  name?: string;
  countryCode: string;
  /** Picked in the location tree; empty = the whole country. */
  locationIds: number[];
  categorySlugs: string[];
  /** Old name of localLanguages; always false from this page. */
  greek: boolean;
  /** Also search with the country's own keyword languages. */
  localLanguages?: boolean;
  includeRural: boolean;
  forceRerun: boolean;
  /** Left out = Google, plus the free Overture data when it is imported. */
  sources?: JobSource[];
}

export interface CostEstimate {
  minimum: number;
  estimated: number;
  maximumWithoutSplits: number;
  averagePages: number;
  freeRemaining: number;
  verdict: 'FITS' | 'MAY_NOT_FIT' | 'DOES_NOT_FIT';
}

export interface JobPreview {
  scopeLabel: string;
  mode: RunMode;
  areas: number;
  absorbedTowns: number;
  keywordCount: number;
  tasksTotal: number;
  tasksToRun: number;
  skippedByCooldown: number;
  includeRural: boolean;
  minCityPopulation: number;
  cooldownDays: number;
  forceRerun: boolean;
  cost: CostEstimate;
  sources: JobSource[];
  overtureAvailable: boolean;
  overtureTasks: number;
  overtureKnown: { businesses: number; withEmail: number };
}

export interface JobSummary {
  id: number;
  name: string | null;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  tasks: Record<string, number>;
  resultsReturned: number;
}

type StageCounts = { total: number; done: number; toDo: number; failed: number; skipped: number };

export interface JobStages {
  /** Google searches only. */
  search: StageCounts;
  /** Free data (Overture); null when the job does not use it. */
  free: (StageCounts & { businesses: number; withEmail: number }) | null;
  places: {
    newPlaces: number;
    withWebsite: number;
    websitesChecked: number;
    waitingForCrawl: number;
    withEmail: number;
  };
}

export interface JobEvent {
  createdAt: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  type: string;
  message: string;
}

export interface JobDetail extends JobSummary {
  sources: JobSource[];
  /** Google searches put aside by "Continue with free sources"; Resume runs them. */
  googleDeferred: number;
  estimate: { minimum?: number; estimated?: number; verdict?: string } | null;
  options: {
    mode: RunMode | null;
    scopeLabel: string | null;
    categorySlugs: string[];
    languages: string[];
    includeRural: boolean | null;
    forceRerun: boolean;
  };
  stages: JobStages;
  extraBudgetEur: number | null;
  paidRequestsUsed: number;
  events: JobEvent[];
}

export interface QuotaStatus {
  mode: RunMode;
  liveRequestsEnabled: boolean;
  period: string;
  freeLimit: number;
  freeCap: number;
  used: number;
  freeRemaining: number;
  warnAt: number;
  paidCount: number;
  monthlyHardCapEur: number;
  pricePerRequestEur: number;
  worker: {
    running: boolean;
    lastSeenAt: string | null;
    mode: RunMode | null;
    searching: boolean;
    crawling: boolean;
  };
}

export interface LocationNode {
  id: number;
  parentId: number | null;
  type: 'COUNTRY' | 'REGION' | 'CITY';
  name: string;
  nameLocal: string | null;
  countryCode: string;
  population: number | null;
  childCount: number;
}

export interface CategoryNode {
  id: number;
  slug: string;
  displayName: string;
  subcategories: { id: number; slug: string; displayName: string }[];
}

// ---- labels ------------------------------------------------------------------------------

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  QUEUED: 'Not started',
  RUNNING: 'Running',
  PAUSED_USER: 'Paused',
  PAUSED_QUOTA: 'Paused: Google limit',
  COMPLETED: 'Search finished',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

/** States in which the job can still change by itself (pages refresh while in them). */
export const ACTIVE_STATUSES: JobStatus[] = ['RUNNING'];

// ---- queries -----------------------------------------------------------------------------

/** Children of a location (countries when parentId is null). Cached: the tree rarely changes. */
export function useLocationChildren(parentId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['locations', parentId],
    queryFn: async () =>
      (
        await api.get<{ locations: LocationNode[] }>('/locations/tree', {
          params: parentId === null ? {} : { parent_id: parentId },
        })
      ).data.locations,
    staleTime: 60 * 60_000,
    enabled,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      (await api.get<{ categories: CategoryNode[] }>('/categories')).data.categories,
    staleTime: 60 * 60_000,
  });
}

/** Live cost estimate; null request = nothing to estimate yet. */
export function useJobPreview(request: JobRequest | null) {
  return useQuery({
    queryKey: ['jobs', 'preview', request],
    queryFn: async () =>
      // Errors are shown inside the estimate panel, not as a toast on every change.
      (await api.post<{ preview: JobPreview }>('/jobs/preview', request, { silent: true })).data
        .preview,
    enabled: request !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** fast = a job is running, so the counter moves: refresh every 3 s instead of 15 s. */
export function useQuotaStatus(fast = false) {
  return useQuery({
    queryKey: ['jobs', 'quota'],
    queryFn: async () => (await api.get<{ quota: QuotaStatus }>('/jobs/quota')).data.quota,
    refetchInterval: fast ? 3_000 : 15_000,
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: async () =>
      (await api.get<{ jobs: JobSummary[] }>('/jobs', { params: { limit: 100 } })).data.jobs,
    // Refresh while something runs, so progress moves without reloading.
    refetchInterval: (query) =>
      query.state.data?.some((j) => ACTIVE_STATUSES.includes(j.status)) ? 5_000 : 30_000,
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: ['jobs', 'detail', id],
    queryFn: async () => (await api.get<{ job: JobDetail }>(`/jobs/${id}`)).data.job,
    // Running: every 3 s. Finished search: websites may still be crawled, so every 15 s.
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return false;
      if (ACTIVE_STATUSES.includes(job.status)) return 3_000;
      return job.stages.places.waitingForCrawl > 0 ? 15_000 : false;
    },
    enabled: Number.isInteger(id) && id > 0,
  });
}

// ---- mutations ---------------------------------------------------------------------------

/** Creates the job and starts it right away. Returns the new job id. */
export function useCreateAndStartJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: JobRequest) => {
      const { jobId } = (await api.post<{ jobId: number }>('/jobs', request)).data;
      await api.post(`/jobs/${jobId}/start`);
      return jobId;
    },
    onSuccess: (jobId) => {
      toast.success(`Job #${jobId} started.`);
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

const ACTION_DONE: Record<JobAction, string> = {
  start: 'started',
  pause: 'paused',
  resume: 'resumed',
  cancel: 'cancelled',
  'continue-free': 'continues with free sources',
};

export function useJobAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: JobAction }) =>
      (await api.post<{ job: JobSummary }>(`/jobs/${id}/${action}`)).data.job,
    onSuccess: (job, { action }) => {
      toast.success(`Job #${job.id} ${ACTION_DONE[action]}.`);
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useApproveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, extraBudgetEur }: { id: number; extraBudgetEur: number }) =>
      (await api.post<{ job: JobSummary }>(`/jobs/${id}/budget`, { extraBudgetEur })).data.job,
    onSuccess: (job) => {
      toast.success(`Budget approved; job #${job.id} continues.`);
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ---- small helpers -----------------------------------------------------------------------

export const fmt = (n: number) => n.toLocaleString('en');

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Searches finished out of all that will run (skipped ones do not count). */
export function searchProgress(tasks: Record<string, number>) {
  const n = (s: string) => tasks[s] ?? 0;
  const total = n('PENDING') + n('RUNNING') + n('DEFERRED') + n('DONE') + n('FAILED');
  return { done: n('DONE'), total };
}
