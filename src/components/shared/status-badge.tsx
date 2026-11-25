import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * ONE status→colour mapping for the whole application.
 *
 * Inline `bg-green-100` anywhere else is a review failure: consistency is what
 * lets someone scan a table and trust the colours (docs/MODULES.md §6).
 */

type Tone = "valid" | "warning" | "expired" | "info" | "neutral" | "default";

/**
 * Every status enum value in the system, mapped to a tone and a human label.
 * Keys are UPPER_SNAKE to match the Prisma enums exactly.
 */
const STATUS_TONES: Record<string, { tone: Tone; label?: string }> = {
  // Generic lifecycle
  ACTIVE: { tone: "valid" },
  INACTIVE: { tone: "neutral" },
  ARCHIVED: { tone: "neutral" },
  SUSPENDED: { tone: "warning" },
  DISABLED: { tone: "expired" },

  // Employee
  NEW_HIRE: { tone: "info", label: "New hire" },
  ON_LEAVE: { tone: "info", label: "On leave" },
  RESIGNED: { tone: "neutral" },
  TERMINATED: { tone: "expired" },
  EXITED: { tone: "neutral" },

  // Expiry (computed)
  VALID: { tone: "valid" },
  EXPIRING_SOON: { tone: "warning", label: "Expiring soon" },
  EXPIRED: { tone: "expired" },

  // Approvals
  PENDING: { tone: "warning" },
  APPROVED: { tone: "valid" },
  REJECTED: { tone: "expired" },
  CANCELLED: { tone: "neutral" },

  // Checklist items
  TODO: { tone: "neutral", label: "To do" },
  IN_PROGRESS: { tone: "info", label: "In progress" },
  WAITING: { tone: "warning" },
  COMPLETED: { tone: "valid" },
  BLOCKED: { tone: "expired" },
  NOT_APPLICABLE: { tone: "neutral", label: "N/A" },

  // Priority
  LOW: { tone: "neutral" },
  MEDIUM: { tone: "info" },
  HIGH: { tone: "warning" },
  URGENT: { tone: "expired" },
  CRITICAL: { tone: "expired" },

  // Tickets
  OPEN: { tone: "info" },
  RESOLVED: { tone: "valid" },
  CLOSED: { tone: "neutral" },

  // Assets
  AVAILABLE: { tone: "valid" },
  ASSIGNED: { tone: "info" },
  UNDER_REPAIR: { tone: "warning", label: "Under repair" },
  LOST: { tone: "expired" },
  RETIRED: { tone: "neutral" },
  DISPOSED: { tone: "neutral" },

  // Condition
  NEW: { tone: "valid" },
  GOOD: { tone: "valid" },
  FAIR: { tone: "warning" },
  POOR: { tone: "warning" },
  DAMAGED: { tone: "expired" },

  // Contracts / bills / policies
  DRAFT: { tone: "neutral" },
  RENEWED: { tone: "valid" },
  PAID: { tone: "valid" },
  OVERDUE: { tone: "expired" },
  PENDING_RENEWAL: { tone: "warning", label: "Pending renewal" },

  // Job offers
  SENT: { tone: "info" },

  // Vehicles
  IN_MAINTENANCE: { tone: "warning", label: "In maintenance" },
  OUT_OF_SERVICE: { tone: "expired", label: "Out of service" },
  SOLD: { tone: "neutral" },

  // Accommodation
  OCCUPIED: { tone: "info" },
  RESERVED: { tone: "warning" },
  VACANT: { tone: "valid" },
};

/** Turns UPPER_SNAKE_CASE into "Sentence case" when no explicit label exists. */
function humanise(status: string): string {
  const lower = status.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) {
    return (
      <Badge variant="neutral" className={className}>
        —
      </Badge>
    );
  }

  const entry = STATUS_TONES[status];
  const tone = entry?.tone ?? "neutral";

  return (
    <Badge variant={tone === "default" ? "default" : tone} className={cn(className)}>
      {entry?.label ?? humanise(status)}
    </Badge>
  );
}
