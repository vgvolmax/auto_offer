import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PilotDiagnosticsPanel } from "./PilotDiagnosticsPanel";

describe("PilotDiagnosticsPanel", () => {
  it("is collapsed by default and warns about inconsistent taxonomy", () => {
    render(<PilotDiagnosticsPanel info={{ pilotReleaseId: "auto-offer-pilot-1.0.0", taxonomy: { requestVersion: "1", catalogVersions: [{ recordId: "r", catalogId: "c", taxonomyVersion: "2" }], consistent: false }, matcher: { engineVersion: "engine", policyVersion: "policy" }, contracts: { selectionStateSchemaVersion: "1.1.0", sessionConfirmationSchemaVersion: "1.0.0", aiFeedbackExportSchemaVersion: "1.1.0" }, storage: { databaseName: "auto-offer", databaseVersion: 3 }, session: { sessionId: "s", status: "draft", matchingRevision: 1, latestMatchRunId: "run", current: true, inputFingerprint: "fp", selectionStateRevision: 2 } }} />);
    const details = screen.getByText("Диагностика пилота").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByRole("alert")).toHaveTextContent("Версии таксономии заявки и каталогов не совпадают.");
    expect(screen.getByText("fp").tagName).toBe("CODE");
  });
});
