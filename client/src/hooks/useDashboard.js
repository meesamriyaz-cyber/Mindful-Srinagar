import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api.js";

export function useDashboard(token) {
  const [state, setState] = useState({ data: null, loading: Boolean(token), error: "" });

  useEffect(() => {
    if (!token) {
      setState({ data: null, loading: false, error: "" });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    apiRequest("/dashboard", { token })
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error: error.message });
      });

    return () => {
      active = false;
    };
  }, [token]);

  return state;
}
