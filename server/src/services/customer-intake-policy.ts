import { unprocessable } from "../errors.js";

export interface CustomerIssuePatchPolicyInput {
  isCustomerIssue: boolean;
  currentStatus: string;
  nextStatus: string;
  nextCustomerResolutionSummary: string | null;
  deliveryMetadataBeingSet: boolean;
  nextProjectId: string | null;
  projectHasPrimaryWorkspace: boolean;
}

export function assertCustomerIssuePatchPolicy(input: CustomerIssuePatchPolicyInput) {
  if (input.isCustomerIssue && input.nextStatus === "done" && !input.nextCustomerResolutionSummary) {
    throw unprocessable("Customer-facing issues require customerResolutionSummary before done");
  }

  if (!input.deliveryMetadataBeingSet) return;

  if (!input.nextProjectId) {
    throw unprocessable("Delivery metadata requires a project with a primary workspace");
  }

  if (!input.projectHasPrimaryWorkspace) {
    throw unprocessable("Delivery metadata requires the project to have a primary workspace cwd");
  }

  if (input.isCustomerIssue && input.currentStatus !== "in_review" && input.nextStatus !== "in_review") {
    throw unprocessable("Customer-facing delivery metadata must be recorded while moving issue to in_review");
  }
}
