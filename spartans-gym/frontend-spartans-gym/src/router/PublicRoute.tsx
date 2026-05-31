// components/PublicRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import type { JSX } from "react";
interface PublicRouteProps {
  children: JSX.Element;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { token } = useAuthStore();

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};