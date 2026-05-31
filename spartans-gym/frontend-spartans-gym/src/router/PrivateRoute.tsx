// components/PrivateRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import type { JSX } from "react";
interface PrivateRouteProps {
  children: JSX.Element;
  allowedRoles?: ('admin' | 'recepcionista')[];  // ← NUEVO: roles permitidos
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { token, user } = useAuthStore();

  // No está autenticado
  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  // Verificar roles si se especificaron
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    // Redirigir al dashboard si no tiene permiso
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};