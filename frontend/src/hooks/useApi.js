import { useEffect, useState } from "react";

export function useApi(fetcher, initialValue) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => mounted && setData(result))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [fetcher, reloadKey]);

  const refetch = () => setReloadKey((key) => key + 1);

  return { data, loading, error, refetch };
}
