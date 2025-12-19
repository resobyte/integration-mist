'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Store, PaginationMeta, SortConfig } from '@/types';

interface StoreFormData {
  name: string;
  sellerId: string;
  apiKey: string;
  apiSecret: string;
  description: string;
  isActive: boolean;
}

const initialFormData: StoreFormData = {
  name: '',
  sellerId: '',
  apiKey: '',
  apiSecret: '',
  description: '',
  isActive: true,
};

export function StoresTable() {
  const { showSuccess, showDanger } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'createdAt', sortOrder: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(initialFormData);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStores = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiGetPaginated<Store>('/stores', {
        params: {
          page: currentPage,
          limit: 10,
          sortBy: sortConfig.sortBy,
          sortOrder: sortConfig.sortOrder,
          search: searchTerm || undefined,
        },
      });
      setStores(response.data);
      setPagination(response.meta);
    } catch {
      console.error('Failed to fetch stores');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortConfig, searchTerm]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

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
    return formData.name.trim() !== '';
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const openCreateModal = () => {
    setEditingStore(null);
    setFormData(initialFormData);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      sellerId: store.sellerId ? '****' : '',
      apiKey: store.apiKey ? '****' : '',
      apiSecret: store.apiSecret ? '****' : '',
      description: store.description || '',
      isActive: store.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      const payload: Partial<StoreFormData> = { ...formData };
      
      if (payload.sellerId === '****' || !payload.sellerId) {
        delete payload.sellerId;
      }
      
      if (payload.apiKey === '****' || !payload.apiKey) {
        delete payload.apiKey;
      }
      
      if (payload.apiSecret === '****' || !payload.apiSecret) {
        delete payload.apiSecret;
      }
      
      if (!payload.description) delete payload.description;

      if (editingStore) {
        await apiPatch(`/stores/${editingStore.id}`, payload);
        showSuccess('Mağaza başarıyla güncellendi');
      } else {
        await apiPost('/stores', payload);
        showSuccess('Mağaza başarıyla oluşturuldu');
      }
      setIsModalOpen(false);
      fetchStores();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
      setFormError(errorMessage);
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (store: Store) => {
    if (!confirm(`${store.name} mağazasını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await apiDelete(`/stores/${store.id}`);
      showSuccess('Mağaza başarıyla silindi');
      fetchStores();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Mağaza silinirken hata oluştu';
      showDanger(errorMessage);
    }
  };

  const columns = [
    { key: 'name', label: 'Mağaza Adı' },
    { key: 'sellerId', label: 'Satıcı ID' },
    { key: 'isActive', label: 'Durum' },
    { key: 'createdAt', label: 'Oluşturulma' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Mağazalar</h2>
          <p className="text-muted-foreground mt-1">Mağazaları yönetin ve Trendyol entegrasyonlarını ayarlayın.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95"
        >
          <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Mağaza Ekle
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Mağaza ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-sm"
            />
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
                <th className="px-6 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : stores.length > 0 ? (
                stores.map((store) => (
                  <tr key={store.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{store.name}</div>
                      {store.description && (
                        <div className="text-xs text-muted-foreground mt-1">{store.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {store.sellerId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        store.isActive
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {store.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(store.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(store)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(store)}
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
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    Arama kriterlerinize uygun mağaza bulunamadı.
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
          <div className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                {editingStore ? 'Mağaza Düzenle' : 'Yeni Mağaza Ekle'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mağaza Adı *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Trendyol Satıcı ID</label>
                <input
                  type={editingStore && formData.sellerId === '****' ? 'password' : 'text'}
                  value={formData.sellerId}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (editingStore && formData.sellerId === '****' && newValue.startsWith('****')) {
                      return;
                    }
                    setFormData({ ...formData, sellerId: newValue });
                  }}
                  onFocus={(e) => {
                    if (editingStore && formData.sellerId === '****') {
                      e.target.value = '';
                      setFormData({ ...formData, sellerId: '' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 font-mono"
                  placeholder={editingStore ? "Değiştirmek için yeni değer girin" : "Trendyol satıcı ID'si"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Trendyol API Key</label>
                <input
                  type={editingStore && formData.apiKey === '****' ? 'password' : 'text'}
                  value={formData.apiKey}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (editingStore && formData.apiKey === '****' && newValue.startsWith('****')) {
                      return;
                    }
                    setFormData({ ...formData, apiKey: newValue });
                  }}
                  onFocus={(e) => {
                    if (editingStore && formData.apiKey === '****') {
                      e.target.value = '';
                      setFormData({ ...formData, apiKey: '' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 font-mono"
                  placeholder={editingStore ? "Değiştirmek için yeni değer girin" : "Trendyol API Key"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Trendyol API Secret</label>
                <input
                  type={editingStore && formData.apiSecret === '****' ? 'password' : 'password'}
                  value={formData.apiSecret}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (editingStore && formData.apiSecret === '****' && newValue.startsWith('****')) {
                      return;
                    }
                    setFormData({ ...formData, apiSecret: newValue });
                  }}
                  onFocus={(e) => {
                    if (editingStore && formData.apiSecret === '****') {
                      e.target.value = '';
                      setFormData({ ...formData, apiSecret: '' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 font-mono"
                  placeholder={editingStore ? "Değiştirmek için yeni değer girin" : "Trendyol API Secret"}
                />
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

