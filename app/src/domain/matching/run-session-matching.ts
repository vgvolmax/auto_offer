import {
  MatchingInputError,
  runPilotMatcher,
  type MatchResult,
  type MatcherInput,
} from "./index";
import type { SessionRecord } from "../session";
import type { AppRepositories } from "../../storage/repositories";
import type { MatchRunRecord, MatchRunSummary } from "./match-run";
import { summarizeMatchResult } from "./match-run";
import {
  buildSessionMatchingPolicy,
  validateSessionMatchingSettings,
  type SessionMatchingSettings,
} from "./session-policy";
import {
  PILOT_MATCHING_ENGINE_VERSION,
  pilotPolicyRegistry,
} from "./pilot-config";
import { StaleMatchRunError } from "../../storage/match-runs-repository";
import { SessionSettingsWriteError } from "../../storage/sessions-repository";
export type SessionMatchingErrorCode =
  | "SESSION_NOT_FOUND"
  | "CATALOG_RECORD_MISSING"
  | "INVALID_MATCHING_SETTINGS"
  | "MATCHING_INPUT_INVALID"
  | "STALE_MATCH_RUN"
  | "MATCH_RUN_PERSIST_FAILED"
  | "SESSION_CONFIRMED"
  | "SESSION_REVISION_CHANGED";
export class SessionMatchingError extends Error {
  constructor(
    message: string,
    public code: SessionMatchingErrorCode,
    public path?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SessionMatchingError";
  }
}
export interface RunSessionMatchingResult {
  session: SessionRecord;
  runRecord: MatchRunRecord;
  summary: MatchRunSummary;
}
export async function saveSessionMatchingSettings(input: {
  sessionId: string;
  settings: SessionMatchingSettings;
  repositories: AppRepositories;
}): Promise<SessionRecord> {
  const session = await input.repositories.sessions.get(input.sessionId);
  if (!session)
    throw new SessionMatchingError("Сессия не найдена", "SESSION_NOT_FOUND");
  const issue = validateSessionMatchingSettings(
    input.settings,
    session.catalogRecordIds,
  )[0];
  if (issue)
    throw new SessionMatchingError(
      issue.message,
      "INVALID_MATCHING_SETTINGS",
      issue.path,
    );
  try {
    return await input.repositories.sessions.updateMatchingSettings({
      sessionId: session.sessionId,
      expectedMatchingRevision: session.matchingRevision,
      settings: input.settings,
    });
  } catch (error) {
    if (error instanceof SessionSettingsWriteError)
      throw new SessionMatchingError(
        error.code === "SESSION_REVISION_CHANGED"
          ? "Настройки сессии изменились в другой вкладке. Обновите данные и повторите действие."
          : error.message,
        error.code,
        undefined,
        { cause: error },
      );
    throw error;
  }
}
export async function runSessionMatching(input: {
  sessionId: string;
  settings: SessionMatchingSettings;
  repositories: AppRepositories;
  runMatcher?: (input: MatcherInput) => Promise<MatchResult>;
}): Promise<RunSessionMatchingResult> {
  let session = await saveSessionMatchingSettings(input);
  const catalogs = [];
  for (const id of session.catalogRecordIds) {
    const catalog = await input.repositories.catalogs.get(id);
    if (!catalog)
      throw new SessionMatchingError(
        `Каталог ${id} не найден`,
        "CATALOG_RECORD_MISSING",
        id,
      );
    catalogs.push(catalog);
  }
  const policy = buildSessionMatchingPolicy({
    sessionId: session.sessionId,
    catalogRecordIds: session.catalogRecordIds,
    settings: session.matchingSettings,
    policyRegistryVersion: pilotPolicyRegistry.policy_version,
  });
  let result: MatchResult;
  try {
    result = await (input.runMatcher ?? runPilotMatcher)({
      requestBundle: session.requestBundle,
      catalogs: catalogs.map((catalog) => ({
        catalogRecordId: catalog.recordId,
        bundle: catalog.bundle,
      })),
      policy,
      registry: pilotPolicyRegistry,
      engineVersion: PILOT_MATCHING_ENGINE_VERSION,
    } as unknown as MatcherInput);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "SESSION_CONFIRMED"
    )
      throw new SessionMatchingError(
        error.message,
        "SESSION_CONFIRMED",
        undefined,
        { cause: error },
      );
    if (error instanceof MatchingInputError)
      throw new SessionMatchingError(
        error.message,
        "MATCHING_INPUT_INVALID",
        error.path,
        {
          cause: { code: error.code, path: error.path, message: error.message },
        },
      );
    throw error;
  }
  try {
    const runRecord = await input.repositories.matchRuns.saveLatest({
      sessionId: session.sessionId,
      expectedSessionRevision: session.matchingRevision,
      result,
    });
    session = {
      ...session,
      latestMatchRunId: runRecord.id,
      updatedAt: runRecord.createdAt,
    };
    return { session, runRecord, summary: summarizeMatchResult(result) };
  } catch (error) {
    if (
      error instanceof StaleMatchRunError ||
      (error instanceof Error &&
        "code" in error &&
        error.code === "STALE_MATCH_RUN")
    )
      throw new SessionMatchingError(
        "Настройки изменились во время запуска. Повторите подбор.",
        "STALE_MATCH_RUN",
        undefined,
        { cause: error },
      );
    throw new SessionMatchingError(
      "Новый запуск не сохранён",
      "MATCH_RUN_PERSIST_FAILED",
      undefined,
      { cause: error },
    );
  }
}
