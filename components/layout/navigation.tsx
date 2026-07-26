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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
        "flex items-center gap-2 rounded-none px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  const logoSrc =
    resolvedTheme === "dark" ? "/adv-logo-dark.svg" : "/adv-logo.svg";

  if (pathname === "/setup") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center px-4">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden absolute left-4">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 rounded-none">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex flex-col gap-1 px-3 py-4">
              <Link href="/dashboard" className="flex justify-center mb-2">
                <img src={logoSrc} alt="AdiV" className="h-14 max-w-[220px] w-auto" />
              </Link>
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo - absolute left, doesn't affect nav centering */}
        <Link href="/dashboard" className="absolute left-4 hidden md:block">
          <img src={logoSrc} alt="AdiV" className="h-11 max-w-[200px] w-auto" />
        </Link>

        {/* Nav links - perfectly centered in header */}
        <nav className="flex items-center justify-center">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Theme toggle - absolute right */}
        <div className="absolute right-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
