// store/inventory.store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api, apiUpload } from '../config/axios';
import type { Product, Category, ProductStatus } from '../types';

interface InventoryState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  addProduct: (formData: FormData) => Promise<void>;
  updateProduct: (id: number, formData: FormData) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  processSale: (cartItems: { id: number; quantity: number }[], paymentMethod?: 'Efectivo' | 'Tarjeta') => Promise<void>;
}

const categoryConfig: Record<Category, { icon: string; color: string }> = {
  Suplementos: { icon: 'fitness_center', color: 'indigo' },
  Bebidas: { icon: 'water_drop', color: 'emerald' },
  Snacks: { icon: 'restaurant_menu', color: 'red' },
  Merchandising: { icon: 'apparel', color: 'slate' },
  Accesorios: { icon: 'sports_kabaddi', color: 'slate' },
};

const calculateStatus = (stock: number, reorder: number): ProductStatus => {
  if (stock <= 0) return 'Agotado';
  if (stock <= reorder) return 'Stock Bajo';
  return 'En Stock';
};

const getStatusColor = (status: ProductStatus, category: Category): string => {
  if (status === 'Agotado') return 'red';
  if (status === 'Stock Bajo') return 'orange';
  return categoryConfig[category].color;
};

const isCategory = (category: string): category is Category =>
  Object.prototype.hasOwnProperty.call(categoryConfig, category);

const normalizeProduct = (product: any): Product => {
  const cat: Category = isCategory(product.cat) ? product.cat : 'Accesorios';
  const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  const stock = Number(product.stock || 0);
  const reorder = Number(product.reorder || 0);
  const status = calculateStatus(stock, reorder);

  return {
    ...product,
    cat,
    price,
    stock,
    reorder,
    image: product.image || null,
    status,
    icon: categoryConfig[cat].icon,
    color: getStatusColor(status, cat),
  };
};

export const useInventoryStore = create<InventoryState>()(
  devtools(
    (set, get) => ({
      products: [],
      isLoading: false,
      error: null,

      fetchProducts: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/products');
          const products = response.data.data.map(normalizeProduct);

          set({
            products,
            isLoading: false,
          });
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al cargar productos',
            isLoading: false,
          });
        }
      },

      addProduct: async (formData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiUpload.post('/products', formData);
          const newProduct = normalizeProduct(response.data.data);

          set((state) => ({
            products: [newProduct, ...state.products],
            isLoading: false,
          }));
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al crear producto',
            isLoading: false,
          });
          throw err;
        }
      },

      updateProduct: async (id, formData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiUpload.put(`/products/${id}`, formData);
          const updatedProduct = normalizeProduct(response.data.data);

          set((state) => ({
            products: state.products.map((p) => (p.id === id ? updatedProduct : p)),
            isLoading: false,
          }));
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al actualizar producto',
            isLoading: false,
          });
          throw err;
        }
      },

      deleteProduct: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await api.delete(`/products/${id}`);
          set((state) => ({
            products: state.products.filter((p) => p.id !== id),
            isLoading: false,
          }));
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al eliminar producto',
            isLoading: false,
          });
          throw err;
        }
      },

      processSale: async (cartItems, paymentMethod = 'Efectivo') => {
        set({ isLoading: true, error: null });

        const total = cartItems.reduce((sum, item) => {
          const product = get().products.find((p) => p.id === item.id);
          return sum + (product?.price || 0) * item.quantity;
        }, 0);

        try {
          await api.post('/transactions', {
            tipo: 'PRODUCTO',
            metodo: paymentMethod,
            monto: total,
            clienteId: null,
            productos: cartItems,
          });

          set((state) => ({
            products: state.products.map((p) => {
              const itemInCart = cartItems.find((item) => item.id === p.id);
              if (!itemInCart) return p;

              const newStock = Math.max(0, p.stock - itemInCart.quantity);
              const newStatus = calculateStatus(newStock, p.reorder);

              return {
                ...p,
                stock: newStock,
                status: newStatus,
                color: getStatusColor(newStatus, p.cat),
                updatedAt: new Date().toISOString(),
              };
            }),
            isLoading: false,
          }));
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al procesar venta',
            isLoading: false,
          });
          throw err;
        }
      },
    }),
    { name: 'inventory-store' }
  )
);
