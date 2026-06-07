"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/ui/theme-provider";
import {
  LayoutDashboard,
  Wrench,
  Route,
  Fuel,
  Wallet,
  History,
  Award,
  Download,
  Menu,
  BarChart3,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  const logoSrc = resolvedTheme === "dark" ? "/adv-logo-dark.svg" : "/adv-logo.svg";

  // Don't show nav on setup page
  if (pathname === "/setup") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-8">
        {/* Mobile nav */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <div className="flex flex-col gap-4 py-4">
              <Link href="/dashboard" className="flex items-center px-2">
                <img src={logoSrc} alt="AdiV" className="h-14 w-auto" />
              </Link>
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center mr-4">
          <img src={logoSrc} alt="AdiV logo" className="h-14 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
