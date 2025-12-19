export enum Role {
  PLATFORM_OWNER = 'PLATFORM_OWNER',
  OPERATION = 'OPERATION',
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  sellerId: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  token: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  store?: Store;
  name: string;
  barcode: string | null;
  stock: number;
  purchasePrice: number | null;
  salePrice: number | null;
  taxRate: number;
  description: string | null;
  sku: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COLLECTING = 'COLLECTING',
  PACKED = 'PACKED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export interface Order {
  id: string;
  storeId: string;
  store?: Store;
  orderNumber: string;
  shipmentPackageId: number;
  trendyolStatus: string;
  status: OrderStatus;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  orderDate: number;
  grossAmount: number;
  totalPrice: number;
  currencyCode: string;
  cargoTrackingNumber: string | null;
  cargoProviderName: string | null;
  cargoTrackingLink: string | null;
  commercial: boolean;
  micro: boolean;
  deliveryAddressType: string | null;
  lines?: Array<{
    productId?: string;
    barcode?: string;
    quantity?: number;
    productName?: string;
    name?: string;
    productBarcode?: string;
    [key: string]: unknown;
  }> | null;
  createdAt: string;
  updatedAt: string;
}

export enum RouteStatus {
  COLLECTING = 'COLLECTING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
}

export interface Route {
  id: string;
  name: string;
  description: string | null;
  status: RouteStatus;
  orders: Order[];
  orderCount: number;
  labelPrintedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface SortConfig {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface RouteConfig {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  showInSidebar: boolean;
}
