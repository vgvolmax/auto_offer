import { useEffect, useMemo, useReducer } from "react";
import type { CatalogRecord } from "../../../domain/catalog";
import type { SessionRecord } from "../../../domain/session";
import type { MatchRunRecord } from "../../../domain/matching/match-run";
import type { SessionMatchingSettings } from "../../../domain/matching/session-policy";
import {
  equalSessionMatchingSettings,
  validateSessionMatchingSettings,
} from "../../../domain/matching/session-policy";
import { isMatchRunCurrent } from "../../../domain/matching/match-run-current";
import {
  runSessionMatching,
  saveSessionMatchingSettings,
} from "../../../domain/matching/run-session-matching";
import { appRepositories } from "../../../storage/repositories";
type Stable =
  | "ready-clean"
  | "ready-dirty"
  | "success-current"
  | "success-stale";
interface StableSnapshot {
  kind: Stable;
  current: boolean;
}
type State =
  | { kind: "loading" }
  | {
      kind: Stable | "saving" | "running" | "error";
      session: SessionRecord | null;
      catalogs: CatalogRecord[];
      settings: SessionMatchingSettings;
      run?: MatchRunRecord;
      current: boolean;
      message?: string;
    };
type Action =
  | {
      type: "loaded";
      session: SessionRecord | null;
      catalogs: CatalogRecord[];
      run?: MatchRunRecord;
    }
  | { type: "change"; settings: SessionMatchingSettings }
  | { type: "busy"; kind: "saving" | "running" }
  | { type: "saved"; session: SessionRecord; run?: MatchRunRecord }
  | { type: "failed"; message: string };
function deriveStableSnapshot(input: {
  session: SessionRecord;
  settings: SessionMatchingSettings;
  run?: MatchRunRecord;
  catalogs: readonly CatalogRecord[];
}): StableSnapshot {
  if (
    !equalSessionMatchingSettings(
      input.session.matchingSettings,
      input.settings,
    )
  ) {
    return { kind: "ready-dirty", current: false };
  }
  if (!input.run) return { kind: "ready-clean", current: false };
  const current = isMatchRunCurrent({
    session: input.session,
    catalogs: input.catalogs,
    run: input.run,
  });
  return {
    kind: current ? "success-current" : "success-stale",
    current,
  };
}
function reducer(state: State, action: Action): State {
  if (action.type === "loaded") {
    if (!action.session)
      return {
        kind: "error",
        session: null,
        catalogs: [],
        settings: null as unknown as SessionMatchingSettings,
        current: false,
        message: "Черновик не найден",
      };
    const snapshot = deriveStableSnapshot({
      session: action.session,
      settings: action.session.matchingSettings,
      run: action.run,
      catalogs: action.catalogs,
    });
    return {
      ...snapshot,
      session: action.session,
      catalogs: action.catalogs,
      settings: action.session.matchingSettings,
      run: action.run,
    };
  }
  if (state.kind === "loading") return state;
  if (action.type === "change") {
    const snapshot = deriveStableSnapshot({
      session: state.session!,
      settings: action.settings,
      run: state.run,
      catalogs: state.catalogs,
    });
    return { ...state, ...snapshot, settings: action.settings };
  }
  if (action.type === "busy") return { ...state, kind: action.kind };
  if (action.type === "failed")
    return { ...state, kind: "error", message: action.message };
  const run = action.run ?? state.run;
  const snapshot = deriveStableSnapshot({
    session: action.session,
    settings: action.session.matchingSettings,
    run,
    catalogs: state.catalogs,
  });
  return {
    ...state,
    ...snapshot,
    session: action.session,
    settings: action.session.matchingSettings,
    run,
    message: undefined,
  };
}
export function useSessionMatching(id?: string) {
  const [state, dispatch] = useReducer(reducer, { kind: "loading" });
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const session = await appRepositories.sessions.get(id);
      if (!session)
        return dispatch({ type: "loaded", session: null, catalogs: [] });
      const catalogs = (
        await Promise.all(
          session.catalogRecordIds.map((x) => appRepositories.catalogs.get(x)),
        )
      ).filter((x): x is CatalogRecord => Boolean(x));
      const run = await appRepositories.matchRuns.getLatestForSession(id);
      dispatch({ type: "loaded", session, catalogs, run });
    })();
  }, [id]);
  const issues = useMemo(
    () =>
      state.kind === "loading"
        ? []
        : validateSessionMatchingSettings(
            state.settings,
            state.session?.catalogRecordIds ?? [],
          ),
    [state],
  );
  const change = (settings: SessionMatchingSettings) =>
    dispatch({ type: "change", settings });
  const save = async () => {
    if (state.kind === "loading" || !state.session || issues.length) return;
    dispatch({ type: "busy", kind: "saving" });
    try {
      dispatch({
        type: "saved",
        session: await saveSessionMatchingSettings({
          sessionId: state.session.sessionId,
          settings: state.settings,
          repositories: appRepositories,
        }),
      });
    } catch (e) {
      dispatch({
        type: "failed",
        message: e instanceof Error ? e.message : "Настройки не сохранены",
      });
    }
  };
  const run = async () => {
    if (state.kind === "loading" || !state.session || issues.length) return;
    dispatch({ type: "busy", kind: "running" });
    try {
      const result = await runSessionMatching({
        sessionId: state.session.sessionId,
        settings: state.settings,
        repositories: appRepositories,
      });
      dispatch({
        type: "saved",
        session: result.session,
        run: result.runRecord,
      });
    } catch (e) {
      dispatch({
        type: "failed",
        message: `${e instanceof Error ? e.message : "Ошибка подбора"} Предыдущий результат сохранён.`,
      });
    }
  };
  return { state, issues, change, save, run };
}
