import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../auth/useAuth";

export function Protected() {
  const me = useMe();
  if (me.isLoading)
    return <div className="p-4 text-muted-foreground">Cargando…</div>;
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
