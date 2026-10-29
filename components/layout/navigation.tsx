"use client";

import { useEffect, useState } from "react";
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
  BarChart3,
  Image,
  Wrench,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/maintenance", label: "Maintenance", shortLabel: "Maint.", icon: Wrench },
  { href: "/analytics", label: "Analytics", shortLabel: "Stats", icon: BarChart3 },
  { href: "/gallery", label: "Gallery", shortLabel: "Gallery", icon: Image },
  { href: "/history", label: "History", shortLabel: "History", icon: History },
  { href: "/achievements", label: "Achievements", shortLabel: "Awards", icon: Award },
  { href: "/export", label: "Export", shortLabel: "Export", icon: Download },
];

function useIsActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isActive = useIsActive(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-none px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

function BottomNavItem({
  href,
  label,
  shortLabel,
  icon: Icon,
}: {
  href: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isActive = useIsActive(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 pb-1.5 pt-2 text-[10px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isActive ? "text-primary" : "text-foreground/60 hover:text-foreground"
      )}
    >
      {isActive && (
        <span aria-hidden="true" className="absolute inset-x-2 top-0 h-0.5 bg-primary" />
      )}
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="w-full truncate text-center tracking-tight">
        {shortLabel ?? label}
      </span>
    </Link>
  );
}

function useIsSetUpPage() {
  const pathname = usePathname();
  return pathname === "/setup";
}

function HeaderLogo({ src }: { src: string }) {
  const [showAlternate, setShowAlternate] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setShowAlternate((current) => !current);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <Link
      href="/dashboard"
      aria-label="AdiV dashboard"
      className="absolute left-3 flex h-11 w-[min(200px,calc(100vw-6rem))] items-center md:left-4"
    >
      <img
        src={src}
        alt="AdiV"
        className={`header-logo-layer absolute inset-0 h-11 w-full object-contain object-center ${showAlternate ? "opacity-0" : "opacity-100"}`}
      />
      <img
        src="/ADiV-shesh.png"
        alt=""
        aria-hidden="true"
        className={`header-logo-layer absolute inset-0 h-11 w-full object-contain object-center ${showAlternate ? "opacity-100" : "opacity-0"}`}
      />
    </Link>
  );
}

function TopHeader() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  const logoSrc =
    resolvedTheme === "dark" ? "/adv-logo-dark.svg" : "/adv-logo.svg";

  if (pathname === "/setup") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="relative flex h-14 w-full items-center justify-center px-4 md:h-16">
        {/* Logo - absolute left, doesn't affect nav centering */}
        <HeaderLogo src={logoSrc} />

        {/* Nav links - centered in header (bottom bar covers mobile) */}
        <nav className="hidden items-center justify-center xl:flex">
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

function BottomNav() {
  const hide = useIsSetUpPage();
  if (hide) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur xl:hidden"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-7">
        {NAV_ITEMS.map((item) => (
          <BottomNavItem key={item.href} {...item} />
        ))}
      </div>
    </nav>
  );
}

export function Navigation() {
  return (
    <>
      <TopHeader />
      <BottomNav />
    </>
  );
}
