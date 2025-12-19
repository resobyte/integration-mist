'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost } from '@/lib/api';
import { Claim, ClaimStatus, PaginationMeta, SortConfig } from '@/types';

interface ClaimItem {
  orderLine?: {
    productName?: string;
    barcode?: string;
    merchantSku?: string;
    price?: number;
    productCategory?: string;
  };
  claimItems?: {
    id?: string;
    customerClaimItemReason?: {
      name?: string;
    };
    claimItemStatus?: {
      name?: string;
    };
    customerNote?: string;
  }[];
}

export function ClaimsTable() {
  const { showSuccess, showDanger } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'claimDate', sortOrder: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isApproving, setIsApproving] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiGetPaginated<Claim>('/claims', {
        params: {
          page: currentPage,
          limit: pageSize,
          sortBy: sortConfig.sortBy,
          sortOrder: sortConfig.sortOrder,
        },
      });
      setClaims(response.data);
      setPagination(response.meta);
    } catch {
      console.error('Failed to fetch claims');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, sortConfig]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const extractClaimLineItemIds = (items: Record<string, unknown>[] | null): string[] => {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    const ids: string[] = [];

    for (const item of items) {
      const claimItems = item.claimItems as { id?: string }[] | undefined;
      if (claimItems && Array.isArray(claimItems)) {
        for (const claimItem of claimItems) {
          if (claimItem.id) {
            ids.push(claimItem.id);
          }
        }
      }
    }

    return ids;
  };

  const handleApprove = async (claim: Claim) => {
    if (!confirm(`${claim.orderNumber} numaralı siparişin iadesini onaylamak istediğinize emin misiniz?`)) {
      return;
    }

    const claimLineItemIds = extractClaimLineItemIds(claim.items);

    if (claimLineItemIds.length === 0) {
      showDanger('Onaylanacak iade kalemi bulunamadı');
      return;
    }

    setIsApproving(claim.id);
    try {
      await apiPost('/claims/approve', {
        claimId: claim.claimId,
        storeId: claim.storeId,
        claimLineItemIds,
      });
      showSuccess('İade başarıyla onaylandı');
      fetchClaims();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'İade onaylanırken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsApproving(null);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const getStatusLabel = (status: ClaimStatus) => {
    const labels: Record<ClaimStatus, string> = {
      [ClaimStatus.CREATED]: 'Oluşturuldu',
      [ClaimStatus.WAITING_IN_ACTION]: 'Aksiyon Bekliyor',
      [ClaimStatus.WAITING_FRAUD_CHECK]: 'Kontrol Bekliyor',
      [ClaimStatus.ACCEPTED]: 'Kabul Edildi',
      [ClaimStatus.CANCELLED]: 'İptal Edildi',
      [ClaimStatus.REJECTED]: 'Reddedildi',
      [ClaimStatus.UNRESOLVED]: 'Çözümsüz',
      [ClaimStatus.IN_ANALYSIS]: 'Analizde',
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: ClaimStatus) => {
    const colors: Record<ClaimStatus, string> = {
      [ClaimStatus.CREATED]: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      [ClaimStatus.WAITING_IN_ACTION]: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      [ClaimStatus.WAITING_FRAUD_CHECK]: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      [ClaimStatus.ACCEPTED]: 'bg-success/10 text-success border-success/20',
      [ClaimStatus.CANCELLED]: 'bg-muted text-muted-foreground border-border',
      [ClaimStatus.REJECTED]: 'bg-destructive/10 text-destructive border-destructive/20',
      [ClaimStatus.UNRESOLVED]: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      [ClaimStatus.IN_ANALYSIS]: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const formatDate = (timestamp: number | string | null) => {
    if (!timestamp) return '-';
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(ts)) return '-';
    return new Date(ts).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns = [
    { key: 'orderNumber', label: 'Sipariş No' },
    { key: 'storeName', label: 'Mağaza' },
    { key: 'customerFirstName', label: 'Müşteri' },
    { key: 'status', label: 'Durum' },
    { key: 'claimDate', label: 'İade Tarihi' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">İadeler</h2>
          <p className="text-muted-foreground mt-1">Trendyol iade taleplerini görüntüleyin ve onaylayın.</p>
        </div>
        <button
          onClick={fetchClaims}
          disabled={isLoading}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Yükleniyor...
            </>
          ) : (
            <>
              <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </>
          )}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {pagination && `${pagination.total} iade bulundu`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sayfa başına:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-sm border border-input rounded-md bg-background"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
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
                <th className="px-6 py-3 text-right">İşlemler</th>
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
              ) : claims.length > 0 ? (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{claim.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">{claim.claimId.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {claim.storeName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {`${claim.customerFirstName || ''} ${claim.customerLastName || ''}`.trim() || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(claim.status)}`}>
                        {getStatusLabel(claim.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(claim.claimDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedClaim(claim)}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Detay
                        </button>
                        <button
                          onClick={() => handleApprove(claim)}
                          disabled={isApproving === claim.id}
                          className="text-success hover:text-success-dark text-sm font-medium disabled:opacity-50"
                        >
                          {isApproving === claim.id ? 'Onaylanıyor...' : 'Onayla'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Henüz iade bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
            <div className="text-sm text-muted-foreground">
              Sayfa {pagination.page} / {pagination.totalPages || 1} ({pagination.total} kayıt)
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

      {selectedClaim && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedClaim(null);
            }
          }}
        >
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-border sticky top-0 bg-card">
              <div>
                <h3 className="text-xl font-bold text-foreground">İade Detayı</h3>
                <p className="text-sm text-muted-foreground mt-1">Sipariş No: {selectedClaim.orderNumber}</p>
              </div>
              <button onClick={() => setSelectedClaim(null)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Mağaza</label>
                  <p className="text-sm font-medium text-foreground">{selectedClaim.storeName || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Durum</label>
                  <p className="mt-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(selectedClaim.status)}`}>
                      {getStatusLabel(selectedClaim.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Müşteri</label>
                  <p className="text-sm font-medium text-foreground">
                    {`${selectedClaim.customerFirstName || ''} ${selectedClaim.customerLastName || ''}`.trim() || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">İade Tarihi</label>
                  <p className="text-sm font-medium text-foreground">{formatDate(selectedClaim.claimDate)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Sipariş Tarihi</label>
                  <p className="text-sm font-medium text-foreground">{formatDate(selectedClaim.orderDate)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Kargo</label>
                  <p className="text-sm font-medium text-foreground">{selectedClaim.cargoProviderName || '-'}</p>
                </div>
                {selectedClaim.cargoTrackingNumber && (
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Kargo Takip No</label>
                    <p className="text-sm font-medium text-foreground">{selectedClaim.cargoTrackingNumber}</p>
                  </div>
                )}
              </div>

              {selectedClaim.items && selectedClaim.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">İade Ürünleri</h4>
                  <div className="space-y-3">
                    {selectedClaim.items.map((item: unknown, idx: number) => {
                      const claimItem = item as ClaimItem;
                      return (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {claimItem.orderLine?.productName || 'Ürün'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Barkod: {claimItem.orderLine?.barcode || '-'} | SKU: {claimItem.orderLine?.merchantSku || '-'}
                              </p>
                              {claimItem.claimItems?.[0]?.customerClaimItemReason?.name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  İade Nedeni: {claimItem.claimItems[0].customerClaimItemReason.name}
                                </p>
                              )}
                              {claimItem.claimItems?.[0]?.customerNote && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Müşteri Notu: {claimItem.claimItems[0].customerNote}
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {claimItem.orderLine?.price?.toFixed(2) || '0.00'} TL
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => {
                    handleApprove(selectedClaim);
                    setSelectedClaim(null);
                  }}
                  disabled={isApproving === selectedClaim.id}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-success hover:bg-success-dark rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving === selectedClaim.id ? 'Onaylanıyor...' : 'İadeyi Onayla'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

