'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { InfoCard } from '@/components/common/InfoCard';
import { Store } from '@/types';

interface ProductSalesData {
  barcode: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  revenue: number;
}

interface ReportData {
  totalRevenue: number;
  totalOrders: number;
  totalSalesQuantity: number;
  totalCompletedRoutes: number;
  totalPackageCount: number;
  productSales: ProductSalesData[];
}

export function ReportsTable() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<{ imageUrl: string; name: string; x: number; y: number } | null>(null);
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setStartDate(todayStr);
    setEndDate(todayStr);
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      const response = await apiGetPaginated<Store>('/stores', {
        params: { page: 1, limit: 100 },
      });
      setStores((response.data || []).filter((s) => s.isActive));
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchReports = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    try {
      const params: Record<string, string | string[]> = {};
      
      if (selectedStoreIds.length > 0) {
        params.storeIds = selectedStoreIds;
      }
      
      params.startDate = startDate;
      params.endDate = endDate;

      const response = await apiGet<ReportData>('/reports', { params });
      setReportData(response.data);
    } catch {
      console.error('Failed to fetch reports');
    } finally {
      setIsLoading(false);
    }
  }, [selectedStoreIds, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);


  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Filtreler</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative" ref={storeDropdownRef}>
            <label className="block text-xs text-muted-foreground mb-1">Mağazalar</label>
            <button
              type="button"
              onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
              className="w-full px-3 py-2 text-left border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 text-sm flex items-center justify-between"
            >
              <span className="truncate">
                {selectedStoreIds.length === 0
                  ? 'Tüm Mağazalar'
                  : selectedStoreIds.length === stores.length
                  ? 'Tüm Mağazalar'
                  : `${selectedStoreIds.length} Mağaza Seçili`}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isStoreDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isStoreDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-card border border-input rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <label className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStoreIds.length === stores.length && stores.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStoreIds(stores.map((s) => s.id));
                        } else {
                          setSelectedStoreIds([]);
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Tümünü Seç</span>
                  </label>
                  <div className="border-t border-border my-1"></div>
                  {stores.map((store) => (
                    <label
                      key={store.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.includes(store.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStoreIds([...selectedStoreIds, store.id]);
                          } else {
                            setSelectedStoreIds(selectedStoreIds.filter((id) => id !== store.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{store.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card p-6 rounded-xl border border-border shadow-sm animate-pulse">
              <div className="h-4 bg-muted rounded w-24 mb-2"></div>
              <div className="h-8 bg-muted rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InfoCard
            title="Toplam Ciro"
            value={`${Number(reportData?.totalRevenue ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <InfoCard
            title="Toplam Sipariş"
            value={reportData?.totalOrders ?? 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />
          <InfoCard
            title="Toplam Satış Adedi"
            value={reportData?.totalSalesQuantity ?? 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <InfoCard
            title="Toplam Tamamlanan Rota"
            value={reportData?.totalCompletedRoutes ?? 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {!isLoading && reportData && (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Ürün Bazlı Satış Raporu</h3>
          
          {reportData.productSales && reportData.productSales.length > 0 ? (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Resim</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Barkod</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Satış Adedi</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ciro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.productSales.map((product, index) => (
                      <tr key={`${product.barcode}-${index}`} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.productName}
                              className="w-12 h-12 object-contain rounded border border-border cursor-pointer"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredProduct({
                                  imageUrl: product.imageUrl!,
                                  name: product.productName,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top + rect.height / 2,
                                });
                              }}
                              onMouseMove={(e) => {
                                if (hoveredProduct?.imageUrl === product.imageUrl) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredProduct({
                                    imageUrl: product.imageUrl!,
                                    name: product.productName,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top + rect.height / 2,
                                  });
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredProduct(null);
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded border border-border flex items-center justify-center">
                              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">{product.barcode}</td>
                        <td className="py-3 px-4 text-sm">{product.productName}</td>
                        <td className="py-3 px-4 text-sm text-right">{product.quantity.toLocaleString('tr-TR')}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {product.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD VIEW */}
              <div className="md:hidden space-y-4">
                {reportData.productSales.map((product, index) => (
                  <div
                    key={`${product.barcode}-${index}`}
                    className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.productName}
                          className="w-20 h-20 object-contain rounded-lg border border-border flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded-lg border border-border flex items-center justify-center flex-shrink-0">
                          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
                          {product.productName}
                        </h4>
                        <p className="text-xs text-muted-foreground font-mono mb-3">
                          {product.barcode}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Satış Adedi</span>
                            <span className="text-sm font-medium text-foreground mt-0.5">
                              {product.quantity.toLocaleString('tr-TR')}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Ciro</span>
                            <span className="text-sm font-semibold text-foreground mt-0.5">
                              {product.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Seçilen filtreler için ürün satış verisi bulunamadı.</p>
            </div>
          )}
        </div>
      )}

      {hoveredProduct && (
        <div
          className="fixed z-40 pointer-events-none"
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
    </div>
  );
}

