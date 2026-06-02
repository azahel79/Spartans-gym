// types/index.ts
export interface Client {
  id: string;
  nombre: string;
  apellidos: string;
  genero: 'Masculino' | 'Femenino' | 'Otro';  // 👈 CAMBIADO: genero en lugar de email
  telefono: string;
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
