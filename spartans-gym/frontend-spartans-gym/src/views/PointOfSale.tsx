import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useHistoryStore } from '../store/history.store';
import { useInventoryStore } from '../store/inventory.store';
import { printSaleReceipt } from '../utils/receipts';

interface CartItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  quantity: number;
  image: string | null;
  cat: string;
}

const filters = ['Todos', 'Suplementos', 'Merchandising', 'Bebidas', 'Accesorios', 'Snacks'];

const PointOfSale: React.FC = () => {
  const { products, fetchProducts, processSale, isLoading, error } = useInventoryStore();
  const { fetchTransactions } = useHistoryStore();

  const [activeFilter, setActiveFilter] = useState('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta'>('Efectivo');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (activeFilter === 'Todos') return products;
    return products.filter((product) => product.cat === activeFilter);
  }, [activeFilter, products]);

  const total = cart.reduce((acc, item) => acc + Number(item.price || 0) * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const addToCart = (product: any) => {
    if (product.stock <= 0) {
      toast.warning(`${product.name} esta agotado`, { style: { backgroundColor: '#000000' }, theme: 'colored', position: 'top-right' });
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (!existingItem) return [...prevCart, { ...product, quantity: 1 }];

      if (existingItem.quantity >= product.stock) {
        toast.warning(`Stock insuficiente de ${product.name}`, { style: { backgroundColor: '#000000' }, theme: 'colored', position: 'top-right' });
        return prevCart;
      }

      return prevCart.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === productId ? { ...item, quantity: item.quantity - 1 } : item)).filter((item) => item.quantity > 0)
    );
  };

  const deleteFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.warning('El carrito esta vacio', { style: { backgroundColor: '#000000' }, theme: 'colored', position: 'top-right' });
      return;
    }

    setIsProcessing(true);
    try {
      const receiptItems = cart.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price }));

      await processSale(cart.map((item) => ({ id: item.id, quantity: item.quantity })), paymentMethod);
      await fetchProducts();
      await fetchTransactions();

      toast.success(
        <div className="flex flex-col">
          <span className="font-bold text-white">Venta exitosa</span>
          <span className="text-xs text-white opacity-90">Total: ${total.toFixed(2)}</span>
        </div>,
        {
          style: { backgroundColor: '#000000' },
          icon: <span className="material-symbols-outlined text-white">check_circle</span>,
          theme: 'colored',
          position: 'top-right',
          autoClose: 3000,
        }
      );
      printSaleReceipt(receiptItems, paymentMethod, total);
      clearCart();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al procesar la venta', {
        style: { backgroundColor: '#000000' },
        theme: 'colored',
        position: 'top-right',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pt-20 md:pt-16">
      <div className="grid grid-cols-12 gap-4 px-3 py-4 sm:px-4 md:gap-gutter md:p-container-padding">
        <section className="col-span-12 flex flex-col gap-4 md:gap-6 lg:col-span-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Punto de Venta</h1>
            <p className="font-medium text-slate-500">Selecciona productos para la venta actual.</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {filters.map((category) => (
              <button
                key={category}
                onClick={() => setActiveFilter(category)}
                className={`whitespace-nowrap rounded-full px-6 py-2.5 font-bold transition-all ${
                  activeFilter === category ? 'bg-[#FF3B30] text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full rounded-2xl border border-slate-100 bg-white px-4 py-16 text-center text-sm text-slate-400">Cargando productos...</div>
            ) : error ? (
              <div className="col-span-full rounded-2xl border border-red-100 bg-red-50 px-4 py-16 text-center text-sm font-semibold text-red-600">{error}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-100 bg-white px-4 py-16 text-center text-sm text-slate-400">
                No hay productos disponibles en este filtro.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const inCart = cart.find((item) => item.id === product.id)?.quantity || 0;
                const stockLeft = product.stock - inCart;
                const isOutOfStock = stockLeft <= 0;

                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${
                      isOutOfStock ? 'cursor-not-allowed opacity-60 grayscale' : 'hover:scale-[1.02]'
                    }`}
                  >
                    <div className="relative mb-4 aspect-square overflow-hidden rounded-xl bg-slate-100">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <span className="material-symbols-outlined text-4xl">image</span>
                        </div>
                      )}
                      <span
                        className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          product.stock <= product.reorder ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        Stock: {stockLeft}
                      </span>
                    </div>

                    <h3 className="mb-1 truncate font-bold text-slate-900">{product.name}</h3>
                    <p className="mb-4 text-xs text-slate-500">{product.cat}</p>

                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xl font-black text-[#FF3B30]">${Number(product.price || 0).toFixed(2)}</span>
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors ${isOutOfStock ? 'bg-slate-300' : 'bg-slate-900 group-hover:bg-[#FF3B30]'}`}>
                        <span className="material-symbols-outlined">add</span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4">
          <div className="flex max-h-none flex-col rounded-2xl border border-slate-200 bg-white shadow-xl lg:sticky lg:top-20 lg:h-[calc(100vh-140px)]">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6">
              <h2 className="text-xl font-bold text-slate-900">Carrito de Venta</h2>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#FF3B30]">{cartCount} items</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined mb-2 text-5xl">shopping_cart</span>
                  <p className="font-medium">El carrito esta vacio</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      {item.image ? <img src={item.image} className="h-full w-full object-cover" alt={item.name} /> : <span className="material-symbols-outlined text-slate-300">inventory</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-slate-900">{item.name}</h4>
                      <p className="text-xs text-slate-500">${item.price.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-black text-slate-900">${(item.price * item.quantity).toFixed(2)}</span>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1">
                        <button type="button" onClick={() => removeFromCart(item.id)} className="p-1 transition-colors hover:text-red-500">
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => addToCart(item)} className="p-1 transition-colors hover:text-emerald-500 disabled:opacity-20" disabled={item.quantity >= item.stock}>
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                        <button type="button" onClick={() => deleteFromCart(item.id)} className="ml-1 p-1 transition-colors hover:text-red-500">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4 rounded-b-2xl border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-lg font-bold text-slate-900">Total a Pagar</span>
                <span className="text-3xl font-black text-[#FF3B30]">${total.toFixed(2)}</span>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Metodo de Pago</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1">
                  {(['Efectivo', 'Tarjeta'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                        paymentMethod === method ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{method === 'Efectivo' ? 'payments' : 'credit_card'}</span>
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                <button type="button" onClick={clearCart} disabled={cart.length === 0} className="col-span-1 h-12 rounded-xl border border-red-100 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="material-symbols-outlined">delete</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeSale}
                  disabled={cart.length === 0 || isProcessing}
                  className="col-span-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FF3B30] font-bold text-white shadow-lg transition-all hover:bg-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale"
                >
                  {isProcessing ? 'Procesando...' : <>Finalizar Venta <span className="material-symbols-outlined">arrow_forward</span></>}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default PointOfSale;
