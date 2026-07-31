import { useEffect, useMemo, useState } from "react";
import type { CatalogRecord } from "../../../domain/catalog";
import type { SessionRecord } from "../../../domain/session";
import type { MatchRunRecord } from "../../../domain/matching/match-run";
import { buildMatchResultReviewView } from "../../../domain/matching/match-result-review";
import type { OfferRef } from "../../../domain/matching/offer-ref";
import type { SelectionStateRecord } from "../../../domain/matching/selection-state";
import type { LineFeedback } from "../../../domain/matching/line-feedback";
import {
  clearDecisionForLine,
  markNoOfferForLine,
  selectOfferForLine,
} from "../../../domain/matching/update-selection";
import {
  clearFeedbackForLine,
  saveFeedbackForLine,
} from "../../../domain/matching/update-line-feedback";
import { appRepositories } from "../../../storage/repositories";
export type ResultFilter =
  | "all"
  | "undecided"
  | "selected"
  | "no_offer"
  | "with_feedback"
  | "no_match"
  | "review_required"
  | "excluded_by_policy";
export const MATCH_RESULTS_BATCH_SIZE = 50;
export type MatchReviewState =
  | { kind: "loading" }
  | { kind: "ready"; selectionState: SelectionStateRecord }
  | {
      kind: "saving";
      selectionState: SelectionStateRecord;
      savingLineId: string;
    }
  | { kind: "error"; selectionState?: SelectionStateRecord; message: string };
export function useMatchResultReview(input: {
  session: SessionRecord;
  catalogs: readonly CatalogRecord[];
  run: MatchRunRecord;
  current: boolean;
  writeLocked: boolean;
}) {
  const [state, setState] = useState<MatchReviewState>({ kind: "loading" });
  const [filter, setFilterValue] = useState<ResultFilter>("all");
  const [query, setQueryValue] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feedbackExpanded, setFeedbackExpandedState] = useState<Set<string>>(
    new Set(),
  );
  const [limit, setLimit] = useState(MATCH_RESULTS_BATCH_SIZE);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    void appRepositories.selectionStates
      .getOrCreateForRun(input.run)
      .then((s) => active && setState({ kind: "ready", selectionState: s }))
      .catch(
        (e) =>
          active &&
          setState({
            kind: "error",
            message:
              e instanceof Error ? e.message : "Не удалось загрузить решения",
          }),
      );
    return () => {
      active = false;
    };
  }, [input.run]);
  const selection =
    state.kind === "loading" ||
    state.selectionState?.matchRunId !== input.run.id
      ? undefined
      : state.selectionState;
  const view = useMemo(
    () =>
      selection
        ? buildMatchResultReviewView({ ...input, selectionState: selection })
        : undefined,
    [input, selection],
  );
  const filtered = useMemo(() => {
    if (!view) return [];
    const q = query.trim().toLowerCase();
    return view.lines.filter((l) => {
      const matches =
        !q ||
        [
          l.lineId,
          l.requestText,
          ...l.candidates.map((c) => c.productLabel),
          l.selectedOfferRef?.source_item_id ?? "",
        ].some((x) => x.toLowerCase().includes(q));
      const f =
        filter === "all" ||
        (filter === "undecided" && !l.hasDecision) ||
        (filter === "selected" && l.decisionKind === "selected_offer") ||
        (filter === "no_offer" && l.decisionKind === "no_offer") ||
        (filter === "with_feedback" && Boolean(l.feedback)) ||
        (filter === "no_match" && l.resolution === "no_match") ||
        (filter === "review_required" &&
          ["request_review_required", "request_invalid"].includes(
            l.resolution,
          )) ||
        (filter === "excluded_by_policy" &&
          l.resolution === "excluded_by_policy");
      return matches && f;
    });
  }, [view, filter, query]);
  const setFilter = (x: ResultFilter) => {
      setFilterValue(x);
      setLimit(MATCH_RESULTS_BATCH_SIZE);
    },
    setQuery = (x: string) => {
      setQueryValue(x);
      setLimit(MATCH_RESULTS_BATCH_SIZE);
    };
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  async function perform(
    lineId: string,
    operation: (common: {
      sessionId: string;
      matchRunId: string;
      lineId: string;
      expectedSelectionRevision: number;
      repositories: typeof appRepositories;
    }) => Promise<SelectionStateRecord>,
  ): Promise<boolean> {
    if (
      !selection ||
      state.kind === "saving" ||
      !input.current ||
      input.writeLocked
    )
      return false;
    setState({
      kind: "saving",
      selectionState: selection,
      savingLineId: lineId,
    });
    try {
      const common = {
        sessionId: input.session.sessionId,
        matchRunId: input.run.id,
        lineId,
        expectedSelectionRevision: selection.revision,
        repositories: appRepositories,
      };
      const next = await operation(common);
      setState({ kind: "ready", selectionState: next });
      return true;
    } catch (e) {
      if (
        e instanceof Error &&
        "code" in e &&
        e.code === "STALE_SELECTION_STATE"
      ) {
        const fresh = await appRepositories.selectionStates.get(input.run.id);
        setState({
          kind: "error",
          selectionState: fresh,
          message: "Решение изменилось в другой вкладке. Данные обновлены.",
        });
      } else
        setState({
          kind: "error",
          selectionState: selection,
          message: e instanceof Error ? e.message : "Ошибка сохранения",
        });
      return false;
    }
  }
  const selectOffer = (lineId: string, offerRef: OfferRef) =>
    perform(lineId, (common) => selectOfferForLine({ ...common, offerRef }));
  const markNoOffer = async (lineId: string): Promise<boolean> => {
    const saved = await perform(lineId, markNoOfferForLine);
    if (saved)
      setFeedbackExpandedState((current) => new Set(current).add(lineId));
    return saved;
  };
  const setFeedbackExpanded = (lineId: string, open: boolean) =>
    setFeedbackExpandedState((current) => {
      const next = new Set(current);
      open ? next.add(lineId) : next.delete(lineId);
      return next;
    });
  const clearDecision = (lineId: string) =>
    perform(lineId, clearDecisionForLine);
  const saveFeedback = (lineId: string, feedback: LineFeedback) =>
    perform(lineId, (common) => saveFeedbackForLine({ ...common, feedback }));
  const clearFeedback = (lineId: string) =>
    perform(lineId, clearFeedbackForLine);
  const reloadSelectionState = async (): Promise<boolean> => {
    try {
      const fresh = await appRepositories.selectionStates.get(input.run.id);
      if (!fresh) throw new Error("Решения для запуска не найдены");
      setState({ kind: "ready", selectionState: fresh });
      return true;
    } catch (e) {
      setState({
        kind: "error",
        selectionState: selection,
        message: e instanceof Error ? e.message : "Не удалось обновить решения",
      });
      return false;
    }
  };
  return {
    state,
    view,
    lines: filtered.slice(0, limit),
    hasMore: filtered.length > limit,
    showMore: () => setLimit((x) => x + MATCH_RESULTS_BATCH_SIZE),
    filter,
    setFilter,
    query,
    setQuery,
    expanded,
    feedbackExpanded,
    setFeedbackExpanded,
    toggle,
    selectOffer,
    markNoOffer,
    clearDecision,
    saveFeedback,
    clearFeedback,
    reloadSelectionState,
  };
}
