import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import { isAdminRole, useAuthStore, type UserRole } from "../store/auth.store";

interface PrivateRouteProps {
  children: JSX.Element;
  allowedRoles?: UserRole[];
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role) && !(isAdminRole(user.role) && allowedRoles.includes('admin'))) {
    return <Navigate to={user.role === 'entrenador' ? '/training' : '/dashboard'} replace />;
  }

  return children;
};
