import { catalogsRepository } from "./catalogs-repository";
import { sessionsRepository } from "./sessions-repository";
import { matchRunsRepository } from "./match-runs-repository";
import { selectionStatesRepository } from "./selection-states-repository";
import { sessionReviewRepository } from "./session-review-repository";
export const appRepositories = {
  catalogs: catalogsRepository,
  sessions: sessionsRepository,
  matchRuns: matchRunsRepository,
  selectionStates: selectionStatesRepository,
  sessionReview: sessionReviewRepository,
};
export type AppRepositories = typeof appRepositories;
