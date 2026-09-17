"use client";

import { AivahAssistantScript } from "@/components/aivah-assistant-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Bot,
  BotMessageSquare,
  ChevronLeft,
  ChevronRight,
  Drama,
  Menu,
  MessagesSquare,
  SlidersHorizontal,
  AudioLines,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  {
    label: "Experience",
    items: [{ href: "/new-chat", label: "Chat", icon: MessagesSquare }],
  },
  {
    label: "Platform",
    items: [
      { href: "/characters", label: "Characters", icon: Drama },
      { href: "/voices", label: "Voices", icon: AudioLines },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/assistant", label: "Assistant", icon: BotMessageSquare },
      { href: "/productivity", label: "Productivity", icon: Sparkles },
    ],
  },
];

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/new-chat"
      className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative grid size-9 shrink-0 place-items-center">
        <span className="absolute size-3 -translate-x-1 -translate-y-2 rotate-12 rounded-[45%_55%_50%_45%] bg-[#f15a24]" />
        <span className="absolute size-4 translate-x-0.5 translate-y-1.5 -rotate-12 rounded-[55%_45%_48%_52%] border-2 border-[#f15a24]" />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-2xl font-semibold tracking-[-0.055em]">
            aivah
          </span>
          <span className="block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Starter kit
          </span>
        </span>
      )}
    </Link>
  );
}

function Navigation({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary navigation"
      className="flex flex-col gap-7 p-3 pt-5"
    >
      {navigation.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-2 pb-1 text-[11px] font-semibold text-muted-foreground">
              {section.label}
            </p>
          )}
          {section.items.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === "/agents" && pathname.startsWith("/agents/")) ||
              (href === "/assistant" && pathname.startsWith("/assistant")) ||
              (href === "/productivity" &&
                pathname.startsWith("/productivity")) ||
              (href === "/new-chat" &&
                (pathname === "/chat" || pathname.startsWith("/chat/")));
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(
    () =>
      setCollapsed(localStorage.getItem("aivah-sidebar-collapsed") === "true"),
    [],
  );
  const toggle = () =>
    setCollapsed((value) => {
      localStorage.setItem("aivah-sidebar-collapsed", String(!value));
      return !value;
    });
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        Skip to content
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none lg:flex lg:flex-col",
          collapsed ? "w-[72px]" : "w-[236px]",
        )}
      >
        <div
          className={cn(
            "flex h-[76px] items-center px-4",
            collapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Brand collapsed={collapsed} />
          {!collapsed && <ThemeToggle />}
        </div>
        <Navigation collapsed={collapsed} />
        <div className="mt-auto p-3">
          {collapsed && (
            <div className="mb-2 flex justify-center">
              <ThemeToggle />
            </div>
          )}
          {!collapsed && (
            <div className="mb-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-[18px]" />
              <span>Private deployment</span>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              "h-11 w-full text-muted-foreground",
              collapsed ? "px-0" : "justify-start",
            )}
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            {!collapsed && <span>Collapse sidebar</span>}
          </Button>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/92 px-3 backdrop-blur lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11">
              <Menu />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[288px] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-16 items-center justify-between px-4">
              <Brand />
              <ThemeToggle />
            </div>
            <Separator />
            <Navigation onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold tracking-tight">
          Aivah Starter Kit
        </span>
        <ThemeToggle />
      </header>
      <div
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-dvh transition-[padding] duration-200 motion-reduce:transition-none",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[236px]",
        )}
      >
        {children}
      </div>
      <AivahAssistantScript />
    </div>
  );
}
