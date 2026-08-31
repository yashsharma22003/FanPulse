/**
 * FanPulse API client (react-query). Paths are `/api/...` in the browser;
 * Vite proxies that prefix to the Nest API, or `setBaseUrl` strips it.
 */
import {
  useMutation,
  useQuery
} from '@tanstack/react-query';
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult
} from '@tanstack/react-query';

import type {
  AuthLoginResponse,
  AuthNonce,
  Challenge,
  ChallengeInput,
  GetLeaderboardParams,
  HealthStatus,
  LeaderboardEntry,
  Market,
  MarketDetail,
  OpenPrediction,
  PredictionConfirmation,
  PredictionInput,
  PreparedChallenge,
  PreparedPrediction,
  SiweLoginInput,
  TxConfirmInput,
  UserProfile
} from './api.schemas';

import { customFetch } from '../custom-fetch';
import type { ErrorType , BodyType } from '../custom-fetch';

type AwaitedInput<T> = PromiseLike<T> | T;

      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;


type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];



const withQueryKey = <T extends object, K>(query: T, queryKey: K): T & { queryKey: K } => {
  const result = { queryKey } as T & { queryKey: K };
  for (const key of Object.keys(query)) {
    // The explicit queryKey always wins, matching the previous
    // `{ ...query, queryKey }` spread where it was set last.
    if (key === 'queryKey') continue;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      get: () => (query as Record<string, unknown>)[key],
    });
  }
  return result;
};

export const getHealthCheckUrl = () => {




  return `/api/healthz`
}

/**
 * @summary Health check
 */
export const healthCheck = async ( options?: Parameters<typeof customFetch>[1]): Promise<HealthStatus> => {

  return customFetch<HealthStatus>(getHealthCheckUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getHealthCheckQueryKey = () => {
    return [
    `/api/healthz`
    ] as const;
    }


export const getHealthCheckQueryOptions = <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getHealthCheckQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof healthCheck>>> = ({ signal }) => healthCheck({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & { queryKey: QueryKey }
}

export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>
export type HealthCheckQueryError = ErrorType<unknown>


/**
 * @summary Health check
 */

export function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getHealthCheckQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetAuthNonceUrl = () => {




  return `/api/auth/nonce`
}

/**
 * @summary Create a SIWE nonce
 */
export const getAuthNonce = async ( options?: Parameters<typeof customFetch>[1]): Promise<AuthNonce> => {

  return customFetch<AuthNonce>(getGetAuthNonceUrl(),
  {
    ...options,
    method: 'POST'


  }
);}





export const getGetAuthNonceMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof getAuthNonce>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof getAuthNonce>>, TError,void, TContext> => {

const mutationKey = ['getAuthNonce'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof getAuthNonce>>, void> = () => {


          return  getAuthNonce(requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type GetAuthNonceMutationResult = NonNullable<Awaited<ReturnType<typeof getAuthNonce>>>

    export type GetAuthNonceMutationError = ErrorType<unknown>

    /**
 * @summary Create a SIWE nonce
 */
export const useGetAuthNonce = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof getAuthNonce>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof getAuthNonce>>,
        TError,
        void,
        TContext
      > => {
      return useMutation(getGetAuthNonceMutationOptions(options));
    }

export const getLoginWithSiweUrl = () => {




  return `/api/auth/login`
}

/**
 * @summary Exchange a signed SIWE message for a JWT
 */
export const loginWithSiwe = async (siweLoginInput: SiweLoginInput, options?: Parameters<typeof customFetch>[1]): Promise<AuthLoginResponse> => {

  return customFetch<AuthLoginResponse>(getLoginWithSiweUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(siweLoginInput)
  }
);}





export const getLoginWithSiweMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof loginWithSiwe>>, TError,{data: BodyType<SiweLoginInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof loginWithSiwe>>, TError,{data: BodyType<SiweLoginInput>}, TContext> => {

const mutationKey = ['loginWithSiwe'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof loginWithSiwe>>, {data: BodyType<SiweLoginInput>}> = (props) => {
          const {data} = props ?? {};

          return  loginWithSiwe(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type LoginWithSiweMutationResult = NonNullable<Awaited<ReturnType<typeof loginWithSiwe>>>
    export type LoginWithSiweMutationBody = BodyType<SiweLoginInput>
    export type LoginWithSiweMutationError = ErrorType<unknown>

    /**
 * @summary Exchange a signed SIWE message for a JWT
 */
export const useLoginWithSiwe = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof loginWithSiwe>>, TError,{data: BodyType<SiweLoginInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof loginWithSiwe>>,
        TError,
        {data: BodyType<SiweLoginInput>},
        TContext
      > => {
      return useMutation(getLoginWithSiweMutationOptions(options));
    }

export const getListMarketsUrl = () => {




  return `/api/markets`
}

/**
 * @summary List current markets
 */
export const listMarkets = async ( options?: Parameters<typeof customFetch>[1]): Promise<Market[]> => {

  return customFetch<Market[]>(getListMarketsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListMarketsQueryKey = () => {
    return [
    `/api/markets`
    ] as const;
    }


export const getListMarketsQueryOptions = <TData = Awaited<ReturnType<typeof listMarkets>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMarkets>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListMarketsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listMarkets>>> = ({ signal }) => listMarkets({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listMarkets>>, TError, TData> & { queryKey: QueryKey }
}

export type ListMarketsQueryResult = NonNullable<Awaited<ReturnType<typeof listMarkets>>>
export type ListMarketsQueryError = ErrorType<unknown>


/**
 * @summary List current markets
 */

export function useListMarkets<TData = Awaited<ReturnType<typeof listMarkets>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMarkets>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListMarketsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetMarketUrl = (marketId: string,) => {




  return `/api/markets/${marketId}`
}

/**
 * @summary Get market detail
 */
export const getMarket = async (marketId: string, options?: Parameters<typeof customFetch>[1]): Promise<MarketDetail> => {

  return customFetch<MarketDetail>(getGetMarketUrl(marketId),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetMarketQueryKey = (marketId: string,) => {
    return [
    `/api/markets/${marketId}`
    ] as const;
    }


export const getGetMarketQueryOptions = <TData = Awaited<ReturnType<typeof getMarket>>, TError = ErrorType<unknown>>(marketId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMarket>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetMarketQueryKey(marketId);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMarket>>> = ({ signal }) => getMarket(marketId, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: marketId !== null && marketId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMarket>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMarketQueryResult = NonNullable<Awaited<ReturnType<typeof getMarket>>>
export type GetMarketQueryError = ErrorType<unknown>


/**
 * @summary Get market detail
 */

export function useGetMarket<TData = Awaited<ReturnType<typeof getMarket>>, TError = ErrorType<unknown>>(
 marketId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMarket>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetMarketQueryOptions(marketId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreatePredictionUrl = () => {




  return `/api/predictions`
}

/**
 * @summary Prepare an on-chain prediction order
 */
export const createPrediction = async (predictionInput: PredictionInput, options?: Parameters<typeof customFetch>[1]): Promise<PreparedPrediction> => {

  return customFetch<PreparedPrediction>(getCreatePredictionUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(predictionInput)
  }
);}





export const getCreatePredictionMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createPrediction>>, TError,{data: BodyType<PredictionInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createPrediction>>, TError,{data: BodyType<PredictionInput>}, TContext> => {

const mutationKey = ['createPrediction'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createPrediction>>, {data: BodyType<PredictionInput>}> = (props) => {
          const {data} = props ?? {};

          return  createPrediction(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreatePredictionMutationResult = NonNullable<Awaited<ReturnType<typeof createPrediction>>>
    export type CreatePredictionMutationBody = BodyType<PredictionInput>
    export type CreatePredictionMutationError = ErrorType<unknown>

    /**
 * @summary Prepare an on-chain prediction order
 */
export const useCreatePrediction = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createPrediction>>, TError,{data: BodyType<PredictionInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createPrediction>>,
        TError,
        {data: BodyType<PredictionInput>},
        TContext
      > => {
      return useMutation(getCreatePredictionMutationOptions(options));
    }

export const getListOpenPredictionsUrl = () => {




  return `/api/predictions/open`
}

/**
 * @summary List challengeable predictions
 */
export const listOpenPredictions = async ( options?: Parameters<typeof customFetch>[1]): Promise<OpenPrediction[]> => {

  return customFetch<OpenPrediction[]>(getListOpenPredictionsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListOpenPredictionsQueryKey = () => {
    return [
    `/api/predictions/open`
    ] as const;
    }


export const getListOpenPredictionsQueryOptions = <TData = Awaited<ReturnType<typeof listOpenPredictions>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listOpenPredictions>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListOpenPredictionsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listOpenPredictions>>> = ({ signal }) => listOpenPredictions({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listOpenPredictions>>, TError, TData> & { queryKey: QueryKey }
}

export type ListOpenPredictionsQueryResult = NonNullable<Awaited<ReturnType<typeof listOpenPredictions>>>
export type ListOpenPredictionsQueryError = ErrorType<unknown>


/**
 * @summary List challengeable predictions
 */

export function useListOpenPredictions<TData = Awaited<ReturnType<typeof listOpenPredictions>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listOpenPredictions>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListOpenPredictionsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getConfirmPredictionUrl = (predictionId: string,) => {




  return `/api/predictions/${predictionId}/confirm`
}

/**
 * @summary Confirm a broadcast prediction order
 */
export const confirmPrediction = async (predictionId: string,
    txConfirmInput: TxConfirmInput, options?: Parameters<typeof customFetch>[1]): Promise<PredictionConfirmation> => {

  return customFetch<PredictionConfirmation>(getConfirmPredictionUrl(predictionId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(txConfirmInput)
  }
);}





export const getConfirmPredictionMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof confirmPrediction>>, TError,{predictionId: string;data: BodyType<TxConfirmInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof confirmPrediction>>, TError,{predictionId: string;data: BodyType<TxConfirmInput>}, TContext> => {

const mutationKey = ['confirmPrediction'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof confirmPrediction>>, {predictionId: string;data: BodyType<TxConfirmInput>}> = (props) => {
          const {predictionId,data} = props ?? {};

          return  confirmPrediction(predictionId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type ConfirmPredictionMutationResult = NonNullable<Awaited<ReturnType<typeof confirmPrediction>>>
    export type ConfirmPredictionMutationBody = BodyType<TxConfirmInput>
    export type ConfirmPredictionMutationError = ErrorType<unknown>

    /**
 * @summary Confirm a broadcast prediction order
 */
export const useConfirmPrediction = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof confirmPrediction>>, TError,{predictionId: string;data: BodyType<TxConfirmInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof confirmPrediction>>,
        TError,
        {predictionId: string;data: BodyType<TxConfirmInput>},
        TContext
      > => {
      return useMutation(getConfirmPredictionMutationOptions(options));
    }

export const getCreateChallengeUrl = (predictionId: string,) => {




  return `/api/predictions/${predictionId}/challenge`
}

/**
 * @summary Prepare an opposite-direction challenge order
 */
export const createChallenge = async (predictionId: string,
    challengeInput: ChallengeInput, options?: Parameters<typeof customFetch>[1]): Promise<PreparedChallenge> => {

  return customFetch<PreparedChallenge>(getCreateChallengeUrl(predictionId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(challengeInput)
  }
);}





export const getCreateChallengeMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createChallenge>>, TError,{predictionId: string;data: BodyType<ChallengeInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createChallenge>>, TError,{predictionId: string;data: BodyType<ChallengeInput>}, TContext> => {

const mutationKey = ['createChallenge'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createChallenge>>, {predictionId: string;data: BodyType<ChallengeInput>}> = (props) => {
          const {predictionId,data} = props ?? {};

          return  createChallenge(predictionId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateChallengeMutationResult = NonNullable<Awaited<ReturnType<typeof createChallenge>>>
    export type CreateChallengeMutationBody = BodyType<ChallengeInput>
    export type CreateChallengeMutationError = ErrorType<unknown>

    /**
 * @summary Prepare an opposite-direction challenge order
 */
export const useCreateChallenge = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createChallenge>>, TError,{predictionId: string;data: BodyType<ChallengeInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createChallenge>>,
        TError,
        {predictionId: string;data: BodyType<ChallengeInput>},
        TContext
      > => {
      return useMutation(getCreateChallengeMutationOptions(options));
    }

export const getGetChallengeUrl = (challengeId: string,) => {




  return `/api/challenges/${challengeId}`
}

/**
 * @summary Read challenge settlement state
 */
export const getChallenge = async (challengeId: string, options?: Parameters<typeof customFetch>[1]): Promise<Challenge> => {

  return customFetch<Challenge>(getGetChallengeUrl(challengeId),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetChallengeQueryKey = (challengeId: string,) => {
    return [
    `/api/challenges/${challengeId}`
    ] as const;
    }


export const getGetChallengeQueryOptions = <TData = Awaited<ReturnType<typeof getChallenge>>, TError = ErrorType<unknown>>(challengeId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getChallenge>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetChallengeQueryKey(challengeId);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getChallenge>>> = ({ signal }) => getChallenge(challengeId, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: challengeId !== null && challengeId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getChallenge>>, TError, TData> & { queryKey: QueryKey }
}

export type GetChallengeQueryResult = NonNullable<Awaited<ReturnType<typeof getChallenge>>>
export type GetChallengeQueryError = ErrorType<unknown>


/**
 * @summary Read challenge settlement state
 */

export function useGetChallenge<TData = Awaited<ReturnType<typeof getChallenge>>, TError = ErrorType<unknown>>(
 challengeId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getChallenge>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetChallengeQueryOptions(challengeId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getConfirmChallengeUrl = (originalPredictionId: string,) => {




  return `/api/challenges/${originalPredictionId}/confirm`
}

/**
 * @summary Confirm the challenger order using the original prediction id
 */
export const confirmChallenge = async (originalPredictionId: string,
    txConfirmInput: TxConfirmInput, options?: Parameters<typeof customFetch>[1]): Promise<PredictionConfirmation> => {

  return customFetch<PredictionConfirmation>(getConfirmChallengeUrl(originalPredictionId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(txConfirmInput)
  }
);}





export const getConfirmChallengeMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof confirmChallenge>>, TError,{originalPredictionId: string;data: BodyType<TxConfirmInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof confirmChallenge>>, TError,{originalPredictionId: string;data: BodyType<TxConfirmInput>}, TContext> => {

const mutationKey = ['confirmChallenge'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof confirmChallenge>>, {originalPredictionId: string;data: BodyType<TxConfirmInput>}> = (props) => {
          const {originalPredictionId,data} = props ?? {};

          return  confirmChallenge(originalPredictionId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type ConfirmChallengeMutationResult = NonNullable<Awaited<ReturnType<typeof confirmChallenge>>>
    export type ConfirmChallengeMutationBody = BodyType<TxConfirmInput>
    export type ConfirmChallengeMutationError = ErrorType<unknown>

    /**
 * @summary Confirm the challenger order using the original prediction id
 */
export const useConfirmChallenge = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof confirmChallenge>>, TError,{originalPredictionId: string;data: BodyType<TxConfirmInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof confirmChallenge>>,
        TError,
        {originalPredictionId: string;data: BodyType<TxConfirmInput>},
        TContext
      > => {
      return useMutation(getConfirmChallengeMutationOptions(options));
    }

export const getGetUserProfileUrl = (wallet: string,) => {




  return `/api/users/${wallet}`
}

/**
 * @summary Read a wallet profile
 */
export const getUserProfile = async (wallet: string, options?: Parameters<typeof customFetch>[1]): Promise<UserProfile> => {

  return customFetch<UserProfile>(getGetUserProfileUrl(wallet),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetUserProfileQueryKey = (wallet: string,) => {
    return [
    `/api/users/${wallet}`
    ] as const;
    }


export const getGetUserProfileQueryOptions = <TData = Awaited<ReturnType<typeof getUserProfile>>, TError = ErrorType<unknown>>(wallet: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getUserProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetUserProfileQueryKey(wallet);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getUserProfile>>> = ({ signal }) => getUserProfile(wallet, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: wallet !== null && wallet !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getUserProfile>>, TError, TData> & { queryKey: QueryKey }
}

export type GetUserProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getUserProfile>>>
export type GetUserProfileQueryError = ErrorType<unknown>


/**
 * @summary Read a wallet profile
 */

export function useGetUserProfile<TData = Awaited<ReturnType<typeof getUserProfile>>, TError = ErrorType<unknown>>(
 wallet: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getUserProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetUserProfileQueryOptions(wallet,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetLeaderboardUrl = (params?: GetLeaderboardParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/leaderboard?${stringifiedParams}` : `/api/leaderboard`
}

/**
 * @summary Read the public leaderboard
 */
export const getLeaderboard = async (params?: GetLeaderboardParams, options?: Parameters<typeof customFetch>[1]): Promise<LeaderboardEntry[]> => {

  return customFetch<LeaderboardEntry[]>(getGetLeaderboardUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetLeaderboardQueryKey = (params?: GetLeaderboardParams,) => {
    return [
    `/api/leaderboard`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetLeaderboardQueryOptions = <TData = Awaited<ReturnType<typeof getLeaderboard>>, TError = ErrorType<unknown>>(params?: GetLeaderboardParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getLeaderboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetLeaderboardQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getLeaderboard>>> = ({ signal }) => getLeaderboard(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getLeaderboard>>, TError, TData> & { queryKey: QueryKey }
}

export type GetLeaderboardQueryResult = NonNullable<Awaited<ReturnType<typeof getLeaderboard>>>
export type GetLeaderboardQueryError = ErrorType<unknown>


/**
 * @summary Read the public leaderboard
 */

export function useGetLeaderboard<TData = Awaited<ReturnType<typeof getLeaderboard>>, TError = ErrorType<unknown>>(
 params?: GetLeaderboardParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getLeaderboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetLeaderboardQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







