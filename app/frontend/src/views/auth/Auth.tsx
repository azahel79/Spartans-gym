import { normalizeAppearance } from '../../config/appearance';
import { useAuth } from '../../hooks/auth/useAuth';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useConfigStore } from '../../store/config.store';
import { BrandLogo } from '../../components/BrandLogo';

export const Auth = () => {
  const { form, errors, loading, handleChange, handleSubmit } = useAuth();
  const { isDark } = useDarkMode();
  const { gymConfig } = useConfigStore();
  const appearance = normalizeAppearance(gymConfig.appearance);

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-cover bg-center px-6 py-10 font-body-md antialiased"
      style={{ backgroundImage: appearance.loginBackground ? `url(${appearance.loginBackground})` : undefined }}
    >
      {appearance.showLoginOverlay && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isDark
              ? `radial-gradient(circle at 50% 18%, color-mix(in srgb, ${appearance.primaryColor} 18%, transparent), transparent 32rem),
                 linear-gradient(135deg, rgba(5,8,13,.97), rgba(12,18,28,.94) 58%, color-mix(in srgb, ${appearance.secondaryColor} 55%, #06090e))`
              : `linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.82) 58%, color-mix(in srgb, ${appearance.primaryColor} 18%, #eef2f7))`,
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-md">
        <div
          className="overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl"
          style={{
            borderColor: isDark ? 'rgba(148,163,184,.22)' : 'rgba(148,163,184,.35)',
            background: isDark
              ? 'linear-gradient(145deg, rgba(28,35,46,.96), rgba(13,18,25,.97))'
              : 'rgba(255,255,255,.91)',
            boxShadow: isDark
              ? `0 30px 85px rgba(0,0,0,.58), 0 0 0 1px color-mix(in srgb, ${appearance.primaryColor} 10%, transparent)`
              : '0 30px 80px rgba(15,23,42,.18)',
          }}
        >
          <div className="px-8 pb-6 pt-10 text-center">
            <div
              className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-3xl border p-2 shadow-xl"
              style={{
                borderColor: `color-mix(in srgb, ${appearance.primaryColor} 45%, transparent)`,
                background: gymConfig.logo
                  ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(226,232,240,.94))'
                  : 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
              }}
            >
              <BrandLogo
                customLogo={gymConfig.logo}
                primaryColor={appearance.primaryColor}
                inkColor={isDark ? '#f4f7fb' : appearance.secondaryColor}
                alt={gymConfig.name}
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="font-headline-lg font-bold text-primary">{gymConfig.name}</h1>
            <p className="mt-3 text-sm font-bold text-on-surface">{appearance.loginHeadline}</p>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{appearance.loginSubtitle}</p>
          </div>

          <div className="px-8 pb-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-on-surface-variant">Correo electrónico</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required maxLength={254} autoComplete="email" className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3" />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-on-surface-variant">Contraseña</label>
                <input type="password" name="password" value={form.password} onChange={handleChange} required maxLength={128} autoComplete="current-password" className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3" />
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
              </div>
              {errors.general && <p className="text-center text-sm text-red-500">{errors.general}</p>}
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Cargando...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
};
