'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGet, apiGetPaginated, apiPost, apiDelete } from '@/lib/api';
import { getAccessToken } from '@/lib/token';
import { Route, RouteStatus, Order, Store, Product } from '@/types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { API_URL } from '@/config/api';
import * as XLSX from 'xlsx';

interface RouteFormData {
  name: string;
  description: string;
  selectedOrderIds: string[];
}

interface FilterData {
  productBarcodes: string[];
  brand?: string;
  type?: string;
  storeId?: string;
  minOrderCount?: number;
  maxOrderCount?: number;
  minTotalQuantity?: number;
  maxTotalQuantity?: number;
  overdue?: boolean;
  search?: string;
}

interface RouteSuggestionProduct {
  barcode: string;
  name: string;
  orderCount: number;
  totalQuantity: number;
  imageUrl: string | null;
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
  type: 'single_product' | 'single_product_multi' | 'mixed';
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
  const [routesPagination, setRoutesPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [statusFilter, setStatusFilter] = useState<RouteStatus[]>([RouteStatus.COLLECTING, RouteStatus.READY]);
  const [formData, setFormData] = useState<RouteFormData>({
    name: '',
    description: '',
    selectedOrderIds: [],
  });
  const [filterData, setFilterData] = useState<FilterData>({
    productBarcodes: [],
    brand: undefined,
    type: undefined,
    storeId: undefined,
    minOrderCount: undefined,
    maxOrderCount: undefined,
    minTotalQuantity: undefined,
    maxTotalQuantity: undefined,
    overdue: false,
    search: undefined,
  });
  const [filterProductSearch, setFilterProductSearch] = useState('');
  const [isFilterProductDropdownOpen, setIsFilterProductDropdownOpen] = useState(false);
  const [isFilteredOrdersCollapsed, setIsFilteredOrdersCollapsed] = useState(false);
  const [isSuggestionsCollapsed, setIsSuggestionsCollapsed] = useState(false);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RouteSuggestion | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [suggestionFilters, setSuggestionFilters] = useState<{
    type: string | undefined;
    productBarcodes: string[];
    storeId?: string;
    minOrderCount?: number;
    maxOrderCount?: number;
    minTotalQuantity?: number;
    maxTotalQuantity?: number;
    overdue?: boolean;
  }>({
    type: undefined,
    productBarcodes: [],
    storeId: undefined,
    minOrderCount: undefined,
    maxOrderCount: undefined,
    minTotalQuantity: undefined,
    maxTotalQuantity: undefined,
    overdue: false,
  });
  const [suggestionPagination, setSuggestionPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [suggestionSort, setSuggestionSort] = useState<{
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  }>({
    sortBy: 'priority',
    sortOrder: 'DESC',
  });
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<{ imageUrl: string; name: string; x: number; y: number } | null>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFilterProductDropdownOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setIsFilterProductDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterProductDropdownOpen]);

  const fetchRoutes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: routesPagination.page,
        limit: routesPagination.limit,
      };
      if (statusFilter.length > 0) {
        params.status = statusFilter.join(',');
      }
      const response = await apiGetPaginated<Route>('/routes', { params });
      setRoutes(response.data || []);
      if (response.meta) {
        setRoutesPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
        });
      }
    } catch {
      console.error('Failed to fetch routes');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, routesPagination.page, routesPagination.limit]);


  const fetchSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const params: any = {
        page: suggestionPagination.page,
        limit: suggestionPagination.limit,
        sortBy: suggestionSort.sortBy,
        sortOrder: suggestionSort.sortOrder,
      };
      if (suggestionFilters.type) {
        params.type = suggestionFilters.type;
      }
      if (suggestionFilters.productBarcodes.length > 0) {
        params.productBarcodes = suggestionFilters.productBarcodes.join(',');
      }
      if (suggestionFilters.storeId) {
        params.storeId = suggestionFilters.storeId;
      }
      if (suggestionFilters.minOrderCount !== undefined) {
        params.minOrderCount = suggestionFilters.minOrderCount;
      }
      if (suggestionFilters.maxOrderCount !== undefined) {
        params.maxOrderCount = suggestionFilters.maxOrderCount;
      }
      if (suggestionFilters.minTotalQuantity !== undefined) {
        params.minTotalQuantity = suggestionFilters.minTotalQuantity;
      }
      if (suggestionFilters.maxTotalQuantity !== undefined) {
        params.maxTotalQuantity = suggestionFilters.maxTotalQuantity;
      }
      if (suggestionFilters.overdue) {
        params.overdue = 'true';
      }
      const response = await apiGetPaginated<RouteSuggestion>('/routes/suggestions', { params });
      setSuggestions(response.data || []);
      if (response.meta) {
        setSuggestionPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
        });
      }
    } catch {
      console.error('Failed to fetch suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [suggestionPagination.page, suggestionPagination.limit, suggestionSort, suggestionFilters]);

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
  }, [fetchProducts, fetchStores]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          closeCreateModal();
        } else if (isFilterModalOpen) {
          setIsFilterModalOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, isFilterModalOpen]);

  const handleFilterOrders = async () => {
    setIsFiltering(true);
    try {
      const params: any = {};
      if (filterData.productBarcodes.length > 0) {
        params.productBarcodes = filterData.productBarcodes.join(',');
      }
      if (filterData.brand) {
        params.brand = filterData.brand;
      }
      if (filterData.type) {
        params.type = filterData.type;
      }
      if (filterData.storeId) {
        params.storeId = filterData.storeId;
      }
      if (filterData.minOrderCount !== undefined) {
        params.minOrderCount = filterData.minOrderCount;
      }
      if (filterData.maxOrderCount !== undefined) {
        params.maxOrderCount = filterData.maxOrderCount;
      }
      if (filterData.minTotalQuantity !== undefined) {
        params.minTotalQuantity = filterData.minTotalQuantity;
      }
      if (filterData.maxTotalQuantity !== undefined) {
        params.maxTotalQuantity = filterData.maxTotalQuantity;
      }
      if (filterData.overdue) {
        params.overdue = 'true';
      }
      if (filterData.search && filterData.search.trim()) {
        params.search = filterData.search.trim();
      }

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
      const response = await apiPost<{ data: Route }>('/routes', {
        name: formData.name,
        description: formData.description || undefined,
        orderIds: formData.selectedOrderIds,
      });

      const createdRoute = response.data;
      showSuccess('Rota başarıyla oluşturuldu');

      if (createdRoute?.data?.id) {
        await handlePrintLabel(createdRoute.data.id);
      }

      setIsModalOpen(false);
      setFormData({ name: '', description: '', selectedOrderIds: [] });
      setFilteredOrders([]);
      setSelectedSuggestion(null);
      fetchRoutes();
      fetchSuggestions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rota oluşturulurken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setSelectedSuggestion(null);
    setFormData({ name: '', description: '', selectedOrderIds: [] });
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
      
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          URL.revokeObjectURL(url);
        };
      } else {
        URL.revokeObjectURL(url);
        throw new Error('Popup engelleyici aktif. Lütfen popup engelleyiciyi kapatıp tekrar deneyin.');
      }

      showSuccess('Etiket başarıyla açıldı');
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

  const getSuggestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      single_product: 'Tekli',
      single_product_multi: 'Tek Ürün Çoklu',
      mixed: 'Çoklu Ürün',
    };
    return labels[type] || type;
  };

  const getSuggestionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      single_product: 'bg-success/10 text-success border-success/20',
      single_product_multi: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      mixed: 'bg-secondary/10 text-secondary border-secondary/20',
    };
    return colors[type] || 'bg-muted text-muted-foreground border-border';
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (sortBy: string) => {
    setSuggestionSort((prev) => ({
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC',
    }));
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Rotalar</h2>
          <p className="text-muted-foreground mt-1">Sipariş rotalarını oluşturun ve yönetin.</p>
        </div>
        <div className="flex gap-2">
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
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedRoute(route)}
                          className="text-primary hover:text-primary-dark text-sm font-medium flex items-center transition-colors group"
                        >
                          <svg className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Detay
                        </button>
                        {route.status !== RouteStatus.CANCELLED && (
                          <button
                            onClick={() => handlePrintLabel(route.id)}
                            className={`text-sm font-medium flex items-center transition-colors group ${
                              route.status === RouteStatus.COMPLETED
                                ? 'text-orange-600 hover:text-orange-700'
                                : 'text-blue-600 hover:text-blue-700'
                            }`}
                          >
                            <svg className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            {route.status === RouteStatus.COMPLETED ? 'Etiketi Yeniden Yazdır' : 'Etiket Yazdır'}
                          </button>
                        )}
                        {route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED && (
                          <button
                            onClick={() => handleDeleteRoute(route.id)}
                            className="text-destructive hover:text-destructive-dark text-sm font-medium flex items-center transition-colors group"
                          >
                            <svg className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Toplam {routesPagination.total} rota{routesPagination.totalPages > 1 && `, Sayfa ${routesPagination.page} / ${routesPagination.totalPages}`}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Sayfa başına:</label>
              <select
                value={routesPagination.limit}
                onChange={(e) => {
                  setRoutesPagination({
                    ...routesPagination,
                    limit: parseInt(e.target.value, 10),
                    page: 1,
                  });
                }}
                className="px-2 py-1 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            {routesPagination.totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (routesPagination.page > 1) {
                      setRoutesPagination({ ...routesPagination, page: routesPagination.page - 1 });
                    }
                  }}
                  disabled={routesPagination.page === 1}
                  className="px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Önceki
                </button>
                <button
                  onClick={() => {
                    if (routesPagination.page < routesPagination.totalPages) {
                      setRoutesPagination({ ...routesPagination, page: routesPagination.page + 1 });
                    }
                  }}
                  disabled={routesPagination.page === routesPagination.totalPages}
                  className="px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sonraki
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isModalOpen && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsFilteredOrdersCollapsed(!isFilteredOrdersCollapsed)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isFilteredOrdersCollapsed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              <h3 className="text-base font-semibold text-foreground">
                Filtrelenmiş Siparişler ({filteredOrders.length})
              </h3>
            </div>
            {filteredOrders.length > 0 && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Rota Oluştur
              </button>
            )}
          </div>
          {!isFilteredOrdersCollapsed && (
            <>
              {filteredOrders.length > 0 ? (
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3 w-12">
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
                    <th className="px-6 py-3">Ürünler</th>
                    <th className="px-6 py-3">Sipariş Sayısı</th>
                    <th className="px-6 py-3">Toplam Adet</th>
                    <th className="px-6 py-3">Tip</th>
                    <th className="px-6 py-3">Mağaza</th>
                    <th className="px-6 py-3">Sipariş No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((order) => {
                  const orderLines = order.lines || [];
                  const uniqueProducts = new Set(
                    orderLines.map((line: any) => line.barcode || line.productBarcode).filter(Boolean)
                  );
                  const totalQuantity = orderLines.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0);
                  
                  let orderType: 'single_product' | 'single_product_multi' | 'mixed' = 'single_product';
                  if (uniqueProducts.size === 1) {
                    const hasMultiQuantity = orderLines.some((line: any) => (line.quantity || 0) > 1);
                    orderType = hasMultiQuantity ? 'single_product_multi' : 'single_product';
                  } else if (uniqueProducts.size > 1) {
                    orderType = 'mixed';
                  }

                  const orderProducts = Array.from(uniqueProducts).map((barcode) => {
                    const barcodeStr = String(barcode);
                    const product = products.find((p) => p.barcode === barcodeStr);
                    const line = orderLines.find((l: any) => (l.barcode || l.productBarcode) === barcodeStr);
                    const quantity = line ? (line.quantity || 0) : 0;
                    return {
                      barcode: barcodeStr,
                      name: product?.name || barcodeStr,
                      imageUrl: product?.imageUrl || null,
                      totalQuantity: quantity,
                      orderCount: 1,
                    };
                  });

                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
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
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2 flex-wrap">
                          {orderProducts.slice(0, 4).map((product, idx) => (
                            <div
                              key={idx}
                              className="relative"
                              onMouseEnter={(e) => {
                                if (product.imageUrl) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredProduct({
                                    imageUrl: product.imageUrl,
                                    name: product.name,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top,
                                  });
                                }
                              }}
                              onMouseMove={(e) => {
                                if (product.imageUrl && hoveredProduct?.imageUrl === product.imageUrl) {
                                  setHoveredProduct({
                                    imageUrl: product.imageUrl,
                                    name: product.name,
                                    x: e.clientX,
                                    y: e.currentTarget.getBoundingClientRect().top,
                                  });
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredProduct(null);
                              }}
                            >
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-14 h-14 rounded border border-border object-contain bg-muted/20 cursor-pointer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-14 h-14 rounded border border-border bg-muted/50 flex items-center justify-center">
                                  <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                </div>
                              )}
                              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center leading-none shadow-md">
                                ×{product.orderCount > 0 ? Math.round(product.totalQuantity / product.orderCount) : product.totalQuantity}
                              </span>
                            </div>
                          ))}
                          {orderProducts.length > 4 && (
                            <div className="w-14 h-14 rounded border border-border bg-muted/30 flex items-center justify-center text-xs font-medium text-muted-foreground">
                              +{orderProducts.length - 4}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground align-middle">1</td>
                      <td className="px-6 py-4 text-sm text-foreground align-middle">{totalQuantity}</td>
                      <td className="px-6 py-4 align-middle">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${getSuggestionTypeColor(orderType)}`}>
                          {getSuggestionTypeLabel(orderType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground align-middle">{order.store?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-foreground align-middle">{order.orderNumber}</td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
              </div>
              ) : (
                <div className="px-6 py-8 text-center text-muted-foreground">
                  Bu filtreye uygun sipariş bulunamadı.
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSuggestionsCollapsed(!isSuggestionsCollapsed)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSuggestionsCollapsed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              <h3 className="text-base font-semibold text-foreground">Rota Önerileri</h3>
            </div>
            <button
              onClick={fetchSuggestions}
              disabled={isLoadingSuggestions}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-dark transition-colors"
            >
              {isLoadingSuggestions ? (
                <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Yenile
                </>
              )}
            </button>
          </div>
        </div>

        {!isSuggestionsCollapsed && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-3 p-4">
                <div>
              <label className="block text-xs text-muted-foreground mb-2">Rota Tipi</label>
              <select
                value={suggestionFilters.type ?? ''}
                onChange={(e) => {
                  setSuggestionFilters({
                    ...suggestionFilters,
                    type: e.target.value || undefined,
                  });
                }}
                className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-[38px]"
              >
                <option value="">Tümü</option>
                <option value="single_product">Tekli Ürün</option>
                <option value="single_product_multi">Tek Ürün Çoklu</option>
                <option value="mixed">Çok Ürün Çoklu</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Mağaza</label>
              <select
                value={suggestionFilters.storeId || ''}
                onChange={(e) => {
                  setSuggestionFilters({
                    ...suggestionFilters,
                    storeId: e.target.value || undefined,
                  });
                }}
                className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-[38px]"
              >
                <option value="">Tümü</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Ürün</label>
              <div className="relative">
                <div 
                  className="flex flex-wrap gap-1.5 p-2 border border-input rounded bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors cursor-pointer h-[38px] overflow-y-auto"
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                >
                  {suggestionFilters.productBarcodes.length === 0 ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-2 flex-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Ürün ara...
                    </span>
                  ) : (
                    <>
                      {suggestionFilters.productBarcodes.map((barcode) => {
                        const product = products.find((p) => p.barcode === barcode);
                        if (!product) return null;
                        return (
                          <span
                            key={barcode}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {product.name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSuggestionFilters({
                                  ...suggestionFilters,
                                  productBarcodes: suggestionFilters.productBarcodes.filter((b) => b !== barcode),
                                });
                              }}
                              className="hover:text-destructive transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSuggestionFilters({
                            ...suggestionFilters,
                            productBarcodes: [],
                          });
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground px-1 transition-colors"
                      >
                        Temizle
                      </button>
                    </>
                  )}
                </div>
                {isProductDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsProductDropdownOpen(false)}
                    />
                    <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-border sticky top-0 bg-card">
                        <input
                          type="text"
                          placeholder="Ürün adı veya barkod ara..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-56">
                        {products
                          .filter((product) =>
                            product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            (product.barcode && product.barcode.toLowerCase().includes(productSearch.toLowerCase()))
                          )
                          .map((product) => {
                            const productBarcode = product.barcode || '';
                            const isSelected = productBarcode && suggestionFilters.productBarcodes.includes(productBarcode);
                            return (
                              <label
                                key={product.id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!isSelected}
                                  onChange={(e) => {
                                    if (!productBarcode) return;
                                    if (e.target.checked) {
                                      setSuggestionFilters({
                                        ...suggestionFilters,
                                        productBarcodes: [...suggestionFilters.productBarcodes, productBarcode],
                                      });
                                    } else {
                                      setSuggestionFilters({
                                        ...suggestionFilters,
                                        productBarcodes: suggestionFilters.productBarcodes.filter((b) => b !== productBarcode),
                                      });
                                    }
                                  }}
                                  className="rounded border-input cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-foreground truncate font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{product.barcode || '-'}</div>
                                </div>
                              </label>
                            );
                          })}
                        {products.filter(
                          (product) =>
                            product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            (product.barcode && product.barcode.toLowerCase().includes(productSearch.toLowerCase()))
                        ).length === 0 && (
                          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                            Ürün bulunamadı
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Sipariş Sayısı</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={suggestionFilters.minOrderCount || ''}
                  onChange={(e) => {
                    setSuggestionFilters({
                      ...suggestionFilters,
                      minOrderCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    });
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-[38px]"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={suggestionFilters.maxOrderCount || ''}
                  onChange={(e) => {
                    setSuggestionFilters({
                      ...suggestionFilters,
                      maxOrderCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    });
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-[38px]"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Toplam Adet</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={suggestionFilters.minTotalQuantity || ''}
                  onChange={(e) => {
                    setSuggestionFilters({
                      ...suggestionFilters,
                      minTotalQuantity: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    });
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-[38px]"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={suggestionFilters.maxTotalQuantity || ''}
                  onChange={(e) => {
                    setSuggestionFilters({
                      ...suggestionFilters,
                      maxTotalQuantity: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    });
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-[38px]"
                  min="0"
                />
              </div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={suggestionFilters.overdue || false}
                  onChange={(e) => {
                    setSuggestionFilters({
                      ...suggestionFilters,
                      overdue: e.target.checked,
                    });
                  }}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                />
                <span className="text-xs text-foreground font-medium">Gecikmiş Kargo</span>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-3 w-12"></th>
                <th className="px-6 py-3">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Ürünler
                    {suggestionSort.sortBy === 'name' && (
                      <span>{suggestionSort.sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button
                    onClick={() => handleSort('orderCount')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Sipariş Sayısı
                    {suggestionSort.sortBy === 'orderCount' && (
                      <span>{suggestionSort.sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button
                    onClick={() => handleSort('totalQuantity')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Toplam Adet
                    {suggestionSort.sortBy === 'totalQuantity' && (
                      <span>{suggestionSort.sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button
                    onClick={() => handleSort('type')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Tip
                    {suggestionSort.sortBy === 'type' && (
                      <span>{suggestionSort.sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3">Mağaza</th>
                <th className="px-6 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingSuggestions ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <>
                    <tr
                      key={suggestion.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(suggestion.id)}
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(suggestion.id);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expandedRows.has(suggestion.id) ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2 flex-wrap">
                          {suggestion.products.map((product, idx) => (
                            <div
                              key={idx}
                              className="relative"
                              onMouseEnter={(e) => {
                                if (product.imageUrl) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredProduct({
                                    imageUrl: product.imageUrl,
                                    name: product.name,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top,
                                  });
                                }
                              }}
                              onMouseMove={(e) => {
                                if (product.imageUrl && hoveredProduct?.imageUrl === product.imageUrl) {
                                  setHoveredProduct({
                                    imageUrl: product.imageUrl,
                                    name: product.name,
                                    x: e.clientX,
                                    y: e.currentTarget.getBoundingClientRect().top,
                                  });
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredProduct(null);
                              }}
                            >
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-14 h-14 rounded border border-border object-contain bg-muted/20 cursor-pointer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-14 h-14 rounded border border-border bg-muted/50 flex items-center justify-center">
                                  <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                </div>
                              )}
                              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center leading-none shadow-md">
                                ×{product.orderCount > 0 ? Math.round(product.totalQuantity / product.orderCount) : product.totalQuantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground align-middle">{suggestion.orderCount}</td>
                      <td className="px-6 py-4 text-sm text-foreground align-middle">{suggestion.totalQuantity}</td>
                      <td className="px-6 py-4 align-middle">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${getSuggestionTypeColor(suggestion.type)}`}>
                          {getSuggestionTypeLabel(suggestion.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground align-middle">{suggestion.storeName || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSuggestion(suggestion);
                          }}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Rota Oluştur
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(suggestion.id) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-muted/5">
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-foreground">
                                  Ürünler ({suggestion.products.length})
                                </h4>
                                <div className="text-xs text-muted-foreground">
                                  Toplam: <span className="font-medium text-foreground">{suggestion.totalQuantity} adet</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                {suggestion.products.map((product, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-card rounded border border-border p-3"
                                  >
                                    <div className="text-sm font-medium text-foreground mb-1 line-clamp-1">
                                      {product.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono mb-2">
                                      {product.barcode}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-foreground">
                                        <span className="font-medium">{product.totalQuantity}</span> adet
                                      </span>
                                      <span className="text-muted-foreground">
                                        {product.orderCount} sipariş
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-foreground mb-3">
                                Siparişler ({suggestion.orders.length})
                              </h4>
                              <div className="max-h-48 overflow-y-auto border border-border rounded">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead className="bg-muted/30 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-muted-foreground font-medium">Sipariş No</th>
                                      <th className="px-3 py-2 text-muted-foreground font-medium">Müşteri</th>
                                      <th className="px-3 py-2 text-muted-foreground font-medium">Ürünler</th>
                                      <th className="px-3 py-2 text-muted-foreground font-medium text-right">Toplam</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50">
                                    {suggestion.orders.map((order) => (
                                      <tr key={order.id} className="hover:bg-muted/10">
                                        <td className="px-3 py-2 text-foreground">{order.orderNumber}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {order.customerFirstName} {order.customerLastName}
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="flex flex-wrap gap-1">
                                            {order.products.map((p, pIdx) => (
                                              <span
                                                key={pIdx}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 text-xs text-foreground"
                                              >
                                                <span>{p.name}</span>
                                                <span className="text-muted-foreground">×{p.quantity}</span>
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-foreground text-right font-medium">
                                          {order.totalQuantity} adet
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Rota önerisi bulunamadı.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Toplam {suggestionPagination.total} öneri{suggestionPagination.totalPages > 1 && `, Sayfa ${suggestionPagination.page} / ${suggestionPagination.totalPages}`}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Sayfa başına:</label>
                    <select
                      value={suggestionPagination.limit}
                      onChange={(e) => {
                        setSuggestionPagination({
                          ...suggestionPagination,
                          limit: parseInt(e.target.value, 10),
                          page: 1,
                        });
                      }}
                      className="px-2 py-1 text-xs border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  {suggestionPagination.totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (suggestionPagination.page > 1) {
                            setSuggestionPagination({ ...suggestionPagination, page: suggestionPagination.page - 1 });
                          }
                        }}
                        disabled={suggestionPagination.page === 1}
                        className="px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Önceki
                      </button>
                      <button
                        onClick={() => {
                          if (suggestionPagination.page < suggestionPagination.totalPages) {
                            setSuggestionPagination({ ...suggestionPagination, page: suggestionPagination.page + 1 });
                          }
                        }}
                        disabled={suggestionPagination.page === suggestionPagination.totalPages}
                        className="px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Sonraki
                      </button>
                    </div>
                  )}
            </div>
          </div>
        </>
      )}
    </div>
      {hoveredProduct && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${Math.min(Math.max(hoveredProduct.x, 150), window.innerWidth - 150)}px`,
            top: `${Math.max(hoveredProduct.y - 320, 10)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-card border border-border rounded-lg shadow-2xl p-3 w-[300px]">
            <img
              src={hoveredProduct.imageUrl}
              alt={hoveredProduct.name}
              className="w-full h-[280px] object-contain rounded bg-muted/10"
            />
            <div className="mt-2 text-xs text-center text-foreground font-medium truncate">
              {hoveredProduct.name}
            </div>
          </div>
        </div>
      )}

      {isFilterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
                  setIsFilterModalOpen(false);
                  setFilterData({
                    productBarcodes: [],
                    brand: undefined,
                    type: undefined,
                    storeId: undefined,
                    minOrderCount: undefined,
                    maxOrderCount: undefined,
                    minTotalQuantity: undefined,
                    maxTotalQuantity: undefined,
                    overdue: false,
                    search: undefined,
                  });
            }
          }}
        >
          <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">Sipariş Filtrele</h3>
              <button
                onClick={() => {
                  setIsFilterModalOpen(false);
                    setFilterData({
                      productBarcodes: [],
                      type: undefined,
                      storeId: undefined,
                      minOrderCount: undefined,
                      maxOrderCount: undefined,
                      minTotalQuantity: undefined,
                      maxTotalQuantity: undefined,
                      overdue: false,
                    });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="border-b border-border pb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Excel'den Sipariş Numaraları Yükle
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Excel dosyasında A kolonunda sipariş numaraları olmalıdır. Her satırda bir sipariş numarası.
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                      const data = await file.arrayBuffer();
                      const workbook = XLSX.read(data, { type: 'array' });
                      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

                      const orderNumbers: string[] = [];
                      for (const row of jsonData) {
                        if (Array.isArray(row) && row[0]) {
                          const orderNumber = String(row[0]).trim();
                          if (orderNumber) {
                            orderNumbers.push(orderNumber);
                          }
                        }
                      }

                      if (orderNumbers.length === 0) {
                        showDanger('Excel dosyasında A kolonunda sipariş numarası bulunamadı');
                        return;
                      }

                      const response = await apiPost<any[]>('/routes/find-by-order-numbers', {
                        orderNumbers,
                      });

                      const foundOrders = response.data || [];
                      
                      if (foundOrders.length === 0) {
                        showDanger('Hiçbir sipariş bulunamadı');
                        return;
                      }

                      const existingOrderIds = new Set(filteredOrders.map((o) => o.id));
                      const newOrders = foundOrders.filter((o) => !existingOrderIds.has(o.id));
                      
                      if (newOrders.length === 0) {
                        showSuccess('Tüm siparişler zaten listede');
                        return;
                      }

                      setFilteredOrders([...filteredOrders, ...newOrders]);
                      showSuccess(`${newOrders.length} sipariş eklendi. Toplam ${orderNumbers.length} sipariş numarasından ${foundOrders.length} tanesi bulundu.`);
                      setIsFilterModalOpen(false);
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Excel okuma sırasında hata oluştu';
                      showDanger(errorMessage);
                    }

                    e.target.value = '';
                  }}
                  className="hidden"
                  id="excel-upload"
                />
                <label
                  htmlFor="excel-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark cursor-pointer transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Excel Dosyası Yükle
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sipariş Ara (Sipariş No veya Müşteri Adı)
                </label>
                <input
                  type="text"
                  value={filterData.search || ''}
                  onChange={(e) => {
                    setFilterData({
                      ...filterData,
                      search: e.target.value || undefined,
                    });
                  }}
                  placeholder="Sipariş numarası veya müşteri adı girin..."
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tip</label>
                <select
                  value={filterData.type || ''}
                  onChange={(e) => {
                    setFilterData({
                      ...filterData,
                      type: e.target.value || undefined,
                    });
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value="">Tümü</option>
                  <option value="single_product">Tekli Ürün</option>
                  <option value="single_product_multi">Tek Ürün Çoklu</option>
                  <option value="mixed">Çok Ürün Çoklu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mağaza</label>
                <select
                  value={filterData.storeId || ''}
                  onChange={(e) => {
                    setFilterData({
                      ...filterData,
                      storeId: e.target.value || undefined,
                    });
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value="">Tümü</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Ürünler</label>
                <div className="relative">
                  <div
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-primary min-h-[38px] flex flex-wrap gap-1 items-center cursor-text"
                    onClick={() => setIsFilterProductDropdownOpen(!isFilterProductDropdownOpen)}
                  >
                    {filterData.productBarcodes.length === 0 ? (
                      <input
                        type="text"
                        placeholder="Ürün ara..."
                        value={filterProductSearch}
                        onChange={(e) => {
                          setFilterProductSearch(e.target.value);
                          setIsFilterProductDropdownOpen(true);
                        }}
                        onFocus={() => setIsFilterProductDropdownOpen(true)}
                        className="flex-1 outline-none bg-transparent text-sm"
                      />
                    ) : (
                      <>
                        {filterData.productBarcodes.map((barcode) => {
                          const product = products.find((p) => p.barcode === barcode);
                          if (!product) return null;
                          return (
                            <span
                              key={barcode}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium"
                            >
                              {product.name}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilterData({
                                    ...filterData,
                                    productBarcodes: filterData.productBarcodes.filter((b) => b !== barcode),
                                  });
                                }}
                                className="hover:bg-primary/20 rounded"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        <input
                          type="text"
                          placeholder="Ürün ara..."
                          value={filterProductSearch}
                          onChange={(e) => {
                            setFilterProductSearch(e.target.value);
                            setIsFilterProductDropdownOpen(true);
                          }}
                          onFocus={() => setIsFilterProductDropdownOpen(true)}
                          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
                        />
                      </>
                    )}
                  </div>
                  {isFilterProductDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      <div className="p-2">
                        {products
                          .filter((product) =>
                            product.name.toLowerCase().includes(filterProductSearch.toLowerCase()) ||
                            (product.barcode && product.barcode.toLowerCase().includes(filterProductSearch.toLowerCase()))
                          )
                          .map((product) => {
                            const productBarcode = product.barcode || '';
                            const isSelected = productBarcode && filterData.productBarcodes.includes(productBarcode);
                            return (
                              <label
                                key={product.id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!isSelected}
                                  onChange={(e) => {
                                    if (!productBarcode) return;
                                    if (e.target.checked) {
                                      setFilterData({
                                        ...filterData,
                                        productBarcodes: [...filterData.productBarcodes, productBarcode],
                                      });
                                    } else {
                                      setFilterData({
                                        ...filterData,
                                        productBarcodes: filterData.productBarcodes.filter((b) => b !== productBarcode),
                                      });
                                    }
                                  }}
                                  className="rounded border-input cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-foreground truncate font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{product.barcode || '-'}</div>
                                </div>
                              </label>
                            );
                          })}
                        {products.filter(
                          (product) =>
                            product.name.toLowerCase().includes(filterProductSearch.toLowerCase()) ||
                            (product.barcode && product.barcode.toLowerCase().includes(filterProductSearch.toLowerCase()))
                        ).length === 0 && (
                          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                            Ürün bulunamadı
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Sipariş Sayısı (Min)</label>
                  <input
                    type="number"
                    value={filterData.minOrderCount || ''}
                    onChange={(e) => {
                      setFilterData({
                        ...filterData,
                        minOrderCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      });
                    }}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Sipariş Sayısı (Max)</label>
                  <input
                    type="number"
                    value={filterData.maxOrderCount || ''}
                    onChange={(e) => {
                      setFilterData({
                        ...filterData,
                        maxOrderCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      });
                    }}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Toplam Adet (Min)</label>
                  <input
                    type="number"
                    value={filterData.minTotalQuantity || ''}
                    onChange={(e) => {
                      setFilterData({
                        ...filterData,
                        minTotalQuantity: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      });
                    }}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Toplam Adet (Max)</label>
                  <input
                    type="number"
                    value={filterData.maxTotalQuantity || ''}
                    onChange={(e) => {
                      setFilterData({
                        ...filterData,
                        maxTotalQuantity: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      });
                    }}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                    min="0"
                  />
                </div>
              </div>
              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterData.overdue || false}
                    onChange={(e) => {
                      setFilterData({
                        ...filterData,
                        overdue: e.target.checked,
                      });
                    }}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="text-sm text-foreground font-medium">Gecikmiş Kargo</span>
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterModalOpen(false);
                    setFilterData({
                      productBarcodes: [],
                      brand: undefined,
                      type: undefined,
                      storeId: undefined,
                      minOrderCount: undefined,
                      maxOrderCount: undefined,
                      minTotalQuantity: undefined,
                      maxTotalQuantity: undefined,
                      overdue: false,
                      search: undefined,
                    });
                  }}
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

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                {selectedSuggestion ? 'Önerilen Rotayı Oluştur' : 'Yeni Rota Oluştur'}
              </h3>
              <button
                onClick={closeCreateModal}
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
                  onClick={closeCreateModal}
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

