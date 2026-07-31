import {
  normalizeSessionRecord,
  type SessionRecord,
  type StoredSessionRecord,
} from "../domain/session";
import { getDatabase } from "./database";
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
  async countUsingCatalog(id: string) {
    return (await this.all()).filter(
      (session) => session.catalogRecordIds.includes(id),
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
