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
            <p className="text-sidebar-muted mb-1.5 flex items-center gap-2 px-2.5 text-[10px] font-bold tracking-[0.12em] uppercase">
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
                        className="text-sidebar-muted/60 flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-2 text-sm"
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
                        "block rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
