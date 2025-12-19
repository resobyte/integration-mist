'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Route, RouteStatus, Order, Store, Product } from '@/types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface RouteFormData {
  name: string;
  description: string;
  selectedOrderIds: string[];
}

interface FilterData {
  productIds: string[];
  quantities: number[];
  storeId: string;
  status: string;
}

export function RoutesTable() {
  const { showSuccess, showDanger } = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [formData, setFormData] = useState<RouteFormData>({
    name: '',
    description: '',
    selectedOrderIds: [],
  });
  const [filterData, setFilterData] = useState<FilterData>({
    productIds: [],
    quantities: [],
    storeId: '',
    status: '',
  });
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    fetchRoutes();
    fetchProducts();
    fetchStores();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isModalOpen || isFilterModalOpen)) {
        setIsModalOpen(false);
        setIsFilterModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, isFilterModalOpen]);

  const fetchRoutes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiGet<{ success: boolean; data: Route[] }>('/routes');
      setRoutes(response.data || []);
    } catch {
      console.error('Failed to fetch routes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await apiGet<{ success: boolean; data: Product[]; meta: any }>(`/products?page=${page}&limit=100`);
        if (response && response.data) {
          allProducts.push(...response.data);
          if (response.meta && page >= response.meta.totalPages) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setProducts(allProducts);
    } catch (error) {
      console.error('Failed to fetch products', error);
      setProducts([]);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      const response = await apiGet<{ success: boolean; data: Store[]; meta: any }>('/stores?page=1&limit=100');
      setStores(response.data || []);
    } catch {
      console.error('Failed to fetch stores');
    }
  }, []);

  const handleFilterOrders = async () => {
    setIsFiltering(true);
    try {
      const params: any = {};
      if (filterData.productIds.length > 0) {
        const barcodes = filterData.productIds
          .map((productId) => {
            const product = products.find((p) => p.id === productId);
            return product?.barcode;
          })
          .filter((barcode): barcode is string => Boolean(barcode));
        if (barcodes.length > 0) {
          params.productIds = barcodes;
        }
      }
      if (filterData.quantities.length > 0) params.quantities = filterData.quantities;
      if (filterData.storeId) params.storeId = filterData.storeId;
      if (filterData.status) params.status = filterData.status;

      const response = await apiGet<any[]>('/routes/filter-orders', { params });
      setFilteredOrders(response.data || []);
      setIsFilterModalOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Filtreleme sırasında hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleCreateRoute = async () => {
    if (!formData.name || formData.selectedOrderIds.length === 0) {
      showDanger('Lütfen rota adı girin ve en az bir sipariş seçin');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/routes', {
        name: formData.name,
        description: formData.description || undefined,
        orderIds: formData.selectedOrderIds,
      });
      showSuccess('Rota başarıyla oluşturuldu');
      setIsModalOpen(false);
      setFormData({ name: '', description: '', selectedOrderIds: [] });
      setFilteredOrders([]);
      fetchRoutes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rota oluşturulurken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintLabel = async (routeId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/routes/${routeId}/print-label`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Etiket yazdırma başarısız');
      }

      const html = await response.text();
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }

      showSuccess('Etiket başarıyla indirildi');
      fetchRoutes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Etiket yazdırma sırasında hata oluştu';
      showDanger(errorMessage);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('Bu rotayı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await apiDelete(`/routes/${routeId}`);
      showSuccess('Rota başarıyla silindi');
      fetchRoutes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rota silinirken hata oluştu';
      showDanger(errorMessage);
    }
  };

  const getStatusLabel = (status: RouteStatus) => {
    const labels: Record<RouteStatus, string> = {
      [RouteStatus.COLLECTING]: 'Toplanıyor',
      [RouteStatus.READY]: 'Hazır',
      [RouteStatus.COMPLETED]: 'Tamamlandı',
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: RouteStatus) => {
    const colors: Record<RouteStatus, string> = {
      [RouteStatus.COLLECTING]: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      [RouteStatus.READY]: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      [RouteStatus.COMPLETED]: 'bg-success/10 text-success border-success/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Rotalar</h2>
          <p className="text-muted-foreground mt-1">Sipariş rotalarını oluşturun ve yönetin.</p>
        </div>
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Rota Oluştur
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-3">Rota Adı</th>
                <th className="px-6 py-3">Durum</th>
                <th className="px-6 py-3">Sipariş Sayısı</th>
                <th className="px-6 py-3">Oluşturulma</th>
                <th className="px-6 py-3">Etiket Yazdırma</th>
                <th className="px-6 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : routes.length > 0 ? (
                routes.map((route) => (
                  <tr key={route.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{route.name}</div>
                      {route.description && (
                        <div className="text-xs text-muted-foreground mt-1">{route.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(route.status)}`}>
                        {getStatusLabel(route.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{route.orderCount || 0}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(route.createdAt), 'dd.MM.yyyy HH:mm', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {route.labelPrintedAt
                        ? format(new Date(route.labelPrintedAt), 'dd.MM.yyyy HH:mm', { locale: tr })
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedRoute(route)}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Detay
                        </button>
                        {route.status !== RouteStatus.COMPLETED && (
                          <button
                            onClick={() => handlePrintLabel(route.id)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Etiket Yazdır
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRoute(route.id)}
                          className="text-destructive hover:text-destructive-dark text-sm font-medium"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Henüz rota bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFilterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFilterModalOpen(false);
          }}
        >
          <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">Sipariş Filtrele</h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mağaza</label>
                <select
                  value={filterData.storeId}
                  onChange={(e) => setFilterData({ ...filterData, storeId: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value="">Tüm Mağazalar</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Durum</label>
                <select
                  value={filterData.status}
                  onChange={(e) => setFilterData({ ...filterData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="PENDING">Beklemede</option>
                  <option value="PROCESSING">İşleniyor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Ürünler</label>
                <div className="max-h-40 overflow-y-auto border border-input rounded-lg p-2">
                  {products.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2 text-center">
                      Ürün bulunamadı
                    </div>
                  ) : (
                    products.map((product) => (
                      <label key={product.id} className="flex items-center space-x-2 py-1 hover:bg-muted/20 rounded px-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterData.productIds.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterData({
                                ...filterData,
                                productIds: [...filterData.productIds, product.id],
                              });
                            } else {
                              setFilterData({
                                ...filterData,
                                productIds: filterData.productIds.filter((id) => id !== product.id),
                              });
                            }
                          }}
                          className="rounded border-input cursor-pointer"
                        />
                        <span className="text-sm text-foreground">{product.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Miktarlar</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((qty) => (
                    <label key={qty} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={filterData.quantities.includes(qty)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterData({
                              ...filterData,
                              quantities: [...filterData.quantities, qty],
                            });
                          } else {
                            setFilterData({
                              ...filterData,
                              quantities: filterData.quantities.filter((q) => q !== qty),
                            });
                          }
                        }}
                        className="rounded border-input"
                      />
                      <span className="text-sm text-foreground">{qty}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleFilterOrders}
                  disabled={isFiltering}
                  className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isFiltering ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Filtrele'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredOrders.length > 0 && !isModalOpen && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">
              Filtrelenmiş Siparişler ({filteredOrders.length})
            </h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Rota Oluştur
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                  <th className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={formData.selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            selectedOrderIds: filteredOrders.map((o) => o.id),
                          });
                        } else {
                          setFormData({ ...formData, selectedOrderIds: [] });
                        }
                      }}
                      className="rounded border-input"
                    />
                  </th>
                  <th className="px-6 py-3">Sipariş No</th>
                  <th className="px-6 py-3">Mağaza</th>
                  <th className="px-6 py-3">Müşteri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={formData.selectedOrderIds.includes(order.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              selectedOrderIds: [...formData.selectedOrderIds, order.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selectedOrderIds: formData.selectedOrderIds.filter((id) => id !== order.id),
                            });
                          }
                        }}
                        className="rounded border-input"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{order.orderNumber}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{order.store?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {order.customerFirstName} {order.customerLastName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">Yeni Rota Oluştur</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateRoute();
              }}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Rota Adı *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
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
                <label className="block text-sm font-medium text-foreground mb-1">
                  Seçili Siparişler ({formData.selectedOrderIds.length})
                </label>
                {formData.selectedOrderIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">Lütfen önce siparişleri filtreleyin</p>
                )}
              </div>
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
                  disabled={isSubmitting || !formData.name || formData.selectedOrderIds.length === 0}
                  className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Oluştur'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRoute && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRoute(null);
          }}
        >
          <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">Rota Detayları: {selectedRoute.name}</h3>
              <button
                onClick={() => setSelectedRoute(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Siparişler ({selectedRoute.orders.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                          <th className="px-4 py-2">Sipariş No</th>
                          <th className="px-4 py-2">Mağaza</th>
                          <th className="px-4 py-2">Müşteri</th>
                          <th className="px-4 py-2">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedRoute.orders.map((order) => (
                          <tr key={order.id}>
                            <td className="px-4 py-2 text-sm text-foreground">{order.orderNumber}</td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">{order.store?.name || '-'}</td>
                            <td className="px-4 py-2 text-sm text-foreground">
                              {order.customerFirstName} {order.customerLastName}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">{order.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Ürünler</h4>
                  <div className="space-y-4">
                    {selectedRoute.orders.map((order) => {
                      if (!order.lines || order.lines.length === 0) return null;
                      
                      return (
                        <div key={order.id} className="border border-border rounded-lg p-4">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Sipariş: {order.orderNumber}
                          </div>
                          <div className="space-y-2">
                            {order.lines.map((line, idx) => {
                              const lineBarcode = line.barcode || line.productBarcode;
                              const product = lineBarcode 
                                ? products.find((p) => p.barcode === lineBarcode)
                                : null;
                              const productName = product?.name || line.productName || line.name || 'Bilinmeyen Ürün';
                              const quantity = line.quantity || 1;
                              const barcode = lineBarcode || product?.barcode || '-';
                              
                              return (
                                <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-foreground">{productName}</div>
                                    <div className="text-xs text-muted-foreground">Barkod: {barcode}</div>
                                  </div>
                                  <div className="text-sm font-semibold text-foreground ml-4">
                                    {quantity}x
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {selectedRoute.orders.every((order) => !order.lines || order.lines.length === 0) && (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        Bu rotada ürün bilgisi bulunmuyor.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

