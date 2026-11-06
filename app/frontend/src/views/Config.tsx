// views/Config.tsx (Completamente conectado al backend)
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { isAdminRole, useAuthStore, type UserRole } from "../store/auth.store";
import { useConfigStore, Plan } from "../store/config.store";
import { useNotificationStore, type NotificationKind, type NotificationStatus, type WhatsAppSessionStatus } from "../store/notification.store";
import { toast } from 'react-toastify';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AppearanceSettings } from '../components/config/AppearanceSettings';
import { getApiError } from '../utils/apiError';

type ConfigTab = 'gymnasio' | 'apariencia' | 'planes' | 'roles' | 'notificaciones' | 'pagos' | 'seguridad';

const notificationKindLabel: Record<NotificationKind, string> = {
  WELCOME: 'Bienvenida',
  EXPIRY_REMINDER: 'Recordatorio',
  EXPIRED: 'Vencida',
  RENEWAL: 'Renovacion',
};

const notificationStatusLabel: Record<NotificationStatus, string> = {
  PENDING: 'Pendiente',
  SENT: 'Enviada',
  FAILED: 'Fallida',
  SKIPPED: 'Omitida',
};

const notificationStatusClass: Record<NotificationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-slate-100 text-slate-600',
};

const whatsAppSessionLabel: Record<WhatsAppSessionStatus, string> = {
  disabled: 'Desactivado',
  idle: 'En espera',
  initializing: 'Iniciando',
  qr: 'Escanea el QR',
  authenticated: 'Autenticando',
  ready: 'Conectado',
  disconnected: 'Desconectado',
  failed: 'Error',
};

const whatsAppSessionClass: Record<WhatsAppSessionStatus, string> = {
  disabled: 'bg-slate-100 text-slate-600',
  idle: 'bg-slate-100 text-slate-600',
  initializing: 'bg-amber-100 text-amber-700',
  qr: 'bg-blue-100 text-blue-700',
  authenticated: 'bg-blue-100 text-blue-700',
  ready: 'bg-emerald-100 text-emerald-700',
  disconnected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

export const Config = () => {
  const { user } = useAuthStore();
  const isAdmin = isAdminRole(user?.role);
  
  const { 
    users, 
    plans,
    gymConfig, 
    isLoading, 
    fetchUsers, 
    fetchPlans,
    createUser, 
    updateUserRole, 
    deleteUser,
    addPlan,
    updatePlan,
    deletePlan,
    updateGymConfig,
    fetchGymConfig,
    uploadLogo
  } = useConfigStore();
  const {
    notifications,
    whatsAppSession,
    isLoading: isNotificationLoading,
    fetchNotifications,
    fetchWhatsAppSession,
    restartWhatsAppSession,
    retryNotification,
    scanNotifications,
    testWhatsAppConnection,
  } = useNotificationStore();
  
  const [activeTab, setActiveTab] = useState<ConfigTab>('gymnasio');
  const [whatsAppTestPhone, setWhatsAppTestPhone] = useState('');

  useEffect(() => {
    if (activeTab !== 'notificaciones' || !isAdmin) return;

    void fetchNotifications().catch(() => toast.error('Error al cargar notificaciones'));
    void fetchWhatsAppSession().catch(() => toast.error('Error al cargar sesión de WhatsApp'));

    const sessionTimer = window.setInterval(() => {
      void fetchWhatsAppSession().catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(sessionTimer);
  }, [activeTab, fetchNotifications, fetchWhatsAppSession, isAdmin]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para nuevo usuario
  const [newUser, setNewUser] = useState<{ email: string; password: string; role: UserRole }>({ email: '', password: '', role: 'recepcionista' });
  
  // Estados para logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para planes
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price: 0,
    period: 'Mes',
  });
  const [userToDelete, setUserToDelete] = useState<{ id: number; email: string } | null>(null);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Estado para configuracion del gimnasio
  const [gymForm, setGymForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  // Cargar datos al montar
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchGymConfig();
      fetchPlans();
    }
  }, [isAdmin, fetchUsers, fetchGymConfig, fetchPlans]);

  // Sincronizar gymForm con gymConfig
  useEffect(() => {
    if (gymConfig) {
      // This form intentionally mirrors asynchronously loaded server configuration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGymForm({
        name: gymConfig.name || '',
        email: gymConfig.email || '',
        phone: gymConfig.phone || '',
        address: gymConfig.address || '',
      });
      if (gymConfig.logo) {
        setLogoPreview(gymConfig.logo);
      }
    }
  }, [gymConfig]);

  // Manejar seleccion de logo
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El logo no debe superar los 5MB', {
          style: { backgroundColor: '#000000' },
          theme: "colored",
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imagenes', {
          style: { backgroundColor: '#000000' },
          theme: "colored",
        });
        return;
      }
      
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Guardar configuracion del gimnasio
  const handleSaveGymConfig = useCallback(async () => {
    const cleanGymForm = {
      name: gymForm.name.trim(),
      email: gymForm.email.trim().toLowerCase(),
      phone: gymForm.phone.trim(),
      address: gymForm.address.trim(),
    };
    if (cleanGymForm.name.length < 2) return void toast.warning('Ingresa un nombre válido');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanGymForm.email)) return void toast.warning('Ingresa un correo válido');
    if (!/^[0-9+\-()\s]{7,20}$/.test(cleanGymForm.phone)) return void toast.warning('Ingresa un teléfono válido');
    if (cleanGymForm.address.length < 3) return void toast.warning('Ingresa una dirección vÃ¡lida');
    setIsSaving(true);
    try {
      let logoUrl = gymConfig.logo;
      
      if (logoFile) {
        setIsUploading(true);
        logoUrl = await uploadLogo(logoFile);
        setIsUploading(false);
      }
      
      await updateGymConfig({
        ...cleanGymForm,
        logo: logoUrl,
      });
      
      setLogoFile(null);
      toast.success('Configuración guardada correctamente', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    } catch {
      toast.error('Error al guardar configuracion', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    } finally {
      setIsSaving(false);
    }
  }, [gymForm, logoFile, uploadLogo, updateGymConfig, gymConfig.logo]);

  // Eliminar logo
  const handleRemoveLogo = useCallback(async () => {
    setLogoPreview(null);
    setLogoFile(null);
    await updateGymConfig({ logo: '' });
    toast.success('Logo eliminado', {
      style: { backgroundColor: '#000000' },
      theme: "colored",
    });
  }, [updateGymConfig]);

  // Crear nuevo usuario
  const handleCreateUser = useCallback(async () => {
    const email = newUser.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.warning('Ingresa un correo válido', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
      return;
    }
    if (newUser.password.length < 10 || !/[a-z]/.test(newUser.password) || !/[A-Z]/.test(newUser.password) || !/\d/.test(newUser.password)) {
      toast.warning('La contraseÃ±a debe tener 10 caracteres, mayúscula, minúscula y número');
      return;
    }
    
    try {
      await createUser(email, newUser.password, newUser.role);
      setNewUser({ email: '', password: '', role: 'recepcionista' });
      toast.success('Usuario creado correctamente', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    } catch {
      toast.error('Error al crear usuario', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    }
  }, [newUser, createUser]);

  // Cambiar rol de usuario
  const handleChangeRole = useCallback(async (userId: number, currentRole: UserRole) => {
    const order: UserRole[] = ['recepcionista', 'entrenador', 'admin'];
    const newRole = order[(order.indexOf(currentRole) + 1) % order.length];
    try {
      await updateUserRole(userId, newRole);
      toast.success(`Rol actualizado a ${newRole}`, {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    } catch {
      toast.error('Error al actualizar rol', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    }
  }, [updateUserRole]);

  const requestDeleteUser = useCallback((userId: number, userEmail: string) => {
    if (userEmail === user?.email) {
      toast.warning('No puedes eliminarte a ti mismo', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
      return;
    }

    setUserToDelete({ id: userId, email: userEmail });
  }, [user]);

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) return;

    try {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
      toast.success('Usuario eliminado', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    } catch {
      toast.error('Error al eliminar usuario', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
    }
  }, [deleteUser, userToDelete]);
  // Guardar plan
  const handleSavePlan = useCallback(async () => {
    const cleanName = planForm.name.trim();
    const cleanPeriod = planForm.period.trim();
    if (cleanName.length < 2 || !Number.isFinite(planForm.price) || planForm.price <= 0 || cleanPeriod.length < 2) {
      toast.warning('Completa todos los campos', {
        style: { backgroundColor: '#000000' },
        theme: "colored",
      });
      return;
    }

    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, {
          name: cleanName,
          price: planForm.price,
          period: cleanPeriod,
        });
        toast.success('Plan actualizado correctamente');
      } else {
        await addPlan({
          name: cleanName,
          price: planForm.price,
          period: cleanPeriod,
          color: 'bg-primary',
          isActive: true,
        });
        toast.success('Plan creado correctamente');
      }
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      setPlanForm({ name: '', price: 0, period: 'Mes' });
      fetchPlans();
    } catch {
      toast.error('Error al guardar plan');
    }
  }, [planForm, editingPlan, addPlan, updatePlan, fetchPlans]);

  const handleEditPlan = useCallback((plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      price: plan.price,
      period: plan.period,
    });
    setIsPlanModalOpen(true);
  }, []);

  const requestDeletePlan = useCallback((planId: string, planName: string) => {
    setPlanToDelete({ id: planId, name: planName });
  }, []);

  const handleDeletePlan = useCallback(async () => {
    if (!planToDelete) return;

    try {
      await deletePlan(planToDelete.id);
      setPlanToDelete(null);
      toast.success('Plan eliminado correctamente');
      fetchPlans();
    } catch {
      toast.error('Error al eliminar plan');
    }
  }, [deletePlan, fetchPlans, planToDelete]);

  const notificationStats = {
    total: notifications.length,
    sent: notifications.filter((item) => item.status === 'SENT').length,
    pending: notifications.filter((item) => item.status === 'PENDING').length,
    failed: notifications.filter((item) => item.status === 'FAILED').length,
  };

  const handleRefreshNotifications = useCallback(async () => {
    try {
      await fetchNotifications();
      toast.success('Notificaciones actualizadas');
    } catch {
      toast.error('Error al actualizar notificaciones');
    }
  }, [fetchNotifications]);

  const handleRestartWhatsAppSession = useCallback(async () => {
    try {
      await restartWhatsAppSession();
      await fetchWhatsAppSession();
      toast.success('Sesión de WhatsApp reiniciada');
    } catch (error: unknown) {
      toast.error(getApiError(error, 'Error al reiniciar WhatsApp'));
    }
  }, [fetchWhatsAppSession, restartWhatsAppSession]);

  const handleScanNotifications = useCallback(async () => {
    try {
      await scanNotifications();
      toast.success('RevisiÃ³n de vencimientos completada');
    } catch {
      toast.error('Error al revisar vencimientos');
    }
  }, [scanNotifications]);

  const handleRetryNotification = useCallback(async (id: number) => {
    try {
      await retryNotification(id);
      toast.success('NotificaciÃ³n reenviada');
    } catch {
      toast.error('Error al reintentar notificaciÃ³n');
    }
  }, [retryNotification]);

  const handleTestWhatsAppConnection = useCallback(async () => {
    const phone = whatsAppTestPhone.trim();
    if (!phone) {
      toast.warning('Ingresa un numero para probar WhatsApp');
      return;
    }

    try {
      const result = await testWhatsAppConnection(phone);
      toast.success(`WhatsApp conectado. Mensaje enviado a ${result.recipient}`);
    } catch (error: unknown) {
      toast.error(getApiError(error, 'No se pudo enviar el mensaje de prueba'));
    }
  }, [fetchNotifications, testWhatsAppConnection, whatsAppTestPhone]);
  const tabs = [
    { id: 'gymnasio', label: 'Detalles del Gimnasio', icon: 'business', adminOnly: false },
    { id: 'apariencia', label: 'Apariencia y Marca', icon: 'palette', adminOnly: true },
    { id: 'planes', label: 'Planes y Membresías', icon: 'card_membership', adminOnly: false },
    { id: 'roles', label: 'Roles y Permisos', icon: 'group', adminOnly: true },
    { id: 'notificaciones', label: 'Notificaciones', icon: 'notifications_active', adminOnly: false },
    { id: 'pagos', label: 'Pagos y Facturación', icon: 'payments', adminOnly: false },
    { id: 'seguridad', label: 'Seguridad', icon: 'security', adminOnly: true },
  ] as const;

  const visibleTabs = tabs.filter(tab => isAdmin || !tab.adminOnly);

  return (
    <>
    <main className="pt-20 md:pt-24 min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-0">
        <header className="mb-stack-lg">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 font-bold">Configuración</h2>
          <p className="font-body-lg text-on-surface-variant">
            Gestiona los parámetros generales de tu gimnasio, planes y permisos de usuario.
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-stack-lg">
          <nav className="config-tabs-nav lg:w-64 shrink-0 flex lg:block gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0 lg:space-y-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`config-tab-button min-w-max lg:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  activeTab === tab.id
                    ? 'config-tab-active bg-white border border-outline-variant text-primary shadow-sm font-semibold'
                    : 'config-tab-idle text-on-surface-variant hover:bg-white/50 font-medium'
                }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0 space-y-stack-md">
            
            {/* ==================== GIMNASIO ==================== */}
            {activeTab === 'gymnasio' && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <h3 className="font-title-lg text-title-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">store</span>
                    Identidad de la Marca
                  </h3>
                  <button
                    onClick={handleSaveGymConfig}
                    disabled={isSaving || isUploading}
                    className="brand-hover bg-primary text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {isSaving || isUploading ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
                
                {/* Logo */}
                <div className="mb-6 pb-4 border-b border-outline-variant/30">
                  <label className="font-label-lg block text-on-surface-variant mb-3">
                    Logo del Gimnasio
                  </label>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-outline-variant overflow-hidden flex items-center justify-center">
                        {logoPreview ? (
                          <img 
                            src={logoPreview} 
                            alt="Logo preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-slate-400">
                            fitness_center
                          </span>
                        )}
                      </div>
                      {logoPreview && (
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        ref={logoInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoChange}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">upload</span>
                        {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      <p className="text-xs text-slate-400">
                        Formatos: JPG, PNG, WEBP. Max. 5MB
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Datos del gimnasio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="font-label-lg block text-on-surface-variant">
                      Nombre Comercial
                    </label>
                    <input
                      className="w-full bg-white border border-outline-variant rounded-xl p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      type="text"
                      value={gymForm.name}
                      onChange={(e) => setGymForm({ ...gymForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label-lg block text-on-surface-variant">
                      Correo ElectrÃ³nico
                    </label>
                    <input
                      className="w-full bg-white border border-outline-variant rounded-xl p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      type="email"
                      value={gymForm.email}
                      onChange={(e) => setGymForm({ ...gymForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label-lg block text-on-surface-variant">
                      TelÃ©fono
                    </label>
                    <input
                      className="w-full bg-white border border-outline-variant rounded-xl p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      type="tel"
                      value={gymForm.phone}
                      onChange={(e) => setGymForm({ ...gymForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label-lg block text-on-surface-variant">
                      DirecciÃ³n
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">location_on</span>
                      <input
                        className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        type="text"
                        value={gymForm.address}
                        onChange={(e) => setGymForm({ ...gymForm, address: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PLANES Y MEMBRESIAS ==================== */}
            {activeTab === 'apariencia' && isAdmin && <AppearanceSettings />}

            {activeTab === 'planes' && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">
                      Planes y Membresías
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      Gestiona los planes de membresÃ­a disponibles para los clientes.
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditingPlan(null);
                        setPlanForm({ name: '', price: 0, period: 'Mes' });
                        setIsPlanModalOpen(true);
                      }}
                      className="brand-hover bg-primary text-white px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Nuevo Plan
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.length === 0 ? (
                    <div className="md:col-span-2 text-center py-12 text-slate-400">
                      <span className="material-symbols-outlined text-5xl mb-3">card_membership</span>
                      <p>No hay planes creados</p>
                      <p className="text-xs">Crea tu primer plan usando el botÃ³n "Nuevo Plan"</p>
                    </div>
                  ) : (
                    plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-gradient-to-br from-white to-slate-50/50 p-5 transition-all hover:shadow-md"
                      >
                        <div className={`absolute top-0 left-0 w-1 h-full ${plan.color}`} />
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-lg text-on-surface">{plan.name}</h4>
                            <p className="text-sm text-on-surface-variant">Periodo: {plan.period}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-primary">
                              ${plan.price.toLocaleString('es-MX')}
                            </p>
                            <p className="text-xs text-on-surface-variant">MXN</p>
                          </div>
                        </div>
                        
                        {isAdmin && (
                          <div className="flex gap-2 mt-4 pt-3 border-t border-outline-variant/20">
                            <button
                              onClick={() => handleEditPlan(plan)}
                              className="flex-1 py-2 text-primary font-semibold text-sm hover:bg-primary/10 rounded-lg transition flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Editar
                            </button>
                            <button
                              onClick={() => requestDeletePlan(plan.id, plan.name)}
                              className="flex-1 py-2 text-red-500 font-semibold text-sm hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="config-info-card mt-6 p-4 bg-slate-50 rounded-xl border border-outline-variant/30">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Como se calculan los precios?</p>
                      <p className="text-xs text-on-surface-variant">
                        Los planes se obtienen automaticamente de los clientes registrados. 
                        Puedes editar o crear nuevos planes segun tus necesidades.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal para crear/editar plan */}
            {isPlanModalOpen && isAdmin && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-headline-sm text-headline-sm">
                      {editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
                    </h3>
                    <button
                      onClick={() => {
                        setIsPlanModalOpen(false);
                        setEditingPlan(null);
                        setPlanForm({ name: '', price: 0, period: 'Mes' });
                      }}
                      className="p-1 rounded-full hover:bg-slate-100"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-label-sm font-semibold text-on-surface-variant block mb-1">
                        Nombre del Plan
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition"
                        placeholder="Ej: Plan Premium"
                        value={planForm.name}
                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-label-sm font-semibold text-on-surface-variant block mb-1">
                        Precio (MXN)
                      </label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition"
                        placeholder="0.00"
                        value={planForm.price}
                        onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="text-label-sm font-semibold text-on-surface-variant block mb-1">
                        Periodo
                      </label>
                      <select
                        className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition"
                        value={planForm.period}
                        onChange={(e) => setPlanForm({ ...planForm, period: e.target.value })}
                      >
                        <option value="Mes">Mensual</option>
                        <option value="3 Meses">Trimestral (3 meses)</option>
                        <option value="6 Meses">Semestral (6 meses)</option>
                        <option value="Ano">Anual (12 meses)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setIsPlanModalOpen(false);
                        setEditingPlan(null);
                        setPlanForm({ name: '', price: 0, period: 'Mes' });
                      }}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePlan}
                      className="brand-hover flex-1 py-3 bg-primary text-white rounded-xl font-semibold transition"
                    >
                      {editingPlan ? 'Actualizar' : 'Crear Plan'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== ROLES Y PERMISOS ==================== */}
            {activeTab === 'roles' && isAdmin && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                  Roles y Permisos
                </h3>
                <p className="text-body-md text-on-surface-variant mb-6">
                  Gestiona los usuarios del sistema y sus niveles de acceso.
                </p>
                
                <div className="mb-8">
                  <h4 className="font-title-md text-title-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">group</span>
                    Usuarios del Sistema
                  </h4>
                  <div className="space-y-2">
                    {users.length === 0 ? (
                      <div className="text-center py-8 text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
                        <p>No hay usuarios registrados</p>
                      </div>
                    ) : (
                      users.map((u) => (
                        <div key={u.id} className="config-user-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-xl border border-outline-variant/30 transition-all hover:shadow-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`config-user-avatar w-10 h-10 rounded-full flex items-center justify-center ${
                              u.role === 'admin'
                                ? 'config-user-avatar-admin bg-indigo-100 text-indigo-600'
                                : u.role === 'entrenador'
                                  ? 'config-user-avatar-trainer bg-orange-100 text-orange-600'
                                  : 'config-user-avatar-staff bg-emerald-100 text-emerald-600'
                            }`}>
                              <span className="material-symbols-outlined text-xl">
                                {u.role === 'admin' ? 'admin_panel_settings' : u.role === 'entrenador' ? 'fitness_center' : 'badge'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-on-surface break-all">{u.email}</p>
                              <p className="text-xs text-on-surface-variant">ID: {u.id} - Creado: {new Date(u.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`config-role-badge px-3 py-1 rounded-full text-xs font-bold ${
                              u.role === 'admin'
                                ? 'config-role-badge-admin bg-indigo-100 text-indigo-700'
                                : u.role === 'entrenador'
                                  ? 'config-role-badge-trainer bg-orange-100 text-orange-700'
                                  : 'config-role-badge-staff bg-emerald-100 text-emerald-700'
                            }`}>
                              {u.role === 'admin' ? 'Administrador' : u.role === 'entrenador' ? 'Entrenador' : 'Recepcionista'}
                            </span>
                            {u.email !== user?.email && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleChangeRole(u.id, u.role)}
                                  className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                                  title="Cambiar Rol"
                                >
                                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                </button>
                                <button
                                  onClick={() => requestDeleteUser(u.id, u.email)}
                                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"
                                  title="Eliminar Usuario"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-outline-variant/30 pt-6">
                  <h4 className="font-title-md text-title-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">person_add</span>
                    Agregar Nuevo Usuario
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-label-sm font-semibold text-on-surface-variant ml-1">
                        Correo ElectrÃ³nico
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                          mail
                        </span>
                        <input
                          type="email"
                          placeholder="usuario@ejemplo.com"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-xl text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-label-sm font-semibold text-on-surface-variant ml-1">
                        Contraseña
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                          lock
                        </span>
                        <input
                          type="password"
                          placeholder="********"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-xl text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-label-sm font-semibold text-on-surface-variant ml-1">
                        Rol
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                          badge
                        </span>
                        <select
                          className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-xl text-body-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                        >
                          <option value="recepcionista">Recepcionista</option>
                          <option value="entrenador">Entrenador</option>
                          <option value="admin">Administrador</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleCreateUser}
                    disabled={isLoading}
                    className="brand-hover mt-6 w-full py-3 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        Creando usuario...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">add_circle</span>
                        Crear Usuario
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ==================== NOTIFICACIONES ==================== */}
            {activeTab === 'notificaciones' && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">notifications_active</span>
                      WhatsApp automático demo
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      Mensajes de bienvenida, renovaciones y vencimientos usando WhatsApp Web para demostración.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleRefreshNotifications}
                      disabled={isNotificationLoading}
                      className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      Actualizar
                    </button>
                    <button
                      onClick={handleRestartWhatsAppSession}
                      disabled={isNotificationLoading}
                      className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">qr_code_2</span>
                      Reiniciar QR
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleScanNotifications}
                        disabled={isNotificationLoading}
                        className="brand-hover px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">manage_search</span>
                        Revisar vencimientos
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                  <div className="rounded-xl border border-outline-variant bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-on-surface-variant">Proveedor activo</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                            {whatsAppSession?.provider === 'webjs' ? 'whatsapp-web.js' : 'WhatsApp Business'}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${whatsAppSessionClass[whatsAppSession?.status || 'idle']}`}>
                            {whatsAppSessionLabel[whatsAppSession?.status || 'idle']}
                          </span>
                        </div>
                      </div>
                      {whatsAppSession?.connectedAt && (
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-black uppercase text-on-surface-variant">Conectado desde</p>
                          <p className="mt-1 text-sm font-semibold text-on-surface">
                            {new Date(whatsAppSession.connectedAt).toLocaleString('es-MX')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-bold text-emerald-900">Modo demo para presentación</p>
                      <p className="mt-1 text-sm text-emerald-900/80">
                        Este modo usa una sesión de WhatsApp Web local para demostrar el flujo sin activar cobros de Meta. La integración oficial de WhatsApp Business queda conservada para producción.
                      </p>
                    </div>

                    {whatsAppSession?.lastError && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-xs font-black uppercase text-red-700">Último error</p>
                        <p className="mt-1 text-sm text-red-700 break-words">{whatsAppSession.lastError}</p>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="text-xs font-black uppercase text-on-surface-variant">Número para prueba</label>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="tel"
                          value={whatsAppTestPhone}
                          onChange={(event) => setWhatsAppTestPhone(event.target.value)}
                          placeholder="Ej. 2288607516 o +522288607516"
                          className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={handleTestWhatsAppConnection}
                          disabled={isNotificationLoading || whatsAppSession?.status !== 'ready'}
                          className="brand-hover inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">send</span>
                          Enviar prueba
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Primero escanea el QR. Cuando el estado diga Conectado, podrás mandar pruebas y mensajes automáticos.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-outline-variant bg-white p-4 text-center">
                    <p className="text-xs font-black uppercase text-on-surface-variant">Vinculación WhatsApp Web</p>
                    {whatsAppSession?.qrCodeDataUrl ? (
                      <div className="mt-3">
                        <img
                          src={whatsAppSession.qrCodeDataUrl}
                          alt="QR para vincular WhatsApp Web"
                          className="mx-auto h-64 w-64 rounded-xl border border-outline-variant bg-white p-2"
                        />
                        <p className="mt-3 text-sm text-on-surface-variant">
                          Escanea este código desde WhatsApp: Dispositivos vinculados, Vincular dispositivo.
                        </p>
                      </div>
                    ) : whatsAppSession?.status === 'ready' ? (
                      <div className="mt-8 rounded-xl bg-emerald-50 p-6 text-emerald-800">
                        <span className="material-symbols-outlined text-5xl">check_circle</span>
                        <p className="mt-2 text-sm font-bold">WhatsApp Web conectado</p>
                        <p className="mt-1 text-xs">La demo ya puede enviar mensajes.</p>
                      </div>
                    ) : (
                      <div className="mt-8 rounded-xl bg-slate-50 p-6 text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin text-5xl text-primary">progress_activity</span>
                        <p className="mt-2 text-sm font-bold">Preparando sesión</p>
                        <p className="mt-1 text-xs">Si el QR tarda, usa Reiniciar QR.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Total', value: notificationStats.total, icon: 'list_alt' },
                    { label: 'Enviadas', value: notificationStats.sent, icon: 'check_circle' },
                    { label: 'Pendientes', value: notificationStats.pending, icon: 'schedule' },
                    { label: 'Fallidas', value: notificationStats.failed, icon: 'error' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-outline-variant bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-on-surface-variant uppercase">{item.label}</span>
                        <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                      </div>
                      <p className="mt-2 text-2xl font-black text-on-surface">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-xl border border-outline-variant">
                  <div className="hidden md:grid grid-cols-[1.1fr_.9fr_.8fr_.8fr_.9fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-on-surface-variant">
                    <span>Cliente</span>
                    <span>Tipo</span>
                    <span>Estado</span>
                    <span>Fecha</span>
                    <span className="text-right">Acciones</span>
                  </div>

                  {isNotificationLoading && notifications.length === 0 ? (
                    <div className="p-8 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                      <p className="mt-2 text-sm font-semibold">Cargando notificaciones...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl mb-2">mark_chat_unread</span>
                      <p className="text-sm font-semibold">Aún no hay notificaciones registradas</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-outline-variant">
                      {notifications.map((notification) => {
                        const clientName = notification.client
                          ? `${notification.client.nombre} ${notification.client.apellidos}`.trim()
                          : notification.clientId;
                        const displayDate = notification.referenceDate || notification.createdAt;
                        return (
                          <div key={notification.id} className="grid grid-cols-1 md:grid-cols-[1.1fr_.9fr_.8fr_.8fr_.9fr] gap-3 px-4 py-4 text-sm items-center">
                            <div className="min-w-0">
                              <p className="font-bold text-on-surface truncate">{clientName}</p>
                              <p className="text-xs text-on-surface-variant truncate">{notification.recipient}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-on-surface">{notificationKindLabel[notification.kind]}</p>
                              <p className="text-xs text-on-surface-variant">{notification.templateName}</p>
                            </div>
                            <div>
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${notificationStatusClass[notification.status]}`}>
                                {notificationStatusLabel[notification.status]}
                              </span>
                              {notification.attempts > 0 && (
                                <p className="mt-1 text-[11px] text-on-surface-variant">Intentos: {notification.attempts}</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-on-surface">{new Date(displayDate).toLocaleDateString('es-MX')}</p>
                              {notification.daysBefore ? (
                                <p className="text-xs text-on-surface-variant">{notification.daysBefore} días antes</p>
                              ) : null}
                            </div>
                            <div className="flex flex-col items-start gap-2 md:items-end">
                              {notification.status === 'FAILED' && (
                                <button
                                  onClick={() => handleRetryNotification(notification.id)}
                                  disabled={isNotificationLoading || whatsAppSession?.status !== 'ready'}
                                  className="px-3 py-2 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                                  Reintentar
                                </button>
                              )}
                              {notification.error && (
                                <span className="max-w-64 text-xs text-red-600 break-words" title={notification.error}>
                                  {notification.error}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== PAGOS ==================== */}
            {activeTab === 'pagos' && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
                <div className="text-center py-12 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-3">payments</span>
                  <h3 className="font-title-lg text-title-lg mb-2">MÃ³dulo en desarrollo</h3>
                  <p className="text-body-md">Próximamente: Configuración de pagos y facturaciÃ³n</p>
                </div>
              </div>
            )}

            {/* ==================== SEGURIDAD ==================== */}
            {activeTab === 'seguridad' && isAdmin && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                  Seguridad
                </h3>
                <p className="text-body-md text-on-surface-variant mb-6">
                  Configuración avanzada de seguridad del sistema.
                </p>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-semibold">Cambiar Contraseña</p>
                      <p className="text-xs text-slate-500">Actualiza tu contraseÃ±a de acceso</p>
                    </div>
                    <button className="brand-hover px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold transition">
                      Cambiar
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-semibold">Sesiones Activas</p>
                      <p className="text-xs text-slate-500">Gestiona dispositivos conectados</p>
                    </div>
                    <button className="px-4 py-2 border border-red-500 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition">
                      Cerrar todas
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    <ConfirmDialog
      open={Boolean(userToDelete)}
      title="Eliminar usuario"
      message={`Se eliminara "${userToDelete?.email || ''}" del sistema. Esta accion no se puede deshacer.`}
      confirmLabel="Eliminar"
      isLoading={isLoading}
      onCancel={() => setUserToDelete(null)}
      onConfirm={handleDeleteUser}
    />
    <ConfirmDialog
      open={Boolean(planToDelete)}
      title="Eliminar plan"
      message={`Se desactivara el plan "${planToDelete?.name || ''}". Los registros existentes no se modifican.`}
      confirmLabel="Eliminar"
      isLoading={isLoading}
      onCancel={() => setPlanToDelete(null)}
      onConfirm={handleDeletePlan}
    />
    </>
  );
};











