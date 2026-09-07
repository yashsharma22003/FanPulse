import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { customFetch, type ErrorType } from './custom-fetch';

export type BattleStatus = 'OPEN' | 'LOCKED' | 'RESOLVED' | 'VOIDED';
export type BattleDirection = 'UP' | 'DOWN';

export type BattleEntryRow = {
  wallet: string;
  direction: BattleDirection;
  confidencePercent: number;
  placement?: number;
  energyPaid?: string;
  isYou?: boolean;
};

export type BattleDetail = {
  id: string;
  status: BattleStatus;
  locksAt: string;
  secondsLeft: number;
  entrantCount: number;
  marketId: string;
  asset: string;
  intervalSec?: number;
  aiPercent?: number | null;
  battleUpPercent?: number | null;
  marketUpPercent?: number | null;
  winningDirection?: BattleDirection | null;
  voidReason?: string | null;
  resolvedAt?: string | null;
  entries: BattleEntryRow[];
};

export type BattleListItem = Omit<BattleDetail, 'entries'> & {
  entries?: BattleEntryRow[];
};

export type EnterBattleInput = {
  direction: BattleDirection;
  confidence: number;
  quantity?: number;
};

export type EnterBattleResponse = {
  battle: Pick<BattleDetail, 'id' | 'status' | 'locksAt' | 'secondsLeft' | 'entrantCount'>;
  prediction: { id: string; status: string };
  order: {
    approval: { to: string; data: string; value: string; chainId: number; description: string };
    order: { to: string; data: string; value: string; chainId: number; description: string };
  };
};

const enc = (marketId: string) => encodeURIComponent(marketId);

export const getMarketBattleUrl = (marketId: string) =>
  `/api/markets/${enc(marketId)}/battle`;

export const getBattleUrl = (battleId: string) => `/api/battles/${battleId}`;

export const getMarketBattleQueryKey = (marketId: string) =>
  [`/api/markets/${marketId}/battle`] as const;

export async function fetchMarketBattle(
  marketId: string,
  signal?: AbortSignal,
): Promise<BattleDetail | null> {
  if (!marketId.startsWith('0x')) return null;
  try {
    return await customFetch<BattleDetail | null>(getMarketBattleUrl(marketId), {
      signal,
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}

export function useGetMarketBattle(
  marketId: string,
  options?: {
    query?: Partial<UseQueryOptions<BattleDetail | null, ErrorType>>;
  },
) {
  return useQuery({
    queryKey: getMarketBattleQueryKey(marketId),
    queryFn: ({ signal }) => fetchMarketBattle(marketId, signal),
    enabled: Boolean(marketId) && marketId.startsWith('0x'),
    staleTime: 3000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'OPEN') return 5000;
      if (status === 'LOCKED') return 10000;
      return false;
    },
    retry: false,
    ...options?.query,
  });
}

export function useGetBattle(
  battleId: string,
  options?: {
    query?: Partial<UseQueryOptions<BattleDetail, ErrorType>>;
  },
) {
  return useQuery({
    queryKey: [`/api/battles/${battleId}`] as const,
    queryFn: ({ signal }) =>
      customFetch<BattleDetail>(getBattleUrl(battleId), { signal }),
    enabled: Boolean(battleId),
    staleTime: 3000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'OPEN') return 5000;
      if (status === 'LOCKED') return 10000;
      return false;
    },
    retry: false,
    ...options?.query,
  });
}

export function useEnterBattle(
  options?: UseMutationOptions<
    EnterBattleResponse,
    ErrorType,
    { marketId: string; data: EnterBattleInput }
  >,
) {
  return useMutation({
    mutationFn: ({ marketId, data }) =>
      customFetch<EnterBattleResponse>(`/api/battles/${enc(marketId)}/enter`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useConfirmBattleEntry(
  options?: UseMutationOptions<
    unknown,
    ErrorType,
    { predictionId: string; txHash: string }
  >,
) {
  return useMutation({
    mutationFn: ({ predictionId, txHash }) =>
      customFetch(`/api/battles/entries/${predictionId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ txHash }),
      }),
    ...options,
  });
}

export function getListBattlesQueryKey(params?: { status?: BattleStatus }) {
  return ['/api/battles', params] as QueryKey;
}

export async function listBattles(params?: { status?: BattleStatus; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return customFetch<BattleListItem[]>(`/api/battles${suffix}`);
}

export function useListBattles(
  params?: { status?: BattleStatus; limit?: number },
  options?: { query?: Partial<UseQueryOptions<BattleListItem[], ErrorType>> },
) {
  return useQuery({
    queryKey: getListBattlesQueryKey(params),
    queryFn: () => listBattles(params),
    staleTime: 15000,
    ...options?.query,
  });
}
