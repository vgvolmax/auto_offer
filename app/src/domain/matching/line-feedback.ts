import type { OfferRef } from "./offer-ref";

export type FeedbackOutcome =
  | "correct_result"
  | "suggested_candidate_incorrect"
  | "correct_candidate_ranked_low"
  | "correct_candidate_excluded"
  | "no_correct_candidate"
  | "other_outcome";
export type FeedbackCause =
  | "wrong_request_class"
  | "wrong_request_attributes"
  | "wrong_catalog_data"
  | "matching_rule_problem"
  | "unknown_cause"
  | "other_cause";
export interface LineFeedback {
  outcome?: FeedbackOutcome;
  suspectedCause?: FeedbackCause;
  comment?: string;
  relatedOfferRef?: OfferRef;
}
export const feedbackOutcomeLabels: Record<FeedbackOutcome, string> = {
  correct_result: "Результат системы правильный",
  suggested_candidate_incorrect: "Рекомендованный товар не подходит",
  correct_candidate_ranked_low: "Подходящий товар есть, но находится слишком низко",
  correct_candidate_excluded: "Подходящий товар ошибочно попал в исключённые",
  no_correct_candidate: "Подходящего товара нет среди результатов",
  other_outcome: "Другая проблема с результатом",
};
export const feedbackCauseLabels: Record<FeedbackCause, string> = {
  wrong_request_class: "Неверно определён тип товара в заявке",
  wrong_request_attributes: "Неверно определены параметры товара в заявке",
  wrong_catalog_data: "В каталоге неверные или неполные данные",
  matching_rule_problem: "Некорректно сработали правила бренда, эквивалентности или допустимой замены",
  unknown_cause: "Не могу определить причину",
  other_cause: "Другая причина",
};
export const feedbackCauseHints: Partial<Record<FeedbackCause, string>> = {
  wrong_request_class: "Например, кран определён как фитинг.",
  wrong_request_attributes: "Тип товара определён верно, но ошибочны диаметр, материал, резьба или другие параметры.",
};

export function normalizeLineFeedback(value: LineFeedback): LineFeedback | undefined {
  const comment = value.comment?.trim();
  const outcome = value.outcome;
  const result: LineFeedback = {
    ...(outcome && { outcome }),
    ...(outcome !== "correct_result" && value.suspectedCause && { suspectedCause: value.suspectedCause }),
    ...(comment && { comment }),
    ...(outcome && !["correct_result", "no_correct_candidate"].includes(outcome) && value.relatedOfferRef && {
      relatedOfferRef: { ...value.relatedOfferRef },
    }),
  };
  return Object.keys(result).length ? result : undefined;
}
