export const MANAGED_USER_ROLES = ['admin', 'recepcionista', 'entrenador'] as const;

export function isAdminRole(role: string | undefined) {
  return role === 'admin' || role === 'superadmin';
}

export function isSuperAdminRole(role: string | undefined) {
  return role === 'superadmin';
}
