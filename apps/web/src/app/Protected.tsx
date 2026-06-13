import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../auth/useAuth";

export function Protected() {
  const me = useMe();
  if (me.isLoading)
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="size-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
