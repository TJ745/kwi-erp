"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { NotificationBell } from "@/components/shell/notification-bell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { findNavItem, type NavSection } from "@/lib/navigation";
import { SidebarNav } from "./sidebar";

export function Header({
  sections,
  user,
  logoutAction,
}: {
  sections: NavSection[];
  user: { name: string; email: string; roleKey: string; companyLabel: string };
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const match = findNavItem(pathname);

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-3 backdrop-blur-xl backdrop-saturate-150 sm:gap-3 sm:px-6 lg:px-8 print:hidden">
      {/* Sidebar collapses to a sheet below lg — the desktop layout is not
          simply shrunk (docs/ARCHITECTURE.md, brief §42). */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border w-[82vw] max-w-xs overflow-y-auto p-0"
        >
          <SheetTitle className="text-sidebar-foreground border-sidebar-border border-b px-5 pt-5 pb-4 text-base font-bold">
            Operations
          </SheetTitle>
          <SidebarNav
            sections={sections}
            onNavigate={() => {
              setMobileOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {match ? (
            <>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem className="hidden sm:inline-flex">
                <span className="text-muted-foreground">{match.section.label}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate">{match.item.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>

      <SearchHint />
      <NotificationBell />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 rounded-full pl-1">
            <span
              aria-hidden="true"
              className="bg-brand-teal text-brand-teal-foreground flex size-7 items-center justify-center rounded-full text-[11px] font-bold"
            >
              {initials(user.name)}
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {user.roleKey.replace(/_/g, " ")} · {user.companyLabel}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">Profile & settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/change-password">Change password</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild variant="destructive">
            <form action={logoutAction} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/** Hints at ⌘K without duplicating the dialog's own keyboard handler. */
/** Up to two initials, so "Talha Jamil" reads TJ and "Admin" reads A. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SearchHint() {
  const open = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground bg-card hover:border-primary/40 hidden h-9 w-64 justify-start gap-2 rounded-xl md:inline-flex"
        onClick={open}
      >
        <Search className="size-3.5" />
        <span className="text-xs">Search anything…</span>
        <kbd className="bg-muted ml-auto rounded-md border px-1.5 text-[10px] font-medium">⌘K</kbd>
      </Button>
      {/* Phones get the same search as an icon. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="Search"
        onClick={open}
      >
        <Search />
      </Button>
    </>
  );
}

function ThemeToggle() {
  const { setTheme } = useTheme();

  // Both icons are rendered and switched by CSS on the `dark` class that
  // next-themes puts on <html>. This avoids a "mounted" state flag entirely:
  // no hydration mismatch, no cascading render, and no icon flash on load.
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}
