import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { applyAppearance, normalizeAppearance, type AppearanceConfig } from '../../config/appearance';
import { useConfigStore } from '../../store/config.store';
import { getApiError } from '../../utils/apiError';
import { BrandLogo } from '../BrandLogo';
import { useDarkMode } from '../../hooks/useDarkMode';

const presets = [
  ['Rojo energía', '#d60000', '#202020', '#ff3b30', '#f7f7f7'],
  ['Azul fuerza', '#155eef', '#172554', '#38bdf8', '#f4f7ff'],
  ['Verde rendimiento', '#087f5b', '#18392b', '#2dd4bf', '#f2fbf7'],
  ['Dorado premium', '#b7791f', '#221a10', '#f6c453', '#fbf8f1'],
  ['Morado élite', '#7c3aed', '#2e1065', '#c084fc', '#f7f3ff'],
  ['Naranja potencia', '#ea580c', '#431407', '#fb923c', '#fff7ed'],
  ['Turquesa fitness', '#0f766e', '#134e4a', '#2dd4bf', '#f0fdfa'],
  ['Rosa urbano', '#db2777', '#500724', '#f472b6', '#fdf2f8'],
  ['Negro neón', '#111827', '#020617', '#a3e635', '#f1f5f9'],
  ['Cian tecnológico', '#0369a1', '#082f49', '#22d3ee', '#f0f9ff'],
  ['Vino intenso', '#9f1239', '#4c0519', '#fb7185', '#fff1f2'],
  ['Oliva deportivo', '#4d7c0f', '#1a2e05', '#a3e635', '#f7fee7'],
] as const;

export function AppearanceSettings() {
  const { gymConfig, updateGymConfig, uploadAppearanceImage } = useConfigStore();
  const { isDark } = useDarkMode();
  const saved = useMemo(() => normalizeAppearance(gymConfig.appearance), [gymConfig.appearance]);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'login' | 'sidebar' | null>(null);
  const loginInput = useRef<HTMLInputElement>(null);
  const sidebarInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => applyAppearance(saved), [saved]);

  const update = <K extends keyof AppearanceConfig>(key: K, value: AppearanceConfig[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      applyAppearance(next);
      return next;
    });
  };

  const upload = async (file: File | undefined, target: 'login' | 'sidebar') => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return void toast.error('Usa JPG, PNG o WEBP');
    if (file.size > 5 * 1024 * 1024) return void toast.error('La imagen no puede superar 5 MB');
    setUploading(target);
    try {
      update(target === 'login' ? 'loginBackground' : 'sidebarBackground', await uploadAppearanceImage(file));
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo subir la imagen'));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateGymConfig({ appearance: draft });
      toast.success('Apariencia guardada y aplicada');
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo guardar la apariencia'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-on-surface">Apariencia y marca</h3>
          <p className="text-sm text-on-surface-variant">Colores, imágenes, animaciones y vista previa en vivo.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { const next = normalizeAppearance(); setDraft(next); applyAppearance(next); }} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold">Restablecer</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>

      <div className="grid gap-7 xl:grid-cols-[1fr_1.05fr]">
        <div className="space-y-6">
          <section>
            <Label>Paletas rápidas</Label>
            <div className="grid max-h-[360px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {presets.map(([name, primary, secondary, accent, background]) => (
                <button key={name} onClick={() => setDraft((current) => {
                  const next = { ...current, primaryColor: primary, secondaryColor: secondary, accentColor: accent, backgroundColor: background };
                  applyAppearance(next);
                  return next;
                })} className="appearance-preset-card group rounded-2xl border border-outline-variant bg-gradient-to-br from-white to-slate-50 p-3 text-left transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-3 flex h-10 overflow-hidden rounded-xl shadow-inner">{[primary, secondary, accent].map((color) => <span key={color} className="flex-1 transition-transform group-hover:scale-y-110" style={{ backgroundColor: color }} />)}</div>
                  <span className="text-xs font-bold">{name}</span>
                  <p className="mt-1 text-[10px] text-slate-400">{primary.toUpperCase()}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            {([
              ['primaryColor', 'Principal'], ['secondaryColor', 'Secundario'],
              ['accentColor', 'Acento'], ['backgroundColor', 'Fondo'],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-xs font-bold text-on-surface-variant">
                {label}
                <div className="appearance-color-field mt-2 flex items-center gap-2 rounded-xl border border-outline-variant p-2">
                  <input type="color" value={draft[key]} onChange={(event) => update(key, event.target.value)} className="h-9 w-12 cursor-pointer border-0 bg-transparent" />
                  <span className="font-mono">{draft[key]}</span>
                </div>
              </label>
            ))}
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <Select label="Sidebar" value={draft.sidebarStyle} onChange={(value) => update('sidebarStyle', value as AppearanceConfig['sidebarStyle'])} options={[['light', 'Claro'], ['dark', 'Oscuro'], ['brand', 'Marca']]} />
            <Select label="Animación" value={draft.animation} onChange={(value) => update('animation', value as AppearanceConfig['animation'])} options={[['none', 'Ninguna'], ['subtle', 'Sutil'], ['dynamic', 'Dinámica']]} />
            <Select label="Bordes" value={draft.radius} onChange={(value) => update('radius', value as AppearanceConfig['radius'])} options={[['compact', 'Compactos'], ['rounded', 'Redondeados'], ['soft', 'Suaves']]} />
          </section>

          <section className="space-y-4">
            <label className="block text-xs font-bold text-on-surface-variant">Título del login
              <input value={draft.loginHeadline} maxLength={100} onChange={(event) => update('loginHeadline', event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant p-3" />
            </label>
            <label className="block text-xs font-bold text-on-surface-variant">Texto del login
              <textarea value={draft.loginSubtitle} maxLength={180} onChange={(event) => update('loginSubtitle', event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-outline-variant p-3" />
            </label>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <ImageControl label="Fondo del login" image={draft.loginBackground} loading={uploading === 'login'} onUpload={() => loginInput.current?.click()} onRemove={() => update('loginBackground', null)} />
            <ImageControl label="Fondo del sidebar" image={draft.sidebarBackground} loading={uploading === 'sidebar'} onUpload={() => sidebarInput.current?.click()} onRemove={() => update('sidebarBackground', null)} />
            <input ref={loginInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0], 'login')} />
            <input ref={sidebarInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0], 'sidebar')} />
          </section>
        </div>

        <Preview appearance={draft} gymName={gymConfig.name} logo={gymConfig.logo} isDark={isDark} />
      </div>
    </div>
  );
}

function Preview({ appearance, gymName, logo, isDark }: { appearance: AppearanceConfig; gymName: string; logo?: string; isDark: boolean }) {
  const sidebarColor = isDark
    ? appearance.sidebarStyle === 'brand'
      ? `color-mix(in srgb, ${appearance.primaryColor} 58%, #0b1017)`
      : '#111720'
    : appearance.sidebarStyle === 'dark'
      ? '#0f172a'
      : appearance.sidebarStyle === 'brand'
        ? appearance.primaryColor
        : '#ffffff';
  const sidebarText = isDark || appearance.sidebarStyle !== 'light' ? '#ffffff' : '#334155';
  const logoInkColor = isDark || appearance.sidebarStyle !== 'light' ? '#ffffff' : appearance.secondaryColor;
  const previewBackground = isDark ? '#0c1016' : appearance.backgroundColor;
  const previewSurface = isDark ? '#171d26' : '#ffffff';
  const previewText = isDark ? '#f5f7fa' : '#111827';
  const previewMuted = isDark ? '#9aa7b8' : '#64748b';
  return (
    <div className="xl:sticky xl:top-24 xl:self-start">
      <Label>Vista previa</Label>
      <div className="appearance-preview overflow-hidden rounded-[var(--radius-24)] border border-outline-variant shadow-xl">
        <div className="grid min-h-[500px] grid-cols-[130px_1fr]">
          <div className="bg-cover bg-center p-4 text-xs" style={{ color: sidebarText, backgroundColor: sidebarColor, backgroundImage: appearance.sidebarBackground ? `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)),url(${appearance.sidebarBackground})` : undefined }}>
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border p-1"
              style={{
                borderColor: `color-mix(in srgb, ${appearance.primaryColor} 45%, transparent)`,
                background: logo
                  ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(226,232,240,.94))'
                  : appearance.sidebarStyle === 'light'
                    ? `${appearance.primaryColor}12`
                    : 'rgba(255,255,255,.09)',
              }}
            >
              <BrandLogo
                customLogo={logo}
                primaryColor={appearance.primaryColor}
                inkColor={logoInkColor}
                alt=""
                className="h-full w-full object-contain"
              />
            </div>
            <p className="mb-6 text-center font-black">{gymName}</p>
            {['Dashboard', 'Recepción', 'Inventario', 'Ajustes'].map((item, index) => <div key={item} className={`mb-2 rounded-lg px-2 py-2 ${index === 0 ? 'bg-white/20 font-bold' : ''}`}>{item}</div>)}
          </div>
          <div className="p-5" style={{ backgroundColor: previewBackground, color: previewText }}>
            <div className="mb-5 flex items-center justify-between rounded-xl p-3 shadow-sm" style={{ backgroundColor: previewSurface }}><b>Dashboard</b><span className="h-8 w-8 rounded-full" style={{ backgroundColor: appearance.primaryColor }} /></div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              {[['Miembros', '248'], ['Ingresos', '$42,500']].map(([label, value]) => <div key={label} className="rounded-[var(--radius-24)] p-4 shadow-sm" style={{ backgroundColor: previewSurface }}><p className="text-[10px]" style={{ color: previewMuted }}>{label}</p><p className="text-xl font-black" style={{ color: appearance.primaryColor }}>{value}</p></div>)}
            </div>
            <div className="rounded-[var(--radius-24)] p-4 shadow-sm" style={{ backgroundColor: previewSurface }}>
              <div className="mb-4 h-3 w-24 rounded" style={{ backgroundColor: appearance.secondaryColor }} />
              <div className="flex h-32 items-end gap-2">{[35, 60, 45, 80, 55, 95].map((height, index) => <span key={index} className="flex-1 rounded-t" style={{ height: `${height}%`, backgroundColor: index === 5 ? appearance.accentColor : appearance.primaryColor }} />)}</div>
            </div>
            <div className="mt-4 rounded-[var(--radius-24)] p-4 text-white" style={{ backgroundColor: appearance.primaryColor }}><b>{appearance.loginHeadline}</b><p className="mt-1 text-xs opacity-80">{appearance.loginSubtitle}</p></div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">Los cambios solo se publican al guardar.</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs font-black uppercase tracking-wider text-on-surface-variant">{children}</p>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-on-surface-variant">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant p-3">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function ImageControl({ label, image, loading, onUpload, onRemove }: { label: string; image: string | null; loading: boolean; onUpload: () => void; onRemove: () => void }) {
  return <div className="rounded-xl border border-outline-variant p-3"><div className="mb-3 h-24 rounded-lg bg-slate-100 bg-cover bg-center" style={{ backgroundImage: image ? `url(${image})` : undefined }} /><button onClick={onUpload} disabled={loading} className="w-full rounded-lg bg-slate-100 py-2 text-xs font-bold">{loading ? 'Subiendo...' : label}</button>{image && <button onClick={onRemove} className="mt-2 w-full text-xs font-bold text-red-600">Quitar</button>}</div>;
}
