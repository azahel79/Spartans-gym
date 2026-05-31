import { useAuth } from "../../hooks/auth/useAuth";
import logo from "../../assets/logo.png";
export const Auth = () => {
  const { form, errors, loading, handleChange, handleSubmit } = useAuth();
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-10 font-body-md antialiased relative overflow-hidden">

      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        <div className="bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/60 rounded-3xl shadow-xl overflow-hidden">

          {/* HEADER */}
          <div className="px-8 pt-10 pb-6 text-center">
            
            <img src={logo} alt="Logo" className="w-24 h-24 mx-auto mb-4" />

            <h1 className="font-headline-lg text-primary  font-bold">
              SPARTAN'S <span  className="text-black">
                GYM
              </span>
            </h1>

            <p className="text-on-surface-variant mt-2 text-sm">
              Gestión de alto rendimiento para nuetro gym
            </p>
          </div>

          {/* FORM */}
          <div className="px-8 pb-8">
            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* EMAIL */}
              <div className="space-y-2">
                <label className="text-sm text-on-surface-variant">
                  Correo electrónico
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full pl-4 pr-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant"
                />

                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              {/* PASSWORD */}
              <div className="space-y-2">
                <label className="text-sm text-on-surface-variant">
                  Contraseña
                </label>

                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full pl-4 pr-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant"
                />

                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password}</p>
                )}
              </div>

              {/* ERROR GENERAL */}
              {errors.general && (
                <p className="text-sm text-red-500 text-center">
                  {errors.general}
                </p>
              )}

              {/* BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                  bg-primary text-white
                  ${loading ? "opacity-60 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.98]"}`}
              >
                {loading ? "Cargando..." : "Iniciar sesión"}
              </button>

            </form>
          </div>
        </div>

      </div>
    </main>
  );
};