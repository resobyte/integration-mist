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
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
        limit: 10,
        sortBy: sortConfig.sortBy,
        sortOrder: sortConfig.sortOrder,
      };

      if (selectedStoreId) {
        params.storeId = selectedStoreId;
      }

      if (selectedStatus) {
        params.status = selectedStatus;
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
  }, [currentPage, sortConfig, selectedStoreId, selectedStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStoreId, selectedStatus]);

  const handleFetchOrders = async (storeId: string) => {
    setIsFetching(true);
    try {
      await apiPost(`/orders/fetch/${storeId}`, {});
      showSuccess('Siparişler başarıyla çekildi');
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
      const response = await apiPost('/orders/fetch-all', {});
      showSuccess(`Tüm mağazalardan siparişler çekildi. ${response.data.totalStores} mağaza işlendi.`);
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
    { key: 'customerFirstName', label: 'Müşteri' },
    { key: 'totalPrice', label: 'Tutar' },
    { key: 'status', label: 'Durum' },
    { key: 'trendyolStatus', label: 'Trendyol Durumu' },
  ];

  const filteredOrders = searchTerm
    ? orders.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.customerFirstName && order.customerFirstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (order.customerLastName && order.customerLastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (order.customerEmail && order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    : orders;

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

                  return (
                    <>
                      <tr
                        key={order.id}
                        className={`hover:bg-muted/20 transition-colors group cursor-pointer ${isExpanded ? 'bg-muted/10' : ''}`}
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
                            new Date(Number(order.orderDate)).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
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
    </div>
  );
}
