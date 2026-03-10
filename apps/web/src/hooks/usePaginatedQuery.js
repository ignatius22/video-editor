import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Generic pagination/query hook for limit/offset APIs.
 * queryFn must return { items, total }.
 */
export function usePaginatedQuery({
  queryKey,
  queryFn,
  pageSize = 10,
  initialPage = 1,
  enabled = true,
  staleTime = 30 * 1000,
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(initialPage);

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const fullQueryKey = useMemo(() => [...queryKey, { page, limit: pageSize, offset }], [queryKey, page, pageSize, offset]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => queryFn({ limit: pageSize, offset, page }),
    enabled,
    staleTime,
    placeholderData: (prev) => prev,
  });

  const total = data?.total || 0;
  const hasPrev = page > 1;
  const hasNext = offset + pageSize < total;

  const prefetchNext = useCallback(() => {
    if (!hasNext) return;
    const nextPage = page + 1;
    const nextOffset = (nextPage - 1) * pageSize;
    queryClient.prefetchQuery({
      queryKey: [...queryKey, { page: nextPage, limit: pageSize, offset: nextOffset }],
      queryFn: () => queryFn({ limit: pageSize, offset: nextOffset, page: nextPage }),
      staleTime,
    });
  }, [hasNext, page, pageSize, queryClient, queryKey, queryFn, staleTime]);

  const nextPage = useCallback(() => {
    if (hasNext) {
      setPage((prev) => prev + 1);
    }
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) setPage((prev) => Math.max(1, prev - 1));
  }, [hasPrev]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    items: data?.items || [],
    total,
    page,
    pageSize,
    offset,
    loading: isLoading,
    refreshing: isFetching && !isLoading,
    error,
    hasPrev,
    hasNext,
    setPage,
    nextPage,
    prevPage,
    prefetchNext,
    refresh,
  };
}
