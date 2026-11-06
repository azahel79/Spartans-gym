// types/index.ts
export interface Client {
  id: string;
  nombre: string;
  apellidos: string;
  genero: 'Masculino' | 'Femenino' | 'Otro';  // 👈 CAMBIADO: genero en lugar de email
  telefono: string;
  whatsappOptIn: boolean;
  plan: PlanType;
  monto: number;
  metodoPago: PaymentMethod;
  status: 'ACTIVO' | 'VENCIDO' | 'PENDIENTE';
  ultimaVisita: string;
  vencimiento: string;
  fotoUrl?: string;
  attendanceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlanType = string;

export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia';

export type TransactionType = 'MEMBRESIA' | 'PRODUCTO';

export interface Transaction {
  id: number | string;
  fecha: string;
  hora: string;
  nombre: string;
  apellidos: string;
  clienteId: string | null;
  concepto: string;
  monto: number;
  metodo: PaymentMethod;
  tipo: TransactionType;
  createdAt?: string;
}

export interface Attendance {
  id: number;
  clientId: string;
  userId?: number | null;
  fecha: string;
  hora: string;
  createdAt: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  plan: PlanType;
  metodoPago: PaymentMethod;
  status: Client['status'];
  fotoUrl?: string | null;
  vencimiento: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  cat: Category;
  sku: string;
  stock: number;
  reorder: number;
  image: string | null;
  status: ProductStatus;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type Category = 'Suplementos' | 'Bebidas' | 'Snacks' | 'Merchandising' | 'Accesorios';

export type ProductStatus = 'En Stock' | 'Stock Bajo' | 'Agotado';

export interface DashboardExpiration {
  id: string;
  nombre: string;
  apellidos: string;
  dias: number;
  diasFaltantes: number;
  plan: PlanType;
  fotoUrl?: string | null;
  status: Client['status'];
}

export interface DashboardActivity {
  id: string;
  usuario: string;
  accion: string;
  area: string;
  hora: string;
  tipo: 'check' | 'pago' | 'nuevo';
  monto: number;
}

export interface DashboardHourData {
  hora: string;
  valor: number;
}

export interface DashboardDayData {
  dia: string;
  real: number;
  proyectado: number;
}

export interface DashboardStats {
  totalMovimientos: number;
  ocupacionActual: number;
  proximosVencimientos: DashboardExpiration[];
  actividadReciente: DashboardActivity[];
  afluenciaPorHora: DashboardHourData[];
  afluenciaPorDia: DashboardDayData[];
  ingresosTotalesMes?: number;
  metaMensual?: number;
  porcentajeMeta?: number;
}

export type CashShiftType = 'MORNING' | 'EVENING';
export type CashShiftStatus = 'OPEN' | 'CLOSED';

export interface CashShiftReport {
  shift: {
    id: string;
    dayKey: string;
    shiftType: CashShiftType;
    receptionist: string;
    openedAt: string;
    closedAt: string | null;
    openingCash: number;
  };
  summary: {
    transactionCount: number;
    attendanceCount: number;
    productSalesCount: number;
    productSalesTotal: number;
    newMembershipsCount: number;
    renewalsCount: number;
    membershipTotal: number;
    totalIncome: number;
    expectedCash: number;
  };
  paymentTotals: Record<PaymentMethod, number>;
  transactions: Array<{
    id: number;
    date: string;
    time: string;
    category: 'PUNTO_DE_VENTA' | 'NUEVO_CLIENTE' | 'RENOVACION';
    client: string;
    concept: string;
    paymentMethod: PaymentMethod;
    amount: number;
  }>;
  attendances: Array<{
    id: number;
    date: string;
    time: string;
    clientId: string;
    client: string;
    phone: string;
    plan: string;
    status: string;
  }>;
}

export interface CashShift {
  id: string;
  userId: number;
  shiftType: CashShiftType;
  status: CashShiftStatus;
  dayKey: string;
  openingCash: number;
  expectedCash: number | null;
  declaredCash: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  openingNotes?: string | null;
  closingNotes?: string | null;
  user?: { email: string; role?: string };
  report?: CashShiftReport;
}

export type WorkoutLevel = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
export type WorkoutAssignmentStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED';

export interface WorkoutExercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  notes?: string;
}

export interface WorkoutDay {
  dayName: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutRoutine {
  id: string;
  trainerId: number;
  name: string;
  level: WorkoutLevel;
  objective: string;
  durationWeeks: number;
  daysPerWeek: number;
  sessionTimeMinutes?: number | null;
  notes?: string | null;
  days: WorkoutDay[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  trainer?: { id: number; email: string };
  _count?: { assignments: number };
}

export interface WorkoutClient {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  plan: PlanType;
  status: Client['status'];
}

export interface WorkoutTrainer {
  id: number;
  email: string;
  createdAt: string;
}

export interface WorkoutAssignment {
  id: string;
  routineId: string;
  clientId: string;
  trainerId: number;
  startDate: string;
  endDate?: string | null;
  status: WorkoutAssignmentStatus;
  clientNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  routine: WorkoutRoutine;
  client: WorkoutClient;
  trainer?: { id: number; email: string };
}
