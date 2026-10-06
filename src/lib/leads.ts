import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';

export const LEAD_STATUSES = [
  'NEW',
  'EXPORTED',
  'CONTACTED',
  'REPLIED',
  'ONBOARDED',
  'PRODUCT_ADDED',
  'REJECTED',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  EXPORTED: 'Exported',
  CONTACTED: 'Contacted',
  REPLIED: 'Replied',
  ONBOARDED: 'Onboarded',
  PRODUCT_ADDED: 'Product added',
  REJECTED: 'Rejected',
};

export const REVIEW_REASON_LABEL: Record<string, string> = {
  EMAIL_SYNTAX: 'Email address is not valid',
  EMAIL_NO_MX: 'Email domain has no mail server',
  EMAIL_MX_UNKNOWN: 'Mail server not checked yet',
  NO_REAL_CITY: 'No real city',
  NO_CATEGORY: 'No category',
  PHONE_INVALID: 'No valid phone number',
};

/** The filters of the leads page; also the URL query string. */
export interface LeadFilters {
  country: string;
  city?: string;
  category?: string;
  subcategory?: string;
  status?: LeadStatus;
  emailType?: 'GENERIC' | 'PERSONAL';
  minScore?: number;
  needsReview?: 'yes' | 'no';
  exported?: 'new' | 'exported';
  chain?: 'yes' | 'no';
  /** The business already sells online (shop, cart or marketplace shop on its website). */
  sellsOnline?: 'yes' | 'no';
  hasEmail?: 'yes' | 'no' | 'any';
  q?: string;
  page: number;
}

export interface LeadRow {
  id: number;
  name: string;
  email: string | null;
  emailType: string | null;
  emailOwnDomain: boolean | null;
  extraEmails: number;
  phone: string | null;
  website: string | null;
  city: string | null;
  category: string | null;
  score: number;
  status: string;
  needsReview: boolean;
  reviewReasons: string[];
  isChain: boolean;
  exportedAt: string | null;
  /** e.g. ["woocommerce", "cart"]; empty when not selling online or not checked yet. */
  onlineSignals: string[];
}

export interface LeadPage {
  items: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadDetail {
  id: number;
  name: string;
  status: string;
  score: number;
  needsReview: boolean;
  reviewReasons: string[];
  isChain: boolean;
  businessStatus: string;
  address: string | null;
  city: string | null;
  countryCode: string;
  website: string | null;
  phone: string | null;
  phoneValid: boolean;
  rating: number | null;
  ratingCount: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastCrawledAt: string | null;
  shopCheck: { sellsOnline: boolean | null; signals: string[]; checkedAt: string | null } | null;
  emails: {
    id: number;
    email: string;
    isPrimary: boolean;
    emailType: string;
    isOwnDomain: boolean;
    mxValid: boolean | null;
    source: string;
    sourceUrl: string | null;
    status: string;
    exportedAt: string | null;
    exportBatchId: number | null;
  }[];
  subcategories: { name: string; category: string; isPrimary: boolean; keyword: string | null }[];
  sources: { source: string; recordId: string; fetchedAt: string }[];
  history: { at: string; action: string; details: Record<string, unknown> | null }[];
}

export interface CategoryNode {
  id: number;
  slug: string;
  displayName: string;
  subcategories: { id: number; slug: string; displayName: string }[];
}

const clean = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ['leads', 'list', clean(filters)],
    queryFn: async () => (await api.get<LeadPage>('/leads', { params: clean(filters) })).data,
    placeholderData: keepPreviousData,
  });
}

export function useLeadFacets(country: string) {
  return useQuery({
    queryKey: ['leads', 'facets', country],
    queryFn: async () =>
      (
        await api.get<{ cities: { name: string; count: number }[] }>('/leads/facets', {
          params: { country },
        })
      ).data,
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      (await api.get<{ categories: CategoryNode[] }>('/categories')).data.categories,
    staleTime: 30 * 60_000,
  });
}

export function useLead(id: number | null) {
  return useQuery({
    queryKey: ['leads', 'detail', id],
    queryFn: async () => (await api.get<{ lead: LeadDetail }>(`/leads/${id}`)).data.lead,
    enabled: id !== null,
  });
}

/** After any change: the list, the detail and the export counts are stale. */
function useRefreshLeads() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
    void queryClient.invalidateQueries({ queryKey: ['exports'] });
  };
}

export function useSetLeadStatus() {
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: async (input: { id: number; status: LeadStatus }) =>
      (await api.patch<{ lead: LeadDetail }>(`/leads/${input.id}`, { status: input.status })).data
        .lead,
    onSuccess: (lead) => {
      toast.success(`Status set to ${STATUS_LABEL[lead.status] ?? lead.status}.`);
      refresh();
    },
  });
}

export function useBulkReject() {
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: async (ids: number[]) =>
      (await api.post<{ rejected: number }>('/leads/bulk-reject', { ids })).data,
    onSuccess: ({ rejected }) => {
      toast.success(`${rejected} lead${rejected === 1 ? '' : 's'} rejected.`);
      refresh();
    },
  });
}

export function useEraseLead() {
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<{ erased: { emailsErased: number } }>(`/leads/${id}/erase`)).data.erased,
    onSuccess: ({ emailsErased }) => {
      toast.success(
        `Personal data erased (${emailsErased} email${emailsErased === 1 ? '' : 's'}). They will never be collected again.`,
      );
      refresh();
    },
  });
}

/** "woocommerce" -> "WooCommerce", "cart" -> "cart / checkout" */
const SIGNAL_LABEL: Record<string, string> = {
  cart: 'cart / checkout',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  magento: 'Magento',
  prestashop: 'PrestaShop',
  opencart: 'OpenCart',
  'wix-stores': 'Wix Stores',
  'squarespace-commerce': 'Squarespace shop',
  bigcommerce: 'BigCommerce',
  ecwid: 'Ecwid',
  shopware: 'Shopware',
  etsy: 'Etsy shop',
  amazon: 'Amazon shop',
  ebay: 'eBay shop',
  skroutz: 'Skroutz shop',
  allegro: 'Allegro shop',
  bol: 'bol.com shop',
  cdiscount: 'Cdiscount shop',
  aliexpress: 'AliExpress store',
  zalando: 'Zalando brand',
};
export const signalLabel = (s: string) => SIGNAL_LABEL[s] ?? s;
