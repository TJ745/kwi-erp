import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-20 text-center">
        <ShieldX className="text-muted-foreground size-10" aria-hidden="true" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">You do not have access to that page</h1>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Your role does not include the required permission. If you believe this is wrong,
            ask an administrator to review your access.
          </p>
        </div>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to dashboard
        </Link>
      </div>
    </PageShell>
  );
}
