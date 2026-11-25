"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Car,
  ChevronDown,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavIconName, NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NAV_CLOSED_COOKIE, SIDEBAR_COOKIE } from "@/lib/sidebar-state";

const ICONS: Record<NavIconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  people: Users,
  hr: ClipboardList,
  documents: FileText,
  it: Monitor,
  vehicles: Car,
  insurance: HeartPulse,
  reports: Building2,
  notifications: ShieldCheck,
  audit: ShieldCheck,
  settings: Settings,
};


/** Remembered for a year, and read by the server so the first paint is right. */
function remember(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * The desktop sidebar. Collapses to a narrow strip of section icons (the
 * button beside the brand, or the icon strip's own button to open it again).
 */
export function AppSidebar({
  sections,
  companyLabel,
  initialCollapsed,
  initialClosed,
}: {
  sections: NavSection[];
  companyLabel: string;
  initialCollapsed: boolean;
  initialClosed: string[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);

  function toggle(next: boolean) {
    setCollapsed(next);
    remember(SIDEBAR_COOKIE, next ? "collapsed" : "open");
  }

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-200 lg:flex print:lg:hidden",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "border-sidebar-border flex h-16 shrink-0 items-center border-b",
          collapsed ? "justify-center px-2" : "justify-between gap-2 px-4",
        )}
      >
        {collapsed ? null : (
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            >
              <Building2 className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-bold">Operations</span>
              <span className="text-sidebar-muted block truncate text-[11px] leading-tight">
                {companyLabel}
              </span>
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            toggle(!collapsed);
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
        >
          {collapsed ? <PanelLeftOpen className="size-4.5" /> : <PanelLeftClose className="size-4.5" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {collapsed ? (
          <nav aria-label="Main navigation" className="flex flex-col items-center gap-1 py-4">
            {sections.map((section) => {
              const Icon = ICONS[section.icon];
              const first = section.items.find((i) => !i.planned);
              const active = section.items.some((i) => isActiveHref(pathname, i.href));
              if (!first) return null;
              return (
                <Link
                  key={section.label}
                  href={first.href}
                  title={section.label}
                  aria-label={section.label}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </Link>
              );
            })}
          </nav>
        ) : (
          <SidebarNav sections={sections} initialClosed={initialClosed} />
        )}
      </div>
    </aside>
  );
}

/**
 * The section list. Each section heading folds its items away; the section
 * holding the current page always stays open.
 */
export function SidebarNav({
  sections,
  onNavigate,
  initialClosed = [],
}: {
  sections: NavSection[];
  onNavigate?: (() => void) | undefined;
  initialClosed?: string[];
}) {
  const pathname = usePathname();
  const [closed, setClosed] = React.useState(() => new Set(initialClosed));

  function toggleSection(label: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      remember(NAV_CLOSED_COOKIE, [...next].join("|"));
      return next;
    });
  }

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-3 py-4">
      {sections.map((section) => {
        const Icon = ICONS[section.icon];
        const hasActive = section.items.some((i) => isActiveHref(pathname, i.href));
        const open = hasActive || !closed.has(section.label);
        return (
          <div key={section.label} className="px-3">
            <button
              type="button"
              onClick={() => {
                toggleSection(section.label);
              }}
              aria-expanded={open}
              disabled={hasActive}
              className="text-sidebar-muted hover:text-sidebar-foreground mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase disabled:cursor-default disabled:hover:text-current"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="flex-1 text-left">{section.label}</span>
              {hasActive ? null : (
                <ChevronDown
                  className={cn("size-3.5 transition-transform", open ? "" : "-rotate-90")}
                  aria-hidden="true"
                />
              )}
            </button>
            {open ? (
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = isActiveHref(pathname, item.href);

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
                          "relative block rounded-lg px-3 py-[7px] text-[13.5px] font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-[0_6px_16px_-8px] shadow-sidebar-primary/60"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
