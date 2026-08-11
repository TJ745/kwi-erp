import type { Metadata } from "next";
import { ChecklistPage } from "../_checklists/checklist-page";

export const metadata: Metadata = { title: "Offboarding" };

export default function OffboardingPage() {
  return (
    <ChecklistPage
      type="OFFBOARDING"
      title="Offboarding"
      description="Clearance and exit. Completion is blocked while assets, accommodation, or tasks are outstanding."
      viewPermission="hr.offboarding.view"
      managePermission="hr.offboarding.manage"
    />
  );
}
