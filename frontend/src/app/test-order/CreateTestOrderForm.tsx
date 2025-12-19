'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost } from '@/lib/api';
import { Product, Store } from '@/types';

interface OrderLine {
  productId: string;
  productBarcode: string;
  productName: string;
  quantity: number;
}

interface FormData {
  storeId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  addressText: string;
  neighborhood: string;
  district: string;
  city: string;
  postalCode: string;
}

const initialFormData: FormData = {
  storeId: '',
  customerFirstName: 'Reşat',
  customerLastName: 'Akcan',
  customerEmail: 'iresatakcan.bm@gmail.com',
  customerPhone: '0537 475 36 96',
  addressText: 'Çeliktepe Mah. Mzlem Sok. Ç',
  neighborhood: '',
  district: 'Kağıthane',
  city: 'İstanbul',
  postalCode: '34413',
};

export function CreateTestOrderForm() {
  const { showSuccess, showDanger } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedProductBarcode, setSelectedProductBarcode] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const fetchStores = useCallback(async () => {
    try {
      const response = await apiGetPaginated<Store>('/stores', {
        params: { page: 1, limit: 100, isActive: 'true' },
      });
      setStores(response.data);
    } catch {
      console.error('Failed to fetch stores');
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!formData.storeId) {
      setProducts([]);
      return;
    }

    setIsLoading(true);
    try {
      const allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await apiGetPaginated<Product>('/products', {
          params: {
            page,
            limit: 100,
            storeId: formData.storeId,
            isActive: 'true',
          },
        });
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
      console.log('Loaded products:', allProducts.length, allProducts);
      if (allProducts.length === 0) {
        showDanger('Bu mağaza için aktif ürün bulunamadı');
      } else {
        const productsWithBarcode = allProducts.filter((p) => p.barcode);
        if (productsWithBarcode.length === 0) {
          showDanger('Bu mağaza için barkod bilgisi olan ürün bulunamadı');
        }
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
      const errorMessage = error instanceof Error ? error.message : 'Ürünler yüklenirken bir hata oluştu';
      showDanger(errorMessage);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [formData.storeId, showDanger]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((product) => {
    if (!productSearchTerm) return true;
    const searchLower = productSearchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.barcode?.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower)
    );
  });

  const handleAddProduct = () => {
    if (!selectedProductBarcode) {
      showDanger('Lütfen bir ürün seçin');
      return;
    }

    const product = products.find((p) => p.barcode === selectedProductBarcode);
    if (!product) {
      showDanger('Ürün bulunamadı');
      return;
    }

    if (orderLines.some((line) => line.productBarcode === selectedProductBarcode)) {
      showDanger('Bu ürün zaten eklenmiş');
      return;
    }

    setOrderLines([
      ...orderLines,
      {
        productId: product.id,
        productBarcode: product.barcode || '',
        productName: product.name,
        quantity: selectedQuantity,
      },
    ]);

    setSelectedProductBarcode('');
    setSelectedQuantity(1);
    setProductSearchTerm('');
  };

  const handleRemoveProduct = (index: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...orderLines];
    updated[index].quantity = quantity;
    setOrderLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.storeId) {
      showDanger('Lütfen bir mağaza seçin');
      return;
    }

    if (orderLines.length === 0) {
      showDanger('Lütfen en az bir ürün ekleyin');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/orders/test', {
        storeId: formData.storeId,
        customerFirstName: formData.customerFirstName,
        customerLastName: formData.customerLastName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone || undefined,
        addressText: formData.addressText,
        neighborhood: formData.neighborhood || undefined,
        district: formData.district,
        city: formData.city,
        postalCode: formData.postalCode || undefined,
        lines: orderLines.map((line) => ({
          productBarcode: line.productBarcode,
          quantity: line.quantity,
        })),
      });

      showSuccess('Test siparişi başarıyla oluşturuldu');
      setFormData(initialFormData);
      setOrderLines([]);
      setSelectedProductBarcode('');
      setSelectedQuantity(1);
      setProductSearchTerm('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sipariş oluşturulurken bir hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground font-rubik">Test Siparişi Oluştur</h2>
        <p className="text-muted-foreground mt-1">Trendyol test siparişi oluşturun.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
          <h3 className="text-xl font-semibold text-foreground">Mağaza Bilgileri</h3>
          
          <div>
            <label htmlFor="storeId" className="block text-sm font-medium text-foreground mb-2">
              Mağaza *
            </label>
            <select
              id="storeId"
              value={formData.storeId}
              onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Mağaza seçin</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
          <h3 className="text-xl font-semibold text-foreground">Ürünler</h3>

          {formData.storeId && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="productSearch" className="block text-sm font-medium text-foreground mb-2">
                    Ürün Ara
                  </label>
                  <input
                    id="productSearch"
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    placeholder="Ürün adı, barkod veya SKU ile ara..."
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="w-48">
                  <label htmlFor="productBarcode" className="block text-sm font-medium text-foreground mb-2">
                    Ürün Seç *
                  </label>
                  <select
                    id="productBarcode"
                    value={selectedProductBarcode}
                    onChange={(e) => setSelectedProductBarcode(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Ürün seçin ({filteredProducts.filter((p) => p.barcode && !orderLines.some((line) => line.productBarcode === p.barcode)).length} ürün)</option>
                    {filteredProducts
                      .filter((p) => p.barcode && !orderLines.some((line) => line.productBarcode === p.barcode))
                      .map((product) => (
                        <option key={product.id} value={product.barcode || ''}>
                          {product.name} {product.barcode ? `(${product.barcode})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="w-32">
                  <label htmlFor="quantity" className="block text-sm font-medium text-foreground mb-2">
                    Adet *
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Ekle
                  </button>
                </div>
              </div>

              {isLoading && (
                <div className="text-center py-4 text-muted-foreground">Ürünler yükleniyor...</div>
              )}

              {!isLoading && products.length === 0 && formData.storeId && (
                <div className="text-center py-4 text-muted-foreground">
                  Bu mağaza için ürün bulunamadı. Lütfen ürünleri senkronize edin.
                </div>
              )}

              {!isLoading && products.length > 0 && filteredProducts.filter((p) => p.barcode && !orderLines.some((line) => line.productBarcode === p.barcode)).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  Tüm ürünler eklendi veya barkod bilgisi olmayan ürünler var.
                </div>
              )}
            </div>
          )}

          {orderLines.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Eklenen Ürünler</h4>
              <div className="space-y-2">
                {orderLines.map((line, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-md"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{line.productName}</div>
                      <div className="text-sm text-muted-foreground">Barkod: {line.productBarcode}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-foreground">Adet:</label>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10) || 1)}
                          className="w-20 px-2 py-1 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(index)}
                        className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
          <h3 className="text-xl font-semibold text-foreground">Müşteri Bilgileri</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customerFirstName" className="block text-sm font-medium text-foreground mb-2">
                Ad *
              </label>
              <input
                id="customerFirstName"
                type="text"
                value={formData.customerFirstName}
                onChange={(e) => setFormData({ ...formData, customerFirstName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="customerLastName" className="block text-sm font-medium text-foreground mb-2">
                Soyad *
              </label>
              <input
                id="customerLastName"
                type="text"
                value={formData.customerLastName}
                onChange={(e) => setFormData({ ...formData, customerLastName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="customerEmail" className="block text-sm font-medium text-foreground mb-2">
                E-posta *
              </label>
              <input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium text-foreground mb-2">
                Telefon
              </label>
              <input
                id="customerPhone"
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
          <h3 className="text-xl font-semibold text-foreground">Adres Bilgileri</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-foreground mb-2">
                Posta Kodu
              </label>
              <input
                id="postalCode"
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="neighborhood" className="block text-sm font-medium text-foreground mb-2">
                Mahalle
              </label>
              <input
                id="neighborhood"
                type="text"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="addressText" className="block text-sm font-medium text-foreground mb-2">
                Adres *
              </label>
              <input
                id="addressText"
                type="text"
                value={formData.addressText}
                onChange={(e) => setFormData({ ...formData, addressText: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="district" className="block text-sm font-medium text-foreground mb-2">
                İlçe *
              </label>
              <input
                id="district"
                type="text"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-foreground mb-2">
                İl *
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => {
              setFormData(initialFormData);
              setOrderLines([]);
              setSelectedProductBarcode('');
              setSelectedQuantity(1);
              setProductSearchTerm('');
            }}
            className="px-6 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-colors"
          >
            Temizle
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-white text-foreground border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Oluşturuluyor...' : 'Sipariş Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
}

