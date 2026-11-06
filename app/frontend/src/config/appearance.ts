export type SidebarStyle = 'light' | 'dark' | 'brand';
export type AnimationStyle = 'none' | 'subtle' | 'dynamic';
export type RadiusStyle = 'compact' | 'rounded' | 'soft';

export interface AppearanceConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  sidebarStyle: SidebarStyle;
  animation: AnimationStyle;
  radius: RadiusStyle;
  loginBackground: string | null;
  sidebarBackground: string | null;
  loginHeadline: string;
  loginSubtitle: string;
  showLoginOverlay: boolean;
}

export const defaultAppearance: AppearanceConfig = {
  primaryColor: '#d60000',
  secondaryColor: '#2b2b2b',
  accentColor: '#ff3b30',
  backgroundColor: '#f7f7f7',
  sidebarStyle: 'light',
  animation: 'subtle',
  radius: 'rounded',
  loginBackground: null,
  sidebarBackground: null,
  loginHeadline: 'Gestión inteligente para tu gimnasio',
  loginSubtitle: 'Administra miembros, ventas y asistencias en un solo lugar.',
  showLoginOverlay: true,
};

export const normalizeAppearance = (value?: Partial<AppearanceConfig> | null): AppearanceConfig => ({
  ...defaultAppearance,
  ...(value || {}),
});

export function applyAppearance(value?: Partial<AppearanceConfig> | null) {
  const appearance = normalizeAppearance(value);
  const root = document.documentElement;
  root.style.setProperty('--color-primary', appearance.primaryColor);
  root.style.setProperty('--color-primary-container', appearance.accentColor);
  root.style.setProperty('--color-secondary', appearance.secondaryColor);
  root.style.setProperty('--color-surface-container-low', appearance.backgroundColor);
  root.style.setProperty('--brand-primary', appearance.primaryColor);
  root.style.setProperty('--brand-secondary', appearance.secondaryColor);
  root.style.setProperty('--brand-accent', appearance.accentColor);
  root.style.setProperty('--brand-background', appearance.backgroundColor);
  root.style.setProperty('--radius-24', appearance.radius === 'compact' ? '12px' : appearance.radius === 'soft' ? '32px' : '24px');
  root.dataset.animation = appearance.animation;
  root.dataset.sidebarStyle = appearance.sidebarStyle;
}
