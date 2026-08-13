import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalogBundle from "../../../../tests/fixtures/bundles/catalog.valid.json";
import requestBundle from "../../../../tests/fixtures/bundles/request.valid.json";
import { createCatalogRecord } from "../catalog";
import { createDraftSession } from "../session";
import { resetDatabaseConnection } from "../../storage/database";
import { appRepositories } from "../../storage/repositories";
import {
  getSemanticImportErrorMessage,
  importSemanticMatchResult,
  prepareSemanticMatchingPackage,
  SemanticImportError,
} from "./semantic-session-matching";

const clear = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase("auto-offer");
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe("semantic result import orchestration", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    await clear();
    let id = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `generated-${++id}`, subtle: globalThis.crypto.subtle });
  });
  afterEach(() => vi.unstubAllGlobals());

  async function fixture() {
    const catalog = createCatalogRecord(catalogBundle as never);
    const session = createDraftSession(requestBundle as never, [catalog], "semantic-import");
    await appRepositories.catalogs.save(catalog);
    await appRepositories.sessions.save(session);
    const old = await appRepositories.matchRuns.saveLatest({
      sessionId: session.sessionId,
      expectedSessionRevision: session.matchingRevision,
      result: { input_fingerprint: "old", lines: [] } as never,
    });
    const prepared = await prepareSemanticMatchingPackage({
      sessionId: session.sessionId,
      settings: session.matchingSettings,
      repositories: appRepositories,
    });
    const semanticResult = {
      kind: "semantic_match_result",
      schema_version: "1.0.0",
      taxonomy_version: prepared.matchingCatalog.taxonomy_version,
      request_id: prepared.matchingCatalog.request_id,
      package_fingerprint: prepared.matchingCatalog.package_fingerprint,
      lines: prepared.session.requestBundle.request_document.lines.map((line) => ({
        line_id: line.line_id,
        decision: "no_offer",
        reason_code: "NO_ELIGIBLE_OFFER",
        rationale_ru: "Подходящего предложения нет",
      })),
    };
    return { session: prepared.session, old, prepared, semanticResult };
  }

  it("stores the raw semantic result and atomically replaces the old run with empty decisions", async () => {
    const { session, old, prepared, semanticResult } = await fixture();
    const { runRecord } = await importSemanticMatchResult({
      sessionId: session.sessionId, semanticResult, repositories: appRepositories,
    });
    expect(runRecord).toMatchObject({
      runKind: "semantic", result: semanticResult,
      semanticContext: {
        taxonomyVersion: prepared.matchingCatalog.taxonomy_version,
        requestId: prepared.matchingCatalog.request_id,
        packageFingerprint: prepared.matchingCatalog.package_fingerprint,
        selectionPolicy: prepared.matchingCatalog.selection_policy,
        catalogRefs: prepared.matchingCatalog.catalog_refs,
      },
    });
    expect(runRecord.result).not.toHaveProperty("engine_version");
    expect(await appRepositories.matchRuns.get(old.id)).toBeUndefined();
    expect(await appRepositories.selectionStates.get(old.id)).toBeUndefined();
    expect(await appRepositories.sessions.get(session.sessionId)).toMatchObject({ latestMatchRunId: runRecord.id });
    expect(await appRepositories.selectionStates.get(runRecord.id)).toMatchObject({
      inputFingerprint: semanticResult.package_fingerprint, revision: 0, decisions: {}, feedback: {},
    });
  });

  it("rejects invalid input without touching the previous run or selection", async () => {
    const { session, old } = await fixture();
    const oldState = await appRepositories.selectionStates.get(old.id);
    await expect(importSemanticMatchResult({
      sessionId: session.sessionId, semanticResult: { invalid: true }, repositories: appRepositories,
    })).rejects.toBeInstanceOf(SemanticImportError);
    expect(await appRepositories.sessions.get(session.sessionId)).toMatchObject({ latestMatchRunId: old.id });
    expect(await appRepositories.matchRuns.get(old.id)).toEqual(old);
    expect(await appRepositories.selectionStates.get(old.id)).toEqual(oldState);
  });
});

describe("semantic import error messages", () => {
  it.each([
    ["FINGERPRINT_MISMATCH", "Результат создан для другого пакета подбора"],
    ["PACKAGE_TAMPERED", "Заявка, каталоги или настройки изменились после подготовки файлов"],
    ["REQUEST_ID_MISMATCH", "Результат относится к другой заявке"],
    ["UNKNOWN_OR_AMBIGUOUS_OFFER", "В результате указан товар, которого нет в подготовленном ассортименте"],
    ["CLASS_MISMATCH", "Выбран товар другого класса"],
    ["MATCH_LEVEL_EXCEEDED", "Результат превышает разрешённый уровень замены"],
    ["BRAND_POLICY_VIOLATION", "Результат нарушает ограничения по брендам"],
  ])("maps %s to user-facing text", (code, message) => {
    expect(getSemanticImportErrorMessage([{ code, path: "/internal", message: "internal" }])).toBe(message);
  });
});
