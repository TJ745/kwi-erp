"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Car,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  Monitor,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavIconName, NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  people: Users,
  hr: ClipboardList,
  documents: FileText,
  tasks: ListChecks,
  it: Monitor,
  vehicles: Car,
  insurance: HeartPulse,
  reports: Building2,
  notifications: ShieldCheck,
  audit: ShieldCheck,
  settings: Settings,
};

export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: (() => void) | undefined;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-6 py-4">
      {sections.map((section) => {
        const Icon = ICONS[section.icon];
        return (
          <div key={section.label} className="px-3">
            <p className="text-muted-foreground mb-1 flex items-center gap-2 px-2 text-xs font-medium tracking-wide uppercase">
              <Icon className="size-3.5" aria-hidden="true" />
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                // Planned routes render as disabled rather than 404ing —
                // honest about what exists without hiding the roadmap.
                if (item.planned) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title="Not yet available"
                        className="text-muted-foreground/50 flex cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-sm"
                      >
                        {item.label}
                        <span className="text-[10px] tracking-wide uppercase">soon</span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
