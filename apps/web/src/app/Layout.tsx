import { NavLink, Outlet } from "react-router-dom";
import {
  Dumbbell,
  History,
  LineChart,
  ListChecks,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useMe, useLogout } from "../auth/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Hoy", icon: Dumbbell, end: true },
  { to: "/history", label: "Historial", icon: History },
  { to: "/progress", label: "Progreso", icon: LineChart },
  { to: "/exercises", label: "Ejercicios", icon: ListChecks, adminOnly: true },
];

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
        <Dumbbell className="size-5 text-primary-foreground" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight">
        Health<span className="text-primary">Ready</span>
      </span>
    </div>
  );
}

export function Layout() {
  const me = useMe();
  const logout = useLogout();
  const items = NAV.filter((i) => !i.adminOnly || me.data?.role === "admin");
  const initial = me.data?.displayName?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-dvh">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/70 px-4 py-6 backdrop-blur-xl md:flex">
        <Brand className="px-2" />

        <nav className="mt-9 flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute left-0 h-5 w-1 rounded-r-full bg-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon
                    className={cn(
                      "size-[18px] transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-xl border border-sidebar-border bg-card/40 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary font-display text-sm font-bold text-foreground">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {me.data?.displayName ?? "—"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {me.data?.email}
            </div>
          </div>
          <button
            onClick={() => logout.mutate()}
            aria-label="Salir"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
        <Brand />
        <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
          <LogOut className="size-4" />
          Salir
        </Button>
      </header>

      {/* ── Content ─────────────────────────────────────── */}
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:px-10 md:pb-14 md:pt-10">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="size-5"
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
