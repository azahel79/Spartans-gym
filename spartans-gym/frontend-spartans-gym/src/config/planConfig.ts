// config/planConfig.ts
export const PLAN_CONFIG = {
  Mensual: { months: 1, price: 450, discount: 0 },
  Trimestral: { months: 3, price: 1200, discount: 0.05 },
  Semestral: { months: 6, price: 2400, discount: 0.10 },
  Anual: { months: 12, price: 4500, discount: 0.15 },
} as const;

export type PlanType = keyof typeof PLAN_CONFIG;

export const getPlanPrice = (plan: PlanType): number => {
  const basePrice = PLAN_CONFIG[plan].price;
  const discount = PLAN_CONFIG[plan].discount;
  return basePrice * (1 - discount);
};

export const getPlanMonths = (plan: PlanType): number => {
  return PLAN_CONFIG[plan].months;
};