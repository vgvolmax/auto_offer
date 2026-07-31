import {
  normalizeSessionRecord,
  type DraftSessionRecord,
  type SessionRecord,
  type StoredSessionRecord,
} from "../domain/session";
import {
  equalSessionMatchingSettings,
  type SessionMatchingSettings,
} from "../domain/matching/session-policy";
import { getDatabase } from "./database";
export type SessionSettingsWriteErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_CONFIRMED"
  | "SESSION_REVISION_CHANGED";
export class SessionSettingsWriteError extends Error {
  constructor(
    message: string,
    public readonly code: SessionSettingsWriteErrorCode,
  ) {
    super(message);
    this.name = "SessionSettingsWriteError";
  }
}
export const sessionsRepository = {
  async all() {
    return (await getDatabase())
      .getAll("sessions")
      .then((rows) => rows.map(normalizeSessionRecord));
  },
  async get(id: string) {
    const row = await (await getDatabase()).get("sessions", id);
    return row ? normalizeSessionRecord(row) : undefined;
  },
  async save(value: SessionRecord) {
    await (await getDatabase()).put("sessions", value as StoredSessionRecord);
    return value;
  },
  async updateMatchingSettings(input: {
    sessionId: string;
    expectedMatchingRevision: number;
    settings: SessionMatchingSettings;
  }): Promise<DraftSessionRecord> {
    const db = await getDatabase();
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const row = await store.get(input.sessionId);
    if (!row) {
      throw new SessionSettingsWriteError(
        "Сессия не найдена",
        "SESSION_NOT_FOUND",
      );
    }
    const session = normalizeSessionRecord(row);
    if (session.status !== "draft") {
      throw new SessionSettingsWriteError(
        "Подтверждённый результат доступен только для просмотра",
        "SESSION_CONFIRMED",
      );
    }
    if (session.matchingRevision !== input.expectedMatchingRevision) {
      throw new SessionSettingsWriteError(
        "Настройки сессии изменились в другой вкладке",
        "SESSION_REVISION_CHANGED",
      );
    }
    if (
      equalSessionMatchingSettings(session.matchingSettings, input.settings)
    ) {
      await tx.done;
      return session;
    }
    const next: DraftSessionRecord = {
      ...session,
      matchingSettings: {
        ...input.settings,
        brands: {
          ...input.settings.brands,
          include: [...input.settings.brands.include],
          exclude: [...input.settings.brands.exclude],
          preferred: [...input.settings.brands.preferred],
        },
        catalogPriority: [...input.settings.catalogPriority],
      },
      matchingRevision: session.matchingRevision + 1,
      updatedAt: new Date().toISOString(),
    };
    await store.put(next as StoredSessionRecord);
    await tx.done;
    return next;
  },
  async countUsingCatalog(id: string) {
    return (await this.all()).filter((session) =>
      session.catalogRecordIds.includes(id),
    ).length;
  },
  async remove(id: string) {
    const db = await getDatabase();
    const tx = db.transaction(
      ["sessions", "matchRuns", "selectionStates"],
      "readwrite",
    );
    const session = await tx.objectStore("sessions").get(id);
    if (session) {
      for (const key of await tx
        .objectStore("matchRuns")
        .index("by-session")
        .getAllKeys(id)) {
        await tx.objectStore("selectionStates").delete(key);
        await tx.objectStore("matchRuns").delete(key);
      }
      await tx.objectStore("sessions").delete(id);
    }
    await tx.done;
  },
};
