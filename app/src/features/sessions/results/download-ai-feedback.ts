import type { AiFeedbackExportV1 } from "../../../domain/export/ai-feedback-export";
export const serializeAiFeedback = (data: AiFeedbackExportV1) => JSON.stringify(data, null, 2) + "\n";
export function createAiFeedbackFilename(sessionName: string, sessionId: string, timestamp = new Date().toISOString()) {
  const name = sessionName.replace(/[<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "session";
  return `auto-offer-ai-feedback_${name}_${sessionId}_${timestamp.replace(/[:.]/g, "-")}.json`;
}
export function downloadAiFeedback(data: AiFeedbackExportV1, filename: string) {
  const url = URL.createObjectURL(new Blob([serializeAiFeedback(data)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
