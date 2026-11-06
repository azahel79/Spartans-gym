import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { isAdminRole, useAuthStore } from '../store/auth.store';
import { useWorkoutStore, type RoutinePayload } from '../store/workout.store';
import { useConfigStore } from '../store/config.store';
import { normalizeAppearance } from '../config/appearance';
import { BrandLogo } from '../components/BrandLogo';
import type { WorkoutAssignment, WorkoutDay, WorkoutLevel, WorkoutRoutine } from '../types';

const emptyDay = (): WorkoutDay => ({
  dayName: 'Día 1',
  focus: 'Full body',
  exercises: [{ name: '', sets: '4', reps: '10-12', rest: '60 seg', notes: '' }],
});

const defaultPayload = (): RoutinePayload => ({
  name: '',
  level: 'PRINCIPIANTE',
  objective: '',
  durationWeeks: 4,
  daysPerWeek: 3,
  sessionTimeMinutes: 60,
  notes: '',
  days: [emptyDay()],
});

const levelLabel: Record<WorkoutLevel, string> = {
  PRINCIPIANTE: 'Principiante',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

const statusLabel = {
  ACTIVE: 'Activa',
  COMPLETED: 'Finalizada',
  PAUSED: 'Pausada',
};

const exerciseSchema = z.object({
  name: z.string().trim().min(2, 'El ejercicio necesita nombre').max(90, 'Nombre muy largo'),
  sets: z.string().trim().min(1, 'Series requeridas').max(20, 'Series muy largas'),
  reps: z.string().trim().min(1, 'Repeticiones requeridas').max(30, 'Repeticiones muy largas'),
  rest: z.string().trim().min(1, 'Descanso requerido').max(30, 'Descanso muy largo'),
  notes: z.string().trim().max(180, 'Notas muy largas').optional().or(z.literal('')),
});

const daySchema = z.object({
  dayName: z.string().trim().min(3, 'Nombre del dia requerido').max(60, 'Nombre muy largo'),
  focus: z.string().trim().min(3, 'Enfoque requerido').max(90, 'Enfoque muy largo'),
  exercises: z.array(exerciseSchema).min(1, 'Cada día debe tener al menos un ejercicio').max(14, 'Máximo 14 ejercicios por día'),
});

const routineSchema = z.object({
  trainerId: z.number().optional(),
  name: z.string().trim().min(3, 'Pon un nombre de rutina válido').max(100, 'Nombre muy largo'),
  level: z.enum(['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO']),
  objective: z.string().trim().min(3, 'Agrega un objetivo claro').max(140, 'Objetivo muy largo'),
  durationWeeks: z.coerce.number().int().min(1, 'Mínimo 1 semana').max(52, 'Máximo 52 semanas'),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  sessionTimeMinutes: z.preprocess((value) => value === '' || value === null ? null : Number(value), z.number().int().min(15, 'Mínimo 15 minutos').max(240, 'Máximo 240 minutos').nullable().optional()),
  notes: z.string().trim().max(1000, 'Notas muy largas').optional().or(z.literal('')),
  days: z.array(daySchema).min(1, 'Agrega al menos un día').max(7, 'Máximo 7 días'),
});

export const Training = () => {
  const { user } = useAuthStore();
  const isAdmin = isAdminRole(user?.role);
  const { gymConfig } = useConfigStore();
  const appearance = normalizeAppearance(gymConfig.appearance);
  const {
    routines,
    assignments,
    clients,
    trainers,
    isLoading,
    fetchAll,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    assignRoutine,
    updateAssignmentStatus,
  } = useWorkoutStore();

  const [activeTab, setActiveTab] = useState<'routines' | 'assignments'>('routines');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutRoutine | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ routine: WorkoutRoutine; assignment?: WorkoutAssignment } | null>(null);
  const {
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<RoutinePayload>({
    resolver: zodResolver(routineSchema) as Resolver<RoutinePayload>,
    defaultValues: defaultPayload(),
    mode: 'onSubmit',
  });
  const form = useWatch({ control }) as RoutinePayload;
  const setForm = (next: RoutinePayload | ((state: RoutinePayload) => RoutinePayload)) => {
    reset(typeof next === 'function' ? next(form) : next);
  };
  const [assignForm, setAssignForm] = useState({
    routineId: '',
    clientId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    clientNotes: '',
  });

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const stats = useMemo(() => ({
    routines: routines.length,
    activeAssignments: assignments.filter((item) => item.status === 'ACTIVE').length,
    clientsAssigned: new Set(assignments.map((item) => item.clientId)).size,
    pdfReady: assignments.length,
  }), [assignments, routines.length]);

  const openCreate = () => {
    setEditing(null);
    reset(defaultPayload());
    setFormOpen(true);
  };

  const openEdit = (routine: WorkoutRoutine) => {
    setEditing(routine);
    reset({
      trainerId: routine.trainerId,
      name: routine.name,
      level: routine.level,
      objective: routine.objective,
      durationWeeks: routine.durationWeeks,
      daysPerWeek: routine.daysPerWeek,
      sessionTimeMinutes: routine.sessionTimeMinutes,
      notes: routine.notes || '',
      days: routine.days,
    });
    setFormOpen(true);
  };

  const updateDay = (dayIndex: number, patch: Partial<WorkoutDay>) => {
    const current = form.days[dayIndex];
    if (!current) return;
    setValue(`days.${dayIndex}` as const, { ...current, ...patch }, { shouldDirty: true, shouldValidate: false });
  };

  const updateExercise = (dayIndex: number, exerciseIndex: number, key: keyof WorkoutDay['exercises'][number], value: string) => {
    setValue(`days.${dayIndex}.exercises.${exerciseIndex}.${key}` as const, value, { shouldDirty: true, shouldValidate: false });
  };

  const addExercise = (dayIndex: number) => {
    const current = form.days[dayIndex];
    if (!current) return;
    setValue(`days.${dayIndex}.exercises` as const, [...current.exercises, { name: '', sets: '4', reps: '10-12', rest: '60 seg', notes: '' }], { shouldDirty: true });
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const current = form.days[dayIndex];
    if (!current || current.exercises.length <= 1) {
      toast.warning('Cada dia necesita al menos un ejercicio');
      return;
    }
    setValue(`days.${dayIndex}.exercises` as const, current.exercises.filter((_, exIndex) => exIndex !== exerciseIndex), { shouldDirty: true });
  };

  const addDay = () => {
    const nextDays = [...form.days, { ...emptyDay(), dayName: `Día ${form.days.length + 1}` }];
    setValue('days', nextDays, { shouldDirty: true });
    setValue('daysPerWeek', Math.min(7, nextDays.length), { shouldDirty: true });
  };

  const removeDay = (dayIndex: number) => {
    if (form.days.length <= 1) {
      toast.warning('La rutina necesita al menos un dia');
      return;
    }
    const nextDays = form.days.filter((_, index) => index !== dayIndex);
    setValue('days', nextDays, { shouldDirty: true });
    setValue('daysPerWeek', Math.max(1, nextDays.length), { shouldDirty: true });
  };

  const saveRoutine = handleSubmit(async (data) => {
    try {
      const payload: RoutinePayload = {
        ...data,
        daysPerWeek: Math.min(7, data.days.length),
        notes: data.notes || '',
        days: data.days.map((day) => ({
          ...day,
          exercises: day.exercises.map((exercise) => ({ ...exercise, notes: exercise.notes || '' })),
        })),
      };
      if (editing) {
        await updateRoutine(editing.id, payload);
        toast.success('Rutina actualizada');
      } else {
        await createRoutine(payload);
        toast.success('Rutina creada');
      }
      setFormOpen(false);
    } catch {
      toast.error('No se pudo guardar la rutina');
    }
  }, (formErrors) => {
    const firstError = formErrors.name?.message
      || formErrors.objective?.message
      || formErrors.days?.message
      || 'Revisa los campos marcados antes de guardar';
    toast.error(firstError);
  });

  const handleAssign = async () => {
    if (!assignForm.routineId || !assignForm.clientId) {
      toast.error('Selecciona rutina y cliente');
      return;
    }
    try {
      await assignRoutine(assignForm);
      setAssignForm({ routineId: '', clientId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', clientNotes: '' });
      toast.success('Rutina asignada');
      setActiveTab('assignments');
    } catch {
      toast.error('No se pudo asignar la rutina');
    }
  };

  const printRoutine = async (routine: WorkoutRoutine, assignment?: WorkoutAssignment) => {
    try {
      const { printWorkoutPdf } = await import('../utils/workoutPdf');
      await printWorkoutPdf({ routine, assignment, gymConfig, appearance });
    } catch {
      toast.error('No se pudo generar el PDF');
    }
  };

  const openPdfPreview = (routine: WorkoutRoutine, assignment?: WorkoutAssignment) => {
    setPdfPreview({ routine, assignment });
  };

  return (
    <div className="training-page min-h-[calc(100vh-6rem)] rounded-[2rem] px-4 py-10 sm:px-6 lg:px-10 xl:px-12">
      <section className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
            <span className="material-symbols-outlined text-sm">fitness_center</span>
            Entrenamiento
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-black leading-tight">Rutinas y entrenamiento</h2>
          <p className="mt-1 max-w-2xl text-on-surface-variant">Crea rutinas por nivel, asigna clientes y genera PDFs profesionales con la marca del gimnasio.</p>
        </div>
        <button onClick={openCreate} className="brand-hover inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-white shadow-lg">
          <span className="material-symbols-outlined">add</span>
          Nueva rutina
        </button>
      </section>

      <section className="mb-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Rutinas" value={stats.routines} icon="fitness_center" />
        <Stat label="Asignaciones activas" value={stats.activeAssignments} icon="assignment" />
        <Stat label="Clientes con rutina" value={stats.clientsAssigned} icon="groups" />
        <Stat label="PDF disponibles" value={stats.pdfReady} icon="picture_as_pdf" />
      </section>

      <section className="training-panel overflow-hidden rounded-card border border-[#DADCE0] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between xl:p-6">
          <div className="training-tabs inline-flex rounded-2xl bg-slate-100 p-1">
            <button onClick={() => setActiveTab('routines')} className={`rounded-xl px-4 py-2 text-sm font-bold ${activeTab === 'routines' ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>Mis rutinas</button>
            <button onClick={() => setActiveTab('assignments')} className={`rounded-xl px-4 py-2 text-sm font-bold ${activeTab === 'assignments' ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>Asignaciones</button>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_auto]">
            <select className="training-select rounded-xl border border-outline-variant px-3 py-2" value={assignForm.routineId} onChange={(e) => setAssignForm({ ...assignForm, routineId: e.target.value })}>
              <option value="">Seleccionar rutina</option>
              {routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
            </select>
            <select className="training-select rounded-xl border border-outline-variant px-3 py-2" value={assignForm.clientId} onChange={(e) => setAssignForm({ ...assignForm, clientId: e.target.value })}>
              <option value="">Asignar cliente</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.nombre} {client.apellidos}</option>)}
            </select>
            <button onClick={handleAssign} className="training-assign-button rounded-xl bg-slate-900 px-4 py-2 font-bold text-white dark:bg-white dark:text-slate-950">Asignar</button>
          </div>
        </div>

        <div className="p-5 xl:p-6">
        {activeTab === 'routines' ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {routines.length === 0 ? (
              <Empty title="Aún no hay rutinas" text="Crea la primera rutina por nivel para empezar a asignarla a clientes." />
            ) : routines.map((routine) => (
              <article key={routine.id} className="training-card rounded-3xl border border-outline-variant bg-slate-50 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{levelLabel[routine.level]}</span>
                    <h3 className="mt-3 text-xl font-black text-on-surface">{routine.name}</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">{routine.objective}</p>
                  </div>
                  <span className="material-symbols-outlined text-primary">fitness_center</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <Mini label="Semanas" value={routine.durationWeeks} />
                  <Mini label="Días" value={routine.daysPerWeek} />
                  <Mini label="Sesión" value={`${routine.sessionTimeMinutes || '-'} min`} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => openEdit(routine)} className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-bold text-on-surface">Editar</button>
                  <button onClick={() => openPdfPreview(routine)} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">PDF plantilla</button>
                  <button onClick={() => void deleteRoutine(routine.id)} className="rounded-xl px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50">Archivar</button>
                </div>
                {isAdmin && routine.trainer?.email && <p className="mt-3 text-xs text-on-surface-variant">Entrenador: {routine.trainer.email}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <Empty title="Sin asignaciones" text="Asigna una rutina a un cliente para generar su PDF personalizado." />
            ) : assignments.map((assignment) => (
              <article key={assignment.id} className="training-card flex flex-col gap-4 rounded-3xl border border-outline-variant bg-slate-50 p-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="text-lg font-black text-on-surface">{assignment.client.nombre} {assignment.client.apellidos}</h3>
                  <p className="text-sm text-on-surface-variant">{assignment.routine.name} - {levelLabel[assignment.routine.level]}</p>
                  <p className="text-xs text-on-surface-variant">Inicio: {new Date(assignment.startDate).toLocaleDateString('es-MX')} {assignment.endDate ? `- Fin: ${new Date(assignment.endDate).toLocaleDateString('es-MX')}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="rounded-xl border border-outline-variant px-3 py-2 text-sm" value={assignment.status} onChange={(e) => void updateAssignmentStatus(assignment.id, e.target.value as WorkoutAssignment['status'])}>
                    <option value="ACTIVE">{statusLabel.ACTIVE}</option>
                    <option value="PAUSED">{statusLabel.PAUSED}</option>
                    <option value="COMPLETED">{statusLabel.COMPLETED}</option>
                  </select>
                  <button onClick={() => openPdfPreview(assignment.routine, assignment)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Generar PDF</button>
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[220] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-md sm:p-6">
          <div className="workout-modal mx-auto my-4 max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900">
            <div className="workout-modal-header flex items-start justify-between gap-4 p-6 text-white sm:p-8">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
                  <span className="material-symbols-outlined text-sm">fitness_center</span>
                  Rutina profesional
                </div>
                <h3 className="text-3xl font-black leading-tight">{editing ? 'Editar rutina' : 'Nueva rutina'}</h3>
                <p className="mt-1 max-w-2xl text-sm text-white/80">Define el nivel, objetivo y estructura diaria con un formato limpio para generar PDFs profesionales.</p>
              </div>
              <button onClick={() => setFormOpen(false)} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5 sm:p-8">
              <section className="workout-form-section">
                <div className="mb-5 flex items-center gap-3">
                  <span className="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-primary">tune</span>
                  <div>
                    <h4 className="text-lg font-black text-on-surface">Datos generales</h4>
                    <p className="text-sm text-on-surface-variant">Información base que aparecerá en la rutina y el PDF.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Nombre" value={form.name} error={errors.name?.message} onChange={(value) => setValue('name', value, { shouldDirty: true })} />
                  <label className="workout-field">
                    <span>Nivel</span>
                    <select value={form.level} onChange={(e) => setValue('level', e.target.value as WorkoutLevel, { shouldDirty: true })}>
                      <option value="PRINCIPIANTE">Principiante</option>
                      <option value="INTERMEDIO">Intermedio</option>
                      <option value="AVANZADO">Avanzado</option>
                    </select>
                  </label>
                  <Field label="Semanas" type="number" value={String(form.durationWeeks)} error={errors.durationWeeks?.message} onChange={(value) => setValue('durationWeeks', Number(value) || 1, { shouldDirty: true })} />
                  <Field label="Minutos por sesión" type="number" value={String(form.sessionTimeMinutes || '')} error={errors.sessionTimeMinutes?.message} onChange={(value) => setValue('sessionTimeMinutes', Number(value) || null, { shouldDirty: true })} />
                  {isAdmin && (
                    <label className="workout-field md:col-span-2">
                      <span>Entrenador</span>
                      <select value={form.trainerId || ''} onChange={(e) => setValue('trainerId', Number(e.target.value) || undefined, { shouldDirty: true })}>
                        <option value="">Seleccionar entrenador</option>
                        {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.email}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="workout-field md:col-span-2">
                    <span>Objetivo</span>
                    <input value={form.objective} onChange={(e) => setValue('objective', e.target.value, { shouldDirty: true })} placeholder="Ej. hipertrofia, fuerza, pérdida de grasa..." />
                    {errors.objective?.message && <small className="workout-error">{errors.objective.message}</small>}
                  </label>
                </div>
              </section>

              <section className="workout-form-section mt-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-primary">calendar_month</span>
                    <div>
                      <h4 className="text-lg font-black text-on-surface">Días de entrenamiento</h4>
                      <p className="text-sm text-on-surface-variant">Organiza ejercicios por día, enfoque y notas técnicas.</p>
                    </div>
                  </div>
                  <button onClick={addDay} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-black text-on-surface transition hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span className="material-symbols-outlined text-base">add</span>
                    Agregar día
                  </button>
                </div>

                <div className="space-y-5">
                  {form.days.map((day, dayIndex) => (
                    <div key={dayIndex} className="workout-day-card">
                      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="grid flex-1 gap-3 md:grid-cols-2">
                          <Field label="Día" value={day.dayName} onChange={(value) => updateDay(dayIndex, { dayName: value })} />
                          <Field label="Enfoque" value={day.focus} onChange={(value) => updateDay(dayIndex, { focus: value })} />
                        </div>
                        <button onClick={() => removeDay(dayIndex)} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10">
                          <span className="material-symbols-outlined text-base">delete</span>
                          Eliminar día
                        </button>
                      </div>

                      <div className="space-y-3">
                    {day.exercises.map((exercise, exerciseIndex) => (
                      <div key={exerciseIndex} className="workout-exercise-card">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant">Ejercicio {exerciseIndex + 1}</p>
                          <button onClick={() => removeExercise(dayIndex, exerciseIndex)} className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10" title="Eliminar ejercicio">
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.4fr)_110px_130px_140px_minmax(180px,1fr)]">
                          <ExerciseInput label="Ejercicio" placeholder="Ej. Sentadilla" value={exercise.name} onChange={(value) => updateExercise(dayIndex, exerciseIndex, 'name', value)} />
                          <ExerciseInput label="Series" value={exercise.sets} onChange={(value) => updateExercise(dayIndex, exerciseIndex, 'sets', value)} />
                          <ExerciseInput label="Reps" value={exercise.reps} onChange={(value) => updateExercise(dayIndex, exerciseIndex, 'reps', value)} />
                          <ExerciseInput label="Descanso" value={exercise.rest} onChange={(value) => updateExercise(dayIndex, exerciseIndex, 'rest', value)} />
                          <ExerciseInput label="Notas" placeholder="Opcional" value={exercise.notes || ''} onChange={(value) => updateExercise(dayIndex, exerciseIndex, 'notes', value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                      <button onClick={() => addExercise(dayIndex)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-black text-primary transition hover:bg-primary/15">
                        <span className="material-symbols-outlined text-base">add</span>
                        Agregar ejercicio
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="workout-form-section mt-5">
                <label className="workout-field">
                  <span>Notas generales</span>
                  <textarea className="min-h-28 resize-y" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Indicaciones generales, calentamiento, progresiones o cuidados especiales..." />
                </label>
              </section>

              <section className="workout-form-section mt-5">
                <div className="mb-5 flex items-center gap-3">
                  <span className="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-primary">description</span>
                  <div>
                    <h4 className="text-lg font-black text-on-surface">Vista tipo documento</h4>
                    <p className="text-sm text-on-surface-variant">Así se verá la rutina como ficha profesional antes de guardarla o imprimirla.</p>
                  </div>
                </div>
                <RoutineDocumentPreview routine={form} gymName={gymConfig.name} logo={gymConfig.logo} appearance={appearance} />
              </section>

              <div className="workout-modal-actions sticky bottom-0 -mx-5 mt-6 flex flex-col gap-3 border-t border-outline-variant bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:flex-row sm:justify-end sm:px-8">
                <button onClick={() => setFormOpen(false)} className="rounded-xl bg-slate-100 px-6 py-3 font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                <button disabled={isLoading} onClick={() => void saveRoutine()} className="brand-hover rounded-xl bg-primary px-6 py-3 font-black text-white shadow-lg disabled:opacity-60">Guardar rutina</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pdfPreview && (
        <div className="fixed inset-0 z-[230] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-md sm:p-6">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-outline-variant p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
                  <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                  Vista previa PDF
                </div>
                <h3 className="text-2xl font-black text-on-surface">{pdfPreview.routine.name}</h3>
                <p className="text-sm text-on-surface-variant">Revisa el documento antes de descargarlo.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => setPdfPreview(null)}
                  className="rounded-xl bg-slate-100 px-4 py-3 font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => void printRoutine(pdfPreview.routine, pdfPreview.assignment)}
                  className="brand-hover rounded-xl bg-primary px-4 py-3 font-black text-white shadow-lg"
                >
                  Descargar PDF
                </button>
              </div>
            </div>
            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-4 sm:p-6">
              <RoutineDocumentPreview
                routine={pdfPreview.routine}
                gymName={gymConfig.name}
                logo={gymConfig.logo}
                appearance={appearance}
                assignment={pdfPreview.assignment}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="training-card rounded-card border border-[#DADCE0] bg-white p-6 shadow-sm">
      <span className="material-symbols-outlined mb-4 inline-block rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>
      <p className="text-4xl font-black text-on-surface">{value}</p>
      <p className="text-sm text-on-surface-variant">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center dark:bg-slate-900">
      <p className="text-xs font-bold text-on-surface-variant">{label}</p>
      <p className="font-black text-on-surface">{value}</p>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="col-span-full rounded-3xl border border-dashed border-outline-variant p-14 text-center">
      <span className="material-symbols-outlined text-5xl text-primary">fitness_center</span>
      <h3 className="mt-3 text-xl font-black text-on-surface">{title}</h3>
      <p className="text-on-surface-variant">{text}</p>
    </div>
  );
}

function RoutineDocumentPreview({
  routine,
  gymName,
  logo,
  appearance,
  assignment,
}: {
  routine: RoutinePayload | WorkoutRoutine;
  gymName: string;
  logo?: string;
  appearance: ReturnType<typeof normalizeAppearance>;
  assignment?: WorkoutAssignment;
}) {
  const firstDay = routine.days?.[0];
  const totalExercises = routine.days.reduce((acc, day) => acc + day.exercises.length, 0);
  const clientName = assignment ? `${assignment.client.nombre} ${assignment.client.apellidos}` : 'Plantilla sin cliente asignado';
  const trainerName = assignment?.trainer?.email || ('trainer' in routine ? routine.trainer?.email : '') || 'Entrenador asignado';

  return (
    <div className="routine-document-shell">
      <article className="routine-document-page">
        <div className="routine-doc-topbar" />
        <header className="routine-doc-header">
          <div className="flex items-center gap-4">
            <div className="routine-doc-logo">
              <BrandLogo
                customLogo={logo}
                primaryColor={appearance.primaryColor}
                inkColor={appearance.secondaryColor}
                alt={gymName}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="routine-doc-kicker">{gymName || 'MEXA GYM'}</p>
              <h5>Plan de entrenamiento</h5>
              <span>Documento de rutina personalizada</span>
            </div>
          </div>
          <div className="routine-doc-badge">{levelLabel[routine.level]}</div>
        </header>

        <section className="routine-doc-title">
          <h3>{routine.name || 'Nombre de la rutina'}</h3>
          <p>{routine.objective || 'Objetivo de entrenamiento, recomendaciones principales y enfoque de la rutina.'}</p>
        </section>

        <section className="routine-doc-person">
          <div><span>Cliente</span><strong>{clientName}</strong></div>
          <div><span>Entrenador</span><strong>{trainerName}</strong></div>
        </section>

        <section className="routine-doc-stats">
          <div><span>Duración</span><strong>{routine.durationWeeks || 0} semanas</strong></div>
          <div><span>Días</span><strong>{routine.days?.length || 0}</strong></div>
          <div><span>Sesión</span><strong>{routine.sessionTimeMinutes || '-'} min</strong></div>
          <div><span>Ejercicios</span><strong>{totalExercises}</strong></div>
        </section>

        <section className="routine-doc-day">
          <div className="routine-doc-day-head">
            <span>Día muestra</span>
            <strong>{firstDay?.dayName || 'Día 1'} - {firstDay?.focus || 'Enfoque'}</strong>
          </div>
          <div className="routine-doc-table">
            {(firstDay?.exercises || []).slice(0, 4).map((exercise, index) => (
              <div key={`${exercise.name}-${index}`} className="routine-doc-row">
                <strong>{exercise.name || `Ejercicio ${index + 1}`}</strong>
                <span>{exercise.sets || '-'} series</span>
                <span>{exercise.reps || '-'} reps</span>
                <span>{exercise.rest || '-'} descanso</span>
              </div>
            ))}
            {!firstDay?.exercises?.length && (
              <div className="routine-doc-row">
                <strong>Ejercicio de ejemplo</strong>
                <span>4 series</span>
                <span>10-12 reps</span>
                <span>60 seg</span>
              </div>
            )}
          </div>
        </section>

        <footer className="routine-doc-footer">
          <span>Generado desde el sistema del gimnasio</span>
          <strong>{new Date().toLocaleDateString('es-MX')}</strong>
        </footer>
      </article>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', error }: { label: string; value: string; onChange: (value: string) => void; type?: string; error?: string }) {
  return (
    <label className="workout-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <small className="workout-error">{error}</small>}
    </label>
  );
}

function ExerciseInput({ label, value, onChange, placeholder, error }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; error?: string }) {
  return (
    <label className="workout-exercise-field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {error && <small className="workout-error">{error}</small>}
    </label>
  );
}
