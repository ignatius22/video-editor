import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Generic pagination/query hook for limit/offset APIs.
 * queryFn must return { items, total }.
 */
export function usePaginatedQuery({
  queryFn,
  pageSize = 10,
  initialPage = 1,
  enabled = true,
}) {
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const hasPrev = page > 1;
  const hasNext = offset + pageSize < total;

  const runQuery = useCallback(async (initial = false) => {
    if (!enabled) return;

    try {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const result = await queryFn({ limit: pageSize, offset, page });
      setData(result?.items || []);
      setTotal(result?.total || 0);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, offset, page, pageSize, queryFn]);

  useEffect(() => {
    runQuery(true);
  }, [runQuery]);

  const nextPage = useCallback(() => {
    if (hasNext) setPage((prev) => prev + 1);
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) setPage((prev) => Math.max(1, prev - 1));
  }, [hasPrev]);

  const refresh = useCallback(() => runQuery(false), [runQuery]);

  return {
    items: data,
    total,
    page,
    pageSize,
    offset,
    loading,
    refreshing,
    error,
    hasPrev,
    hasNext,
    setPage,
    nextPage,
    prevPage,
    refresh,
  };
}
