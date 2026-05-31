import React from 'react'


type Props = {
  setIsRenewModalOpen: (value: boolean) => void
  handleRenewSubmit: (e: React.FormEvent) => void
  selectedClient: any
  selectedPlan: string
  setSelectedPlan: any
  currentAmount: number
  paymentMethod: string
  setPaymentMethod: any
}

const ModalRenew = ({ setIsRenewModalOpen, handleRenewSubmit, selectedClient, selectedPlan, setSelectedPlan, currentAmount, paymentMethod, setPaymentMethod }: Props) => {
  return (
     <>
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[32px] shadow-2xl flex flex-col">
            {/* Header unificado */}
            <header className="px-8 pt-8 pb-4 flex justify-between items-start">
                <div>
                    <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">
                        Proceso de Cobro
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Renovación de Plan</h3>
                </div>
                <button onClick={() => setIsRenewModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </header>

            <form onSubmit={handleRenewSubmit} className="p-5 sm:p-8 sm:pt-2 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* --- LADO IZQUIERDO: NUEVO DISEÑO DE FICHA DE SOCIO --- */}
                <div className="flex flex-col">
                    <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 relative overflow-hidden group">
                        {/* Decoración sutil de fondo */}
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-500 font-bold text-xl border-2 border-white shadow-sm">
                                    {selectedClient.nombre[0]}{selectedClient.apellidos[0]}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 leading-tight">
                                        {selectedClient.nombre} <br/> {selectedClient.apellidos}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-medium">ID Socio: #{selectedClient.id.slice(-5)}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-sm text-slate-400">phone</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-slate-300 leading-none mb-1">Contacto</p>
                                        <p className="text-sm font-bold text-slate-600">{selectedClient.telefono}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-sm text-slate-400">event_busy</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-slate-300 leading-none mb-1">Estado Actual</p>
                                        <p className="text-sm font-bold text-red-500 flex items-center gap-1">
                                            Vence: {selectedClient.vencimiento}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-sm text-slate-400">fitness_center</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-slate-300 leading-none mb-1">Plan Anterior</p>
                                        <p className="text-sm font-bold text-slate-600">{selectedClient.plan || 'No registrado'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <p className="mt-4 text-[11px] text-slate-400 text-center px-4 italic">
                        "Verifica que los datos del socio coincidan antes de procesar el pago."
                    </p>
                </div>

                {/* --- LADO DERECHO: MANTENEMOS EL DISEÑO DE ACCIÓN --- */}
                <div className="space-y-4 bg-slate-50 p-6 rounded-[24px] border border-primary/20">
                    <p className="text-label-sm font-black text-primary uppercase tracking-widest border-b border-slate-200 pb-2">Nueva Membresía</p>
                    <div className="space-y-1">
                        <label className="text-label-sm font-bold text-on-surface-variant">Elegir Plan</label>
                        <select 
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value as any)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-primary focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="Mensual">Mensual - $450</option>
                            <option value="Trimestral">Trimestral - $1200</option>
                            <option value="Semestral">Semestral - $2200</option>
                            <option value="Anual">Anual - $4000</option>
                        </select>
                    </div>
                    
                    <div className="flex flex-col items-center py-4 bg-white rounded-xl border border-primary/10 shadow-sm">
                        <p className="text-label-sm text-outline uppercase font-bold text-slate-400">Total a Cobrar</p>
                        <p className="text-4xl font-display text-primary font-black">${currentAmount}.00</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            type="button"
                            onClick={() => setPaymentMethod('Efectivo')}
                            className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${paymentMethod === 'Efectivo' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                        >Efectivo</button>
                        <button 
                            type="button"
                            onClick={() => setPaymentMethod('Tarjeta')}
                            className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${paymentMethod === 'Tarjeta' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                        >Tarjeta</button>
                    </div>

                    <button type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg mt-2 hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">payments</span>
                        Confirmar Renovación
                    </button>
                </div>
            </form>
        </div>
    </div>
     </>
  )
}

export default ModalRenew
