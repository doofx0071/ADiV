"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/ui/theme-provider";
import {
  LayoutDashboard,
  History,
  Award,
  Download,
  Menu,
  BarChart3,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/history", label: "History", icon: History },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/export", label: "Export", icon: Download },
];

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </Link>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  const logoSrc =
    resolvedTheme === "dark" ? "/adv-logo-dark.svg" : "/adv-logo.svg";

  if (pathname === "/setup") return null;

  const navContent = (
    <>
      <Link href="/dashboard" className="flex justify-center px-2 pt-2 pb-1">
        <img src={logoSrc} alt="AdiV" className="h-12 w-auto" />
      </Link>
      <Separator className="mb-2" />
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
      <div className="mt-auto px-3 pb-4 pt-2">
        <Separator className="mb-3" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: Sheet trigger in top bar */}
      <div className="md:hidden sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-full flex-col">{navContent}</div>
            </SheetContent>
          </Sheet>
          <Link href="/dashboard">
            <img src={logoSrc} alt="AdiV" className="h-10 w-auto" />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Desktop: Fixed sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-56 flex-col border-r bg-card">
        <div className="flex h-full flex-col">{navContent}</div>
      </aside>

      {/* Content offset for sidebar */}
      <div className="hidden md:block w-56 shrink-0" />
    </>
  );
}
