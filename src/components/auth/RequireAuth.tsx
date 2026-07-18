import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/api";

export function RequireAuth({
  role,
  loginPath,
  children,
}: {
  role: UserRole;
  loginPath: string;
  children: React.ReactNode;
}) {
  const { user, loading, token } = useAuth();

  // While validating an existing token, show spinner — but if we already have
  // a matching user (fresh login), let them through immediately.
  if (loading && !(user?.role === role && token)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Checking session…
      </div>
    );
  }

  if (!user || user.role !== role || !token) {
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
}
