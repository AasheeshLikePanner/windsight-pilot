import { useCallback, useEffect, useState } from "react";

import { fetchDates, fetchMeta } from "../api";
import { errorMessage } from "../errors";
import type { DateCoverage, Meta } from "../types";

type SnapshotIndexState = {
  meta: Meta | null;
  dates: DateCoverage[];
  loading: boolean;
  error: string | null;
};

const initialState: SnapshotIndexState = {
  meta: null,
  dates: [],
  loading: true,
  error: null,
};

export function useSnapshotIndex() {
  const [state, setState] = useState(initialState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([fetchMeta(controller.signal), fetchDates(controller.signal)])
      .then(([meta, dates]) => {
        if (controller.signal.aborted) return;
        setState({ meta, dates, loading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: errorMessage(reason, "Could not load the snapshot index."),
        }));
      });

    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, retry };
}
