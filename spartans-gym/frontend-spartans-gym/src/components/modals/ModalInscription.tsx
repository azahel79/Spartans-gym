import { useConfigStore } from "../../store/config.store";

type Props = {
  setIsModalOpen: (value: boolean) => void
  handleSubmit: (e: React.FormEvent) => void
  formData: any
  setFormData: any
  selectedPlan: string
  setSelectedPlan: any
  paymentMethod: string
  setPaymentMethod: any
  currentAmount: number
}

const ModalInscription = ({ 
  setIsModalOpen, 
  handleSubmit, 
  formData, 
  setFormData, 
  selectedPlan, 
  setSelectedPlan, 
  paymentMethod, 
  setPaymentMethod, 
  currentAmount 
}: Props) => {
  const { plans } = useConfigStore();

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[28px] p-5 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
          <header className="flex justify-between items-start gap-4 mb-6">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Inscripción de Nuevo Socio</h3>
              <p className="text-body-md text-on-surface-variant">Completa el perfil y procesa el primer pago.</p>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100">
              <span className="material-symbols-outlined text-outline">close</span>
            </button>
          </header>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-label-sm font-black text-primary uppercase tracking-widest border-b border-slate-100 pb-2">Información Personal</p>
              <div className="space-y-1">
                <label className="text-label-sm font-bold text-on-surface-variant ml-1">Nombre(s)</label>
                <input 
                  type="text" required
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-label-sm font-bold text-on-surface-variant ml-1">Apellidos</label>
                <input 
                  type="text" required
                  value={formData.apellidos}
                  onChange={(e) => setFormData({...formData, apellidos: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm font-bold text-on-surface-variant ml-1">Género</label>
                  <select 
                    value={formData.genero}
                    onChange={(e) => setFormData({...formData, genero: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-label-sm font-bold text-on-surface-variant ml-1">Teléfono</label>
                  <input 
                    type="tel" required
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50 p-6 rounded-[24px] border border-slate-200">
              <p className="text-label-sm font-black text-primary uppercase tracking-widest border-b border-slate-200 pb-2">Plan y Pago</p>
              <div className="space-y-1">
                <label className="text-label-sm font-bold text-on-surface-variant ml-1">Seleccionar Plan</label>
                <select 
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-primary"
                >
                  {plans.length === 0 ? (
                    <>
                      <option value="Mensual">Mensual</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Semestral">Semestral</option>
                      <option value="Anual">Anual</option>
                    </>
                  ) : (
                    plans.map((plan) => (
                      <option key={plan.id} value={plan.name}>
                        {plan.name} - ${plan.price.toLocaleString('es-MX')}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex flex-col items-center py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <p className="text-label-sm text-outline uppercase font-bold">Total a Pagar</p>
                <p className="text-4xl font-display text-primary font-black">${currentAmount.toLocaleString('es-MX')}.00</p>
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-bold text-on-surface-variant ml-1">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setPaymentMethod('Efectivo')}
                    className={`py-3 rounded-xl font-bold border-2 transition-all ${paymentMethod === 'Efectivo' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-outline'}`}
                  >
                     Efectivo
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPaymentMethod('Tarjeta')}
                    className={`py-3 rounded-xl font-bold border-2 transition-all ${paymentMethod === 'Tarjeta' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-outline'}`}
                  >
                     Tarjeta
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 mt-4 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                Registrar y Pagar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default ModalInscription
