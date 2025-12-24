'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost } from '@/lib/api';
import { Order, Store, PaginationMeta, SortConfig, OrderStatus } from '@/types';

interface OrderLine {
  barcode?: string;
  productBarcode?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  merchantSku?: string;
  productCode?: string;
  amount?: number;
  discount?: number;
  [key: string]: unknown;
}

interface SkippedOrder {
  orderNumber: string;
  shipmentPackageId: number;
  missingBarcodes: string[];
}

interface FetchResult {
  storeId: string;
  storeName: string;
  saved: number;
  updated: number;
  errors: number;
  skipped: number;
  skippedOrders: SkippedOrder[];
  error?: string;
}

export function OrdersTable() {
  const { showSuccess, showDanger } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'orderDate', sortOrder: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>(OrderStatus.PENDING);
  const [showOverdueOnly, setShowOverdueOnly] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [showSkippedModal, setShowSkippedModal] = useState(false);
  const [fetchResults, setFetchResults] = useState<FetchResult[]>([]);
  const [pageSize, setPageSize] = useState(10);

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

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: pageSize,
        sortBy: sortConfig.sortBy,
        sortOrder: sortConfig.sortOrder,
      };

      if (selectedStoreId) {
        params.storeId = selectedStoreId;
      }

      if (selectedStatus) {
        params.status = selectedStatus;
      }

      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      if (showOverdueOnly) {
        params.overdue = 'true';
      }

      const response = await apiGetPaginated<Order>('/orders', {
        params,
      });
      setOrders(response.data);
      setPagination(response.meta);
    } catch {
      console.error('Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortConfig.sortBy, sortConfig.sortOrder, selectedStoreId, selectedStatus, pageSize, searchTerm, showOverdueOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStoreId, selectedStatus, searchTerm, showOverdueOnly]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Geri sayım için her dakika güncelle
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Her dakika güncelle

    return () => clearInterval(interval);
  }, []);

  const handleFetchOrders = async (storeId: string) => {
    setIsFetching(true);
    try {
      const response = await apiPost<{
        saved: number;
        updated: number;
        errors: number;
        skipped: number;
        skippedOrders: SkippedOrder[];
      }>(`/orders/fetch/${storeId}`, {});

      const result = response.data;
      const store = stores.find((s) => s.id === storeId);

      if (result.skipped > 0) {
        setFetchResults([{
          storeId,
          storeName: store?.name || 'Bilinmeyen Mağaza',
          saved: result.saved,
          updated: result.updated,
          errors: result.errors,
          skipped: result.skipped,
          skippedOrders: result.skippedOrders,
        }]);
        setShowSkippedModal(true);
        showSuccess(`${result.saved} sipariş eklendi, ${result.updated} güncellendi, ${result.skipped} atlanan sipariş var (eksik ürün)`);
      } else {
        showSuccess(`${result.saved} sipariş eklendi, ${result.updated} güncellendi`);
      }
      fetchOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Siparişler çekilirken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsFetching(false);
    }
  };

  const handleFetchAllOrders = async () => {
    setIsFetchingAll(true);
    try {
      const response = await apiPost<{
        totalStores: number;
        results: Array<{
          storeId: string;
          storeName: string;
          initialSync: boolean;
          initialSyncSaved: number;
          trendyolCreatedCount: number;
          dbCreatedCount: number;
          newOrdersAdded: number;
          ordersUpdated: number;
          ordersSkipped: number;
          errors: number;
          error?: string;
        }>;
      }>('/orders/sync-created-all', {});

      const { results } = response.data;
      const hasSkipped = results.some((r) => r.ordersSkipped > 0);
      const totalInitialSync = results.filter((r) => r.initialSync).length;
      const totalInitialSaved = results.reduce((sum, r) => sum + r.initialSyncSaved, 0);
      const totalNew = results.reduce((sum, r) => sum + r.newOrdersAdded, 0);
      const totalUpdated = results.reduce((sum, r) => sum + r.ordersUpdated, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.ordersSkipped, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

      let message = '';
      if (totalInitialSync > 0) {
        message = `${totalInitialSync} mağaza için ilk senkronizasyon yapıldı (${totalInitialSaved} sipariş kaydedildi). `;
      }
      message += `${response.data.totalStores} mağaza işlendi: ${totalNew} yeni eklendi, ${totalUpdated} güncellendi`;
      if (totalSkipped > 0) {
        message += `, ${totalSkipped} atlandı (eksik ürün)`;
      }
      if (totalErrors > 0) {
        message += `, ${totalErrors} hata`;
      }

      if (hasSkipped) {
        const skippedResults = results
          .filter((r) => r.ordersSkipped > 0)
          .map((r) => ({
            storeId: r.storeId,
            storeName: r.storeName,
            saved: r.newOrdersAdded,
            updated: r.ordersUpdated,
            errors: r.errors,
            skipped: r.ordersSkipped,
            skippedOrders: [],
          }));
        setFetchResults(skippedResults);
        setShowSkippedModal(true);
      }

      showSuccess(message);
      fetchOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Siparişler çekilirken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsFetchingAll(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const toggleRowExpansion = (orderId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getStatusBadgeColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      [OrderStatus.PROCESSING]: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      [OrderStatus.COLLECTING]: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      [OrderStatus.PACKED]: 'bg-green-500/10 text-green-600 border-green-500/20',
      [OrderStatus.SHIPPED]: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      [OrderStatus.DELIVERED]: 'bg-success/10 text-success border-success/20',
      [OrderStatus.CANCELLED]: 'bg-destructive/10 text-destructive border-destructive/20',
      [OrderStatus.RETURNED]: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const getStatusLabel = (status: OrderStatus) => {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Beklemede',
      [OrderStatus.PROCESSING]: 'İşleniyor',
      [OrderStatus.COLLECTING]: 'Toplanıyor',
      [OrderStatus.PACKED]: 'Paketlendi',
      [OrderStatus.SHIPPED]: 'Kargoda',
      [OrderStatus.DELIVERED]: 'Teslim Edildi',
      [OrderStatus.CANCELLED]: 'İptal Edildi',
      [OrderStatus.RETURNED]: 'İade Edildi',
    };
    return labels[status] || status;
  };

  const columns = [
    { key: 'expand', label: '' },
    { key: 'orderNumber', label: 'Sipariş No' },
    { key: 'orderDate', label: 'Sipariş Tarihi' },
    { key: 'agreedDeliveryDate', label: 'Kargoya Verme Tarihi' },
    { key: 'customerFirstName', label: 'Müşteri' },
    { key: 'totalPrice', label: 'Tutar' },
    { key: 'status', label: 'Durum' },
    { key: 'trendyolStatus', label: 'Trendyol Durumu' },
  ];

  const filteredOrders = orders;

  const renderOrderLines = (order: Order) => {
    const lines = order.lines as OrderLine[] | null;
    if (!lines || lines.length === 0) {
      return (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Bu siparişte ürün bilgisi bulunmuyor.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
              <th className="px-4 py-2">Sıra</th>
              <th className="px-4 py-2">Ürün Adı</th>
              <th className="px-4 py-2">Barkod</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2 text-right">Miktar</th>
              <th className="px-4 py-2 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {lines.map((line, idx) => {
              const productName = line.productName || line.name || 'Bilinmeyen Ürün';
              const barcode = line.barcode || line.productBarcode || '-';
              const sku = line.merchantSku || line.productCode || '-';
              const quantity = line.quantity || 1;
              const amount = line.amount ? Number(line.amount).toFixed(2) : '-';

              return (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-sm text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-2 text-sm font-medium text-foreground">{productName}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono">{barcode}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{sku}</td>
                  <td className="px-4 py-2 text-sm text-foreground text-right font-medium">{quantity}</td>
                  <td className="px-4 py-2 text-sm text-foreground text-right">{amount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Siparişler</h2>
          <p className="text-muted-foreground mt-1">Trendyol siparişlerini görüntüleyin ve yönetin.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchAllOrders}
            disabled={isFetchingAll}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isFetchingAll ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Çekiliyor...
              </>
            ) : (
              <>
                <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Şimdi Çek
              </>
            )}
          </button>
          {selectedStoreId && (
            <button
              onClick={() => handleFetchOrders(selectedStoreId)}
              disabled={isFetching}
              className="bg-secondary hover:bg-secondary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isFetching ? (
                <>
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Çekiliyor...
                </>
              ) : (
                <>
                  <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                  Seçili Mağazadan Çek
                </>
              )}
            </button>
          )}
        </div>
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
              placeholder="Sipariş ara..."
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
          <div className="relative w-full sm:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | '')}
              className="block w-full pl-3 pr-10 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 text-sm"
            >
              <option value="">Tüm Durumlar</option>
              <option value={OrderStatus.PENDING}>Beklemede</option>
              <option value={OrderStatus.PROCESSING}>İşleniyor</option>
              <option value={OrderStatus.COLLECTING}>Toplanıyor</option>
              <option value={OrderStatus.PACKED}>Paketlendi</option>
              <option value={OrderStatus.SHIPPED}>Kargoda</option>
              <option value={OrderStatus.DELIVERED}>Teslim Edildi</option>
              <option value={OrderStatus.CANCELLED}>İptal Edildi</option>
              <option value={OrderStatus.RETURNED}>İade Edildi</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOverdueOnly}
                onChange={(e) => setShowOverdueOnly(e.target.checked)}
                className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
              />
              <span className="text-sm text-foreground font-medium">Gecikmiş Kargo</span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-3 w-10"></th>
                {columns.slice(1).map(({ key, label }) => (
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
                <th className="px-6 py-3">Kargo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const isExpanded = expandedRows.has(order.id);
                  const hasLines = order.lines && Array.isArray(order.lines) && order.lines.length > 0;

                  // Kargoya verme tarihi geçti mi kontrolü
                  const isDeliveryDatePassed = (() => {
                    if (!order.agreedDeliveryDate || isNaN(Number(order.agreedDeliveryDate))) {
                      return false;
                    }
                    const gmt3Timestamp = Number(order.agreedDeliveryDate);
                    const utcTimestamp = gmt3Timestamp - (3 * 60 * 60 * 1000);
                    const deliveryDate = new Date(utcTimestamp);
                    const now = new Date();
                    // Sadece tarih karşılaştırması (saat bilgisi olmadan)
                    deliveryDate.setHours(0, 0, 0, 0);
                    now.setHours(0, 0, 0, 0);
                    return deliveryDate < now && order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED;
                  })();

                  return (
                    <>
                      <tr
                        key={order.id}
                        className={`hover:bg-muted/20 transition-colors group cursor-pointer ${isExpanded ? 'bg-muted/10' : ''} ${isDeliveryDatePassed ? 'bg-[rgba(128,0,32,0.1)]' : ''}`}
                        onClick={() => toggleRowExpansion(order.id)}
                      >
                        <td className="px-3 py-4">
                          <button
                            className={`p-1 rounded transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(order.id);
                            }}
                          >
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{order.orderNumber}</div>
                          <div className="text-xs text-muted-foreground mt-1">#{order.shipmentPackageId}</div>
                          {hasLines && (
                            <div className="text-xs text-primary mt-1">
                              {(order.lines as OrderLine[]).length} ürün
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {order.orderDate && !isNaN(Number(order.orderDate)) ? (
                            (() => {
                              // orderDate GMT+3 formatında timestamp (milliseconds) olarak gelir
                              // JavaScript Date UTC olarak yorumlar, GMT+3 offset'ini (3 saat = 10800000 ms) çıkarıyoruz
                              const gmt3Timestamp = Number(order.orderDate);
                              const utcTimestamp = gmt3Timestamp - (3 * 60 * 60 * 1000);
                              const date = new Date(utcTimestamp);
                              return date.toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Istanbul',
                              });
                            })()
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {order.agreedDeliveryDate && !isNaN(Number(order.agreedDeliveryDate)) ? (
                            (() => {
                              // agreedDeliveryDate GMT+3 formatında timestamp (milliseconds) olarak gelir
                              const gmt3Timestamp = Number(order.agreedDeliveryDate);
                              const utcTimestamp = gmt3Timestamp - (3 * 60 * 60 * 1000);
                              const deliveryDate = new Date(utcTimestamp);
                              const now = new Date(currentTime);
                              const diff = deliveryDate.getTime() - now.getTime();

                              if (diff < 0) {
                                // Tarih geçmiş
                                return (
                                  <span className="text-red-600 font-medium">Geciken kargo</span>
                                );
                              } else {
                                // Geri sayım
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                
                                const parts = [];
                                if (days > 0) parts.push(`${String(days).padStart(2, '0')} gün`);
                                if (hours > 0 || days > 0) parts.push(`${String(hours).padStart(2, '0')} saat`);
                                parts.push(`${String(minutes).padStart(2, '0')} dakika`);
                                
                                return (
                                  <span className="text-muted-foreground">{parts.join(' ')}</span>
                                );
                              }
                            })()
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">
                            {order.customerFirstName} {order.customerLastName}
                          </div>
                          {order.customerEmail && (
                            <div className="text-xs text-muted-foreground mt-1">{order.customerEmail}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                          {Number(order.totalPrice).toFixed(2)} {order.currencyCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                            {order.trendyolStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {order.store?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.cargoTrackingNumber ? (
                            <div className="flex flex-col">
                              <span className="text-sm text-foreground font-medium">{order.cargoTrackingNumber}</span>
                              {order.cargoProviderName && (
                                <span className="text-xs text-muted-foreground">{order.cargoProviderName}</span>
                              )}
                              {order.cargoTrackingLink && (
                                <a
                                  href={order.cargoTrackingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Takip Et
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${order.id}-expanded`}>
                          <td colSpan={9} className="px-6 py-4 bg-muted/5 border-b border-border">
                            <div className="rounded-lg border border-border bg-card overflow-hidden">
                              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                                <h4 className="text-sm font-semibold text-foreground">
                                  Sipariş Detayları - {order.orderNumber}_{order.shipmentPackageId}
                                </h4>
                              </div>
                              {renderOrderLines(order)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                    {searchTerm ? 'Arama kriterlerinize uygun sipariş bulunamadı.' : 'Henüz sipariş bulunmuyor.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {pagination.total > 0 ? (
                  <>
                    {((pagination.page - 1) * pagination.limit) + 1} -{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} /{' '}
                    {pagination.total} sonuç
                  </>
                ) : (
                  '0 sonuç'
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sayfa başına:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 text-sm border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Önceki
                </button>
                <span className="px-3 py-2 text-sm text-muted-foreground">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sonraki
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showSkippedModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSkippedModal(false)}
            />
            <div className="relative bg-card rounded-xl border border-border shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Atlanan Siparişler</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aşağıdaki siparişler, sistemde kayıtlı olmayan ürünler içerdiği için atlandı.
                  </p>
                </div>
                <button
                  onClick={() => setShowSkippedModal(false)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-6">
                  {fetchResults.map((result, idx) => (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-muted/20 border-b border-border">
                        <h4 className="font-medium text-foreground">{result.storeName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {result.saved} eklendi, {result.updated} güncellendi, {result.skipped} atlandı
                        </p>
                      </div>
                      <div className="divide-y divide-border">
                        {result.skippedOrders.map((order, orderIdx) => (
                          <div key={orderIdx} className="px-4 py-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-medium text-foreground">
                                  Sipariş: {order.orderNumber}
                                </span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  (Paket: {order.shipmentPackageId})
                                </span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <span className="text-sm text-muted-foreground">Eksik barkodlar:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {order.missingBarcodes.map((barcode, barcodeIdx) => (
                                  <span
                                    key={barcodeIdx}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-destructive/10 text-destructive border border-destructive/20"
                                  >
                                    {barcode}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h5 className="font-medium text-amber-700">Ürünleri Ekleyin</h5>
                      <p className="text-sm text-amber-600 mt-1">
                        Bu siparişlerin kaydedilmesi için önce eksik barkodlara sahip ürünleri <strong>Ürünler</strong> sayfasından eklemeniz gerekiyor.
                        Ürünler eklendikten sonra siparişleri tekrar çektiğinizde otomatik olarak kaydedilecektir.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end px-6 py-4 border-t border-border bg-muted/10">
                <button
                  onClick={() => setShowSkippedModal(false)}
                  className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg shadow-md transition-all"
                >
                  Anladım
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
