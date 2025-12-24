'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { InfoCard } from '@/components/common/InfoCard';
import { Store, Product } from '@/types';

interface ReportData {
  totalRevenue: number;
  totalOrders: number;
  totalSalesQuantity: number;
  totalCompletedRoutes: number;
  totalPackageCount: number;
}

export function ReportsTable() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedProductBarcodes, setSelectedProductBarcodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

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

  const fetchProducts = useCallback(async () => {
    try {
      let allProducts: Product[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await apiGetPaginated<Product>('/products', {
          params: { page, limit },
        });
        
        if (response.data && response.data.length > 0) {
          allProducts = [...allProducts, ...response.data];
          page++;
          hasMore = response.data.length === limit && (response.meta?.totalPages || 0) >= page;
        } else {
          hasMore = false;
        }
      }

      setProducts(allProducts.filter((p) => p.isActive && p.barcode));
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, []);

  useEffect(() => {
    fetchStores();
    fetchProducts();
  }, [fetchStores, fetchProducts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
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
      
      if (selectedProductBarcodes.length > 0) {
        params.productBarcodes = selectedProductBarcodes;
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
  }, [selectedStoreIds, selectedProductBarcodes, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);


  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Filtreler</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="relative" ref={productDropdownRef}>
            <label className="block text-xs text-muted-foreground mb-1">Ürünler</label>
            <button
              type="button"
              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              className="w-full px-3 py-2 text-left border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20 text-sm flex items-center justify-between"
            >
              <span className="truncate">
                {selectedProductBarcodes.length === 0
                  ? 'Tüm Ürünler'
                  : selectedProductBarcodes.length === products.length
                  ? 'Tüm Ürünler'
                  : `${selectedProductBarcodes.length} Ürün Seçili`}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isProductDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-card border border-input rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <label className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProductBarcodes.length === products.length && products.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductBarcodes(products.map((p) => p.barcode || '').filter(Boolean));
                        } else {
                          setSelectedProductBarcodes([]);
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Tümünü Seç</span>
                  </label>
                  <div className="border-t border-border my-1"></div>
                  {products.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductBarcodes.includes(product.barcode || '')}
                        onChange={(e) => {
                          const barcode = product.barcode || '';
                          if (e.target.checked) {
                            setSelectedProductBarcodes([...selectedProductBarcodes, barcode]);
                          } else {
                            setSelectedProductBarcodes(selectedProductBarcodes.filter((b) => b !== barcode));
                          }
                        }}
                        className="rounded"
                        disabled={!product.barcode}
                      />
                      <span className="text-sm truncate">
                        {product.barcode || 'Barkod yok'} - {product.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative z-0">
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
    </div>
  );
}

