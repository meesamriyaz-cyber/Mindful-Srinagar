import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api.js";

export function useDashboard(token) {
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [state, setState] = useState({
    data: null,
    loading: Boolean(token),
    refreshing: false,
    error: "",
    updatedAt: null
  });

  useEffect(() => {
    if (!token) {
      setState({ data: null, loading: false, refreshing: false, error: "", updatedAt: null });
      return;
    }

    let active = true;
    setState((current) => ({
      ...current,
      loading: !current.data,
      refreshing: Boolean(current.data),
      error: ""
    }));

    apiRequest("/dashboard", { token })
      .then((data) => {
        if (active) {
          setState({
            data,
            loading: false,
            refreshing: false,
            error: "",
            updatedAt: new Date().toISOString()
          });
        }
      })
      .catch((error) => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            refreshing: false,
            error: error.message
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [token, refreshIndex]);

  return {
    ...state,
    refresh: () => setRefreshIndex((value) => value + 1)
  };
}
