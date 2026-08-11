import type { Metadata } from "next";
import { ChecklistPage } from "../_checklists/checklist-page";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <ChecklistPage
      type="ONBOARDING"
      title="Onboarding"
      description="Track each joining step — documents, insurance, accommodation, IT accounts, and the joining letter."
      viewPermission="hr.onboarding.view"
      managePermission="hr.onboarding.manage"
    />
  );
}
