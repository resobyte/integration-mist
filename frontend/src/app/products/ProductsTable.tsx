'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost, apiPatch, apiDelete, apiGet } from '@/lib/api';
import { Product, Store, PaginationMeta, SortConfig } from '@/types';

interface ProductFormData {
  storeId: string;
  name: string;
  barcode: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
  description: string;
  sku: string;
  isActive: boolean;
}

const initialFormData: ProductFormData = {
  storeId: '',
  name: '',
  barcode: '',
  stock: 0,
  purchasePrice: 0,
  salePrice: 0,
  taxRate: 0,
  description: '',
  sku: '',
  isActive: true,
};

export function ProductsTable() {
  const { showSuccess, showDanger } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'createdAt', sortOrder: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const fetchStores = useCallback(async () => {
    try {
      const response = await apiGetPaginated<Store>('/stores', {
        params: { page: 1, limit: 100 },
      });
      setStores(response.data);
    } catch {
      console.error('Failed to fetch stores');
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiGetPaginated<Product>('/products', {
        params: {
          page: currentPage,
          limit: 10,
          sortBy: sortConfig.sortBy,
          sortOrder: sortConfig.sortOrder,
          search: searchTerm || undefined,
          storeId: selectedStoreId || undefined,
        },
      });
      setProducts(response.data);
      setPagination(response.meta);
    } catch {
      console.error('Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortConfig, searchTerm, selectedStoreId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  const isFormValid = () => {
    return formData.storeId.trim() !== '' && 
           formData.name.trim() !== '' && 
           formData.stock >= 0;
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(initialFormData);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      storeId: product.storeId,
      name: product.name,
      barcode: product.barcode || '',
      stock: product.stock,
      purchasePrice: product.purchasePrice || 0,
      salePrice: product.salePrice || 0,
      taxRate: product.taxRate,
      description: product.description || '',
      sku: product.sku || '',
      isActive: product.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      const payload: Partial<ProductFormData> = { ...formData };
      if (!payload.barcode) delete payload.barcode;
      if (!payload.description) delete payload.description;
      if (!payload.sku) delete payload.sku;
      if (!payload.purchasePrice) payload.purchasePrice = 0;
      if (!payload.salePrice) payload.salePrice = 0;

      if (editingProduct) {
        await apiPatch(`/products/${editingProduct.id}`, payload);
        showSuccess('Ürün başarıyla güncellendi');
      } else {
        await apiPost('/products', payload);
        showSuccess('Ürün başarıyla oluşturuldu');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
      setFormError(errorMessage);
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`${product.name} ürününü silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await apiDelete(`/products/${product.id}`);
      showSuccess('Ürün başarıyla silindi');
      fetchProducts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ürün silinirken hata oluştu';
      showDanger(errorMessage);
    }
  };

  const columns = [
    { key: 'name', label: 'Ürün Adı' },
    { key: 'barcode', label: 'Barkod' },
    { key: 'stock', label: 'Stok' },
    { key: 'salePrice', label: 'Satış Fiyatı' },
    { key: 'taxRate', label: 'KDV' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Ürünler</h2>
          <p className="text-muted-foreground mt-1">Ürünleri yönetin ve stok takibi yapın.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95"
        >
          <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ürün Ekle
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Ürün ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-sm"
            />
          </div>
          <div className="relative w-full sm:w-64">
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 text-sm"
            >
              <option value="">Tüm Mağazalar</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {columns.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{label}</span>
                      {sortConfig.sortBy === key && (
                        sortConfig.sortOrder === 'ASC' ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3">Mağaza</th>
                <th className="px-6 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{product.name}</div>
                      {product.sku && (
                        <div className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {product.barcode || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        product.stock > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      }`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                      {product.salePrice ? `${Number(product.salePrice).toFixed(2)} ₺` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      %{product.taxRate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {product.store?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Arama kriterlerinize uygun ürün bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
            <div className="text-sm text-muted-foreground">
              {((pagination.page - 1) * pagination.limit) + 1} -{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} /{' '}
              {pagination.total} sonuç gösteriliyor
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Önceki
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mağaza *</label>
                <select
                  required
                  value={formData.storeId}
                  onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value="">Mağaza Seçin</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Ürün Adı *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Barkod</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Stok *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">KDV Oranı (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Alış Fiyatı (₺)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Durum</label>
                <select
                  value={formData.isActive ? 'Aktif' : 'Pasif'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'Aktif' })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
                  {formError}
                </div>
              )}
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid()}
                  className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Kaydet'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

