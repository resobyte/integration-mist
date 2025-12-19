'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGet, apiGetPaginated, apiPost, apiDelete } from '@/lib/api';
import { getAccessToken } from '@/lib/token';
import { Route, RouteStatus, Order, Store, Product } from '@/types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { API_URL } from '@/config/api';

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

interface RouteSuggestionProduct {
  barcode: string;
  name: string;
  orderCount: number;
  totalQuantity: number;
}

interface RouteSuggestionOrder {
  id: string;
  orderNumber: string;
  store: { id: string; name: string } | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  products: { barcode: string; name: string; quantity: number }[];
  uniqueProductCount: number;
  totalQuantity: number;
}

interface RouteSuggestion {
  id: string;
  type: 'single_product' | 'mixed' | 'all_singles';
  name: string;
  description: string;
  storeName?: string;
  storeId?: string;
  orderCount: number;
  totalQuantity: number;
  products: RouteSuggestionProduct[];
  orders: RouteSuggestionOrder[];
  priority: number;
}

export function RoutesTable() {
  const { showSuccess, showDanger } = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [statusFilter, setStatusFilter] = useState<RouteStatus[]>([RouteStatus.COLLECTING, RouteStatus.READY]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
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
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RouteSuggestion | null>(null);

  const fetchRoutes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter.length > 0) {
        params.status = statusFilter.join(',');
      }
      const response = await apiGet<Route[]>('/routes', { params });
      setRoutes(response.data || []);
    } catch {
      console.error('Failed to fetch routes');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const fetchPendingOrdersCount = useCallback(async () => {
    try {
      const response = await apiGet<{ count: number }>('/orders/count', { params: { status: 'PENDING' } });
      setPendingOrdersCount(response.data?.count || 0);
    } catch {
      console.error('Failed to fetch pending orders count');
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const response = await apiGet<RouteSuggestion[]>('/routes/suggestions');
      setSuggestions(response.data || []);
    } catch {
      console.error('Failed to fetch suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await apiGetPaginated<Product>('/products', { params: { page, limit: 100 } });
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
      const response = await apiGetPaginated<Store>('/stores', { params: { page: 1, limit: 100 } });
      setStores(response.data || []);
    } catch {
      console.error('Failed to fetch stores');
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchStores();
    fetchSuggestions();
    fetchPendingOrdersCount();
  }, [fetchProducts, fetchStores, fetchSuggestions, fetchPendingOrdersCount]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

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
      setSelectedSuggestion(null);
      fetchRoutes();
      fetchSuggestions();
      fetchPendingOrdersCount();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rota oluşturulurken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSuggestion = (suggestion: RouteSuggestion) => {
    setSelectedSuggestion(suggestion);
    setFormData({
      name: suggestion.name,
      description: suggestion.description,
      selectedOrderIds: suggestion.orders.map((o) => o.id),
    });
    setIsModalOpen(true);
  };

  const handlePrintLabel = async (routeId: string) => {
    try {
      const token = getAccessToken();
      if (!token) {
        showDanger('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }

      const response = await fetch(`${API_URL}/routes/${routeId}/print-label`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
    if (!confirm('Bu rotayı iptal etmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await apiDelete(`/routes/${routeId}`);
      showSuccess('Rota başarıyla iptal edildi');
      fetchRoutes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rota iptal edilirken hata oluştu';
      showDanger(errorMessage);
    }
  };

  const getStatusLabel = (status: RouteStatus) => {
    const labels: Record<RouteStatus, string> = {
      [RouteStatus.COLLECTING]: 'Toplanıyor',
      [RouteStatus.READY]: 'Hazır',
      [RouteStatus.COMPLETED]: 'Tamamlandı',
      [RouteStatus.CANCELLED]: 'İptal Edildi',
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: RouteStatus) => {
    const colors: Record<RouteStatus, string> = {
      [RouteStatus.COLLECTING]: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      [RouteStatus.READY]: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      [RouteStatus.COMPLETED]: 'bg-success/10 text-success border-success/20',
      [RouteStatus.CANCELLED]: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const handleAutoCreateRoute = async () => {
    if (pendingOrdersCount === 0) {
      showDanger('Bekleyen sipariş bulunmuyor');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiGet<any[]>('/routes/filter-orders', { params: { status: 'PENDING' } });
      if (response.data && response.data.length > 0) {
        const orderIds = response.data.map((o) => o.id);
        await apiPost('/routes', {
          name: `Otomatik Rota - ${new Date().toLocaleDateString('tr-TR')}`,
          description: `${response.data.length} bekleyen sipariş için otomatik oluşturuldu`,
          orderIds,
        });
        showSuccess(`${response.data.length} sipariş için rota başarıyla oluşturuldu`);
        fetchRoutes();
        fetchSuggestions();
        fetchPendingOrdersCount();
      } else {
        showDanger('Rota oluşturulacak sipariş bulunamadı');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rota oluşturulurken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Rotalar</h2>
          <p className="text-muted-foreground mt-1">Sipariş rotalarını oluşturun ve yönetin.</p>
        </div>
        <div className="flex gap-2">
          {pendingOrdersCount > 0 && (
            <button
              onClick={handleAutoCreateRoute}
              disabled={isSubmitting}
              className="bg-success hover:bg-success-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Bekleyen Siparişlerden Rota Oluştur ({pendingOrdersCount})
            </button>
          )}
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
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium text-foreground">Durum Filtresi:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={statusFilter.includes(RouteStatus.COLLECTING) && statusFilter.includes(RouteStatus.READY)}
            onChange={(e) => {
              if (e.target.checked) {
                const completed = statusFilter.includes(RouteStatus.COMPLETED) ? [RouteStatus.COMPLETED] : [];
                setStatusFilter([RouteStatus.COLLECTING, RouteStatus.READY, ...completed]);
              } else {
                setStatusFilter(statusFilter.filter((s) => s !== RouteStatus.COLLECTING && s !== RouteStatus.READY));
              }
            }}
            className="rounded border-input"
          />
          <span className="text-sm text-foreground">Toplamada Olanlar</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={statusFilter.includes(RouteStatus.COMPLETED)}
            onChange={(e) => {
              if (e.target.checked) {
                setStatusFilter([...statusFilter, RouteStatus.COMPLETED]);
              } else {
                setStatusFilter(statusFilter.filter((s) => s !== RouteStatus.COMPLETED));
              }
            }}
            className="rounded border-input"
          />
          <span className="text-sm text-foreground">Tamamlananlar</span>
        </label>
        {statusFilter.length > 0 && (
          <button
            onClick={() => setStatusFilter([])}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Filtreyi Temizle
          </button>
        )}
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
                        {route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED && (
                          <button
                            onClick={() => handlePrintLabel(route.id)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Etiket Yazdır
                          </button>
                        )}
                        {route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED && (
                          <button
                            onClick={() => handleDeleteRoute(route.id)}
                            className="text-destructive hover:text-destructive-dark text-sm font-medium"
                          >
                            İptal Et
                          </button>
                        )}
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

      {suggestions.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Rota Önerileri
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Siparişleriniz otomatik olarak gruplandı. Tek tıkla rota oluşturun.
              </p>
            </div>
            <button
              onClick={fetchSuggestions}
              disabled={isLoadingSuggestions}
              className="text-primary hover:text-primary-dark text-sm font-medium flex items-center"
            >
              {isLoadingSuggestions ? (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Yenile
            </button>
          </div>
          <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/10 transition-all cursor-pointer ${
                  suggestion.type === 'all_singles'
                    ? 'border-primary/30 bg-primary/5'
                    : suggestion.type === 'single_product'
                    ? 'border-success/30 bg-success/5'
                    : 'border-secondary/30 bg-secondary/5'
                }`}
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.storeName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
                        {suggestion.storeName}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        suggestion.type === 'all_singles'
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : suggestion.type === 'single_product'
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'bg-secondary/10 text-secondary border border-secondary/20'
                      }`}
                    >
                      {suggestion.type === 'all_singles'
                        ? 'Tüm Tekler'
                        : suggestion.type === 'single_product'
                        ? 'Tek Ürün'
                        : 'Karışık'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">{suggestion.orderCount}</div>
                    <div className="text-xs text-muted-foreground">sipariş</div>
                  </div>
                </div>
                <h4 className="font-semibold text-foreground mb-1 line-clamp-1">{suggestion.name}</h4>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{suggestion.description}</p>
                <div className="space-y-1.5">
                  {suggestion.products.slice(0, 3).map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate max-w-[70%]">{product.name}</span>
                      <span className="text-muted-foreground font-mono">
                        {product.totalQuantity} adet
                      </span>
                    </div>
                  ))}
                  {suggestion.products.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{suggestion.products.length - 3} ürün daha...
                    </div>
                  )}
                </div>
                <button
                  className="mt-4 w-full bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectSuggestion(suggestion);
                  }}
                >
                  Bu Rotayı Oluştur
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
              setSelectedSuggestion(null);
            }
          }}
        >
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                {selectedSuggestion ? 'Önerilen Rotayı Oluştur' : 'Yeni Rota Oluştur'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedSuggestion(null);
                }}
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
                  rows={2}
                />
              </div>

              {selectedSuggestion && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border">
                    <h4 className="text-sm font-semibold text-foreground">
                      Dahil Edilecek Siparişler ({selectedSuggestion.orders.length})
                    </h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-muted/20 sticky top-0">
                        <tr className="text-xs text-muted-foreground uppercase">
                          <th className="px-4 py-2">Sipariş No</th>
                          <th className="px-4 py-2">Müşteri</th>
                          <th className="px-4 py-2">Ürünler</th>
                          <th className="px-4 py-2 text-right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {selectedSuggestion.orders.map((order) => (
                          <tr key={order.id} className="hover:bg-muted/10">
                            <td className="px-4 py-2 text-sm font-medium text-foreground">
                              {order.orderNumber}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {order.customerFirstName} {order.customerLastName}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {order.products.map((p) => p.name).join(', ').substring(0, 30)}
                              {order.products.map((p) => p.name).join(', ').length > 30 ? '...' : ''}
                            </td>
                            <td className="px-4 py-2 text-sm text-foreground text-right font-medium">
                              {order.totalQuantity} adet
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-muted/20 px-4 py-2 border-t border-border flex justify-between">
                    <span className="text-sm text-muted-foreground">Toplam</span>
                    <span className="text-sm font-bold text-foreground">
                      {selectedSuggestion.totalQuantity} adet ürün
                    </span>
                  </div>
                </div>
              )}

              {!selectedSuggestion && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Seçili Siparişler ({formData.selectedOrderIds.length})
                  </label>
                  {formData.selectedOrderIds.length === 0 && (
                    <p className="text-sm text-muted-foreground">Lütfen önce siparişleri filtreleyin veya bir öneri seçin</p>
                  )}
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedSuggestion(null);
                  }}
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
                    `Rota Oluştur (${formData.selectedOrderIds.length} sipariş)`
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

