import { describe, expect, it } from "vitest";
import { assertCustomerIssuePatchPolicy } from "../services/customer-intake-policy.js";

describe("customer intake issue patch policy", () => {
  it("requires a customer resolution summary before closing a customer issue", () => {
    expect(() =>
      assertCustomerIssuePatchPolicy({
        isCustomerIssue: true,
        currentStatus: "in_review",
        nextStatus: "done",
        nextCustomerResolutionSummary: null,
        deliveryMetadataBeingSet: false,
        nextProjectId: "project-1",
        projectHasPrimaryWorkspace: true,
      }),
    ).toThrow(/customerResolutionSummary/i);
  });

  it("requires a project workspace before setting delivery metadata", () => {
    expect(() =>
      assertCustomerIssuePatchPolicy({
        isCustomerIssue: true,
        currentStatus: "in_progress",
        nextStatus: "in_review",
        nextCustomerResolutionSummary: null,
        deliveryMetadataBeingSet: true,
        nextProjectId: "project-1",
        projectHasPrimaryWorkspace: false,
      }),
    ).toThrow(/primary workspace cwd/i);
  });

  it("requires customer delivery metadata to be recorded while moving to in_review", () => {
    expect(() =>
      assertCustomerIssuePatchPolicy({
        isCustomerIssue: true,
        currentStatus: "in_progress",
        nextStatus: "todo",
        nextCustomerResolutionSummary: null,
        deliveryMetadataBeingSet: true,
        nextProjectId: "project-1",
        projectHasPrimaryWorkspace: true,
      }),
    ).toThrow(/in_review/i);
  });

  it("allows customer delivery metadata while moving issue to in_review", () => {
    expect(() =>
      assertCustomerIssuePatchPolicy({
        isCustomerIssue: true,
        currentStatus: "in_progress",
        nextStatus: "in_review",
        nextCustomerResolutionSummary: null,
        deliveryMetadataBeingSet: true,
        nextProjectId: "project-1",
        projectHasPrimaryWorkspace: true,
      }),
    ).not.toThrow();
  });

  it("allows closing a customer issue after in_review when metadata already exists but is not being changed", () => {
    expect(() =>
      assertCustomerIssuePatchPolicy({
        isCustomerIssue: true,
        currentStatus: "in_review",
        nextStatus: "done",
        nextCustomerResolutionSummary: "Merged in production.",
        deliveryMetadataBeingSet: false,
        nextProjectId: "project-1",
        projectHasPrimaryWorkspace: true,
      }),
    ).not.toThrow();
  });
});
