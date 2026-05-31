import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useInventoryStore } from '../store/inventory.store';
import type { Category, Product } from '../types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

const filters: Array<Category | 'Todos'> = ['Todos', 'Suplementos', 'Merchandising', 'Bebidas', 'Accesorios', 'Snacks'];

const formatCurrency = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const Inventory = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { products, addProduct, deleteProduct, updateProduct, fetchProducts, isLoading, error } = useInventoryStore();

  const [activeFilter, setActiveFilter] = useState<Category | 'Todos'>('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemsPerPage = 8;

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (activeFilter === 'Todos') return products;
    return products.filter((product) => product.cat === activeFilter);
  }, [activeFilter, products]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredProducts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const stats = useMemo(
    () => ({
      total: products.length,
      lowStock: products.filter((product) => product.stock > 0 && product.stock <= product.reorder).length,
      outOfStock: products.filter((product) => product.stock === 0).length,
      totalValue: products.reduce((acc, product) => acc + Number(product.price || 0) * product.stock, 0),
    }),
    [products]
  );

  const handleImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleOpenAdd = useCallback(() => {
    setEditingProduct(null);
    setImagePreview(null);
    setSelectedFile(null);
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setImagePreview(product.image || null);
    setSelectedFile(null);
    setIsModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setImagePreview(null);
    setSelectedFile(null);
    setEditingProduct(null);
    setIsSubmitting(false);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);

      try {
        const formData = new FormData(event.currentTarget);
        const productData = new FormData();

        productData.append('name', formData.get('name') as string);
        productData.append('price', String(Number(formData.get('price'))));
        productData.append('cat', formData.get('cat') as string);
        productData.append('sku', (formData.get('sku') as string) || `SKU-${Math.floor(Math.random() * 1000)}`);
        productData.append('stock', String(Number(formData.get('stock'))));
        productData.append('reorder', String(Number(formData.get('reorder'))));

        if (selectedFile) {
          productData.append('image', selectedFile);
        } else if (editingProduct && imagePreview === null) {
          productData.append('removeImage', 'true');
        }

        if (editingProduct) {
          await updateProduct(editingProduct.id, productData);
        } else {
          await addProduct(productData);
        }

        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    },
    [addProduct, editingProduct, handleClose, imagePreview, selectedFile, updateProduct]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!productToDelete) return;
    await deleteProduct(productToDelete.id);
    setProductToDelete(null);
  }, [deleteProduct, productToDelete]);

  const renderProductCard = (product: Product) => (
    <article key={product.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {product.image ? (
            <img src={product.image} className="h-full w-full object-cover" alt={product.name} />
          ) : (
            <span className="material-symbols-outlined text-slate-300">image</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">{product.name}</p>
          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
        </div>
        <span className="text-base font-black text-primary">${Number(product.price || 0).toFixed(2)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{product.cat}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Stock: {product.stock}</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            product.status === 'En Stock'
              ? 'bg-emerald-100 text-emerald-800'
              : product.status === 'Stock Bajo'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {product.status}
        </span>
      </div>

      {isAdmin && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          <button onClick={() => handleOpenEdit(product)} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-bold text-indigo-600">
            Editar
          </button>
          <button onClick={() => setProductToDelete(product)} className="flex-1 rounded-xl bg-red-50 py-2 text-sm font-bold text-red-600">
            Eliminar
          </button>
        </div>
      )}
    </article>
  );

  return (
    <>
      <main className="min-h-screen bg-background pt-20 pb-stack-lg md:pt-24">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-0">
          <div className="mb-stack-lg flex flex-col justify-between gap-stack-md md:flex-row md:items-end">
            <div>
              <h2 className="mb-2 font-headline-lg text-headline-lg font-bold text-on-surface">Inventario de Productos</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">Gestiona suplementos, mercancia y snacks de Spartans Gym.</p>
            </div>
            {isAdmin && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#FF3B30] px-6 py-3 font-bold text-white shadow-md transition-all hover:shadow-lg active:scale-95"
              >
                <span className="material-symbols-outlined">add_box</span>
                Anadir Stock
              </button>
            )}
          </div>

          <div className="mb-stack-lg grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: 'category', label: 'Total Productos', value: stats.total, tone: 'bg-indigo-50 text-indigo-700' },
              { icon: 'warning', label: 'Stock Bajo', value: stats.lowStock, tone: 'bg-amber-50 text-amber-700' },
              { icon: 'dangerous', label: 'Agotados', value: stats.outOfStock, tone: 'bg-red-50 text-red-700' },
              { icon: 'trending_up', label: 'Valor Estimado', value: formatCurrency(stats.totalValue), tone: 'bg-emerald-50 text-emerald-700' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-card border border-[#DADCE0] bg-white p-6 card-shadow">
                <span className={`material-symbols-outlined mb-4 inline-block rounded-lg p-2 ${stat.tone}`}>{stat.icon}</span>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <h3 className="break-words text-4xl font-bold text-slate-900">{stat.value}</h3>
              </div>
            ))}
          </div>

          <div className="mb-stack-lg overflow-hidden rounded-card border border-[#DADCE0] bg-white card-shadow">
            <div className="flex flex-col items-stretch gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-2 overflow-x-auto rounded-lg bg-slate-50 p-1 no-scrollbar">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
                      activeFilter === filter ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-red-600'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-3 lg:hidden">
              {isLoading ? (
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-12 text-center text-sm text-slate-400">Cargando productos...</div>
              ) : error ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-12 text-center text-sm font-semibold text-red-600">{error}</div>
              ) : paginatedProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-12 text-center text-sm text-slate-400">No hay productos en este filtro.</div>
              ) : (
                paginatedProducts.map(renderProductCard)
              )}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Producto</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Categoria</th>
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase text-slate-500">Stock Actual</th>
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase text-slate-500">Precio</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Estado</th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.length > 0 ? (
                    paginatedProducts.map((product) => (
                      <tr key={product.id} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                              {product.image ? <img src={product.image} className="h-full w-full object-cover" alt={product.name} /> : <span className="material-symbols-outlined text-slate-300">image</span>}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{product.name}</p>
                              <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{product.cat}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-900">{product.stock}</td>
                        <td className="px-6 py-4 text-center font-medium text-slate-500">${Number(product.price || 0).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              product.status === 'En Stock'
                                ? 'bg-emerald-100 text-emerald-800'
                                : product.status === 'Stock Bajo'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          {isAdmin ? (
                            <>
                              <button onClick={() => handleOpenEdit(product)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                Editar
                              </button>
                              <button onClick={() => setProductToDelete(product)} className="ml-4 text-sm font-semibold text-red-600 hover:text-red-800">
                                Eliminar
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
                        {isLoading ? 'Cargando productos...' : error || 'No hay productos en este filtro.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>

                <div className="flex flex-wrap items-center justify-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold transition-all ${
                        currentPage === page ? 'bg-red-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>

              <p className="text-center text-sm font-medium text-slate-500 sm:text-right">
                Mostrando <span className="font-bold text-slate-900">{paginatedProducts.length}</span> de{' '}
                <span className="font-bold text-slate-900">{filteredProducts.length}</span> productos
              </p>
            </div>
          </div>
        </div>
      </main>

      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 py-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingProduct ? 'Modifica los campos necesarios' : 'Completa la informacion para agregarlo al inventario'}
                </p>
              </div>
              <button onClick={handleClose} className="rounded-full p-2 transition hover:bg-slate-100">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <form className="space-y-6 px-5 py-6 sm:px-8 sm:py-8" onSubmit={handleSubmit}>
              <div className="grid gap-6 md:grid-cols-12">
                <div className="md:col-span-4">
                  <p className="mb-3 text-xs font-semibold uppercase text-slate-400">Imagen</p>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-slate-300"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-3xl text-slate-300">add_photo_alternate</span>
                        <span className="mt-2 text-xs text-slate-400">Subir imagen</span>
                      </>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                  </div>
                </div>

                <div className="space-y-5 md:col-span-8">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold uppercase text-slate-400">Nombre del producto</label>
                      <input name="name" required type="text" defaultValue={editingProduct?.name || ''} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">Precio ($)</label>
                      <input name="price" required type="number" step="0.01" placeholder="0.00" defaultValue={editingProduct?.price || ''} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none transition focus:bg-white" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">Categoria</label>
                      <select name="cat" defaultValue={editingProduct?.cat || 'Suplementos'} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none">
                        <option value="Suplementos">Suplementos</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Snacks">Snacks</option>
                        <option value="Merchandising">Merchandising</option>
                        <option value="Accesorios">Accesorios</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">SKU</label>
                      <input name="sku" type="text" defaultValue={editingProduct?.sku || ''} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" placeholder="Opcional" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:grid-cols-2 sm:p-6">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">Stock actual</label>
                  <input name="stock" type="number" required defaultValue={editingProduct?.stock || ''} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">Stock minimo</label>
                  <input name="reorder" type="number" defaultValue={editingProduct?.reorder || '5'} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={handleClose} className="rounded-xl px-6 py-3 font-semibold text-slate-600 transition hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[#FF3B30] px-8 py-3 font-semibold text-white shadow-lg transition hover:bg-red-600 active:scale-95 disabled:opacity-50">
                  {isSubmitting ? 'Guardando...' : editingProduct ? 'Actualizar producto' : 'Guardar producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(productToDelete)}
        title="Eliminar producto"
        message={`Se eliminara "${productToDelete?.name || ''}" del inventario. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isLoading}
        onCancel={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
