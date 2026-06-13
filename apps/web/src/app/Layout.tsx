import { NavLink, Outlet } from "react-router-dom";
import { useMe, useLogout } from "../auth/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex-1 py-3 text-center text-sm",
    isActive ? "font-medium text-primary" : "text-muted-foreground",
  );

export function Layout() {
  const me = useMe();
  const logout = useLogout();
  return (
    <>
      <main className="mx-auto max-w-screen-sm px-4 pb-24 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Health Ready</h2>
          <Button variant="secondary" size="sm" onClick={() => logout.mutate()}>
            Salir
          </Button>
        </div>
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-card">
        <NavLink to="/" end className={navItem}>
          Hoy
        </NavLink>
        <NavLink to="/history" className={navItem}>
          Historial
        </NavLink>
        <NavLink to="/progress" className={navItem}>
          Progreso
        </NavLink>
        {me.data?.role === "admin" && (
          <NavLink to="/exercises" className={navItem}>
            Ejercicios
          </NavLink>
        )}
      </nav>
    </>
  );
}
