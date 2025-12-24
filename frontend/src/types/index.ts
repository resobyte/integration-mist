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

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
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
  senderName: string | null;
  senderAddress: string | null;
  senderCity: string | null;
  senderDistrict: string | null;
  senderPhone: string | null;
  proxyUrl: string | null;
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
  listPrice: number | null;
  taxRate: number;
  description: string | null;
  sku: string | null;
  isActive: boolean;
  trendyolProductId: string | null;
  trendyolProductCode: number | null;
  brand: string | null;
  categoryName: string | null;
  color: string | null;
  size: string | null;
  imageUrl: string | null;
  productUrl: string | null;
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
  agreedDeliveryDate: number | null;
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
  CANCELLED = 'CANCELLED',
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

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: boolean;
  message: string;
  error?: string;
  statusCode: number;
}

export interface PaginationResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

export enum ClaimStatus {
  CREATED = 'Created',
  WAITING_IN_ACTION = 'WaitingInAction',
  WAITING_FRAUD_CHECK = 'WaitingFraudCheck',
  ACCEPTED = 'Accepted',
  CANCELLED = 'Cancelled',
  REJECTED = 'Rejected',
  UNRESOLVED = 'Unresolved',
  IN_ANALYSIS = 'InAnalysis',
}

export interface Claim {
  id: string;
  storeId: string;
  storeName: string | null;
  claimId: string;
  orderNumber: string;
  orderDate: number | string | null;
  claimDate: number | string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  cargoTrackingNumber: string | null;
  cargoTrackingLink: string | null;
  cargoSenderNumber: string | null;
  cargoProviderName: string | null;
  orderShipmentPackageId: number | string | null;
  status: ClaimStatus;
  items: Record<string, unknown>[] | null;
  rejectedPackageInfo: Record<string, unknown> | null;
  replacementOutboundPackageInfo: Record<string, unknown> | null;
  lastModifiedDate: number | string | null;
  orderOutboundPackageId: number | string | null;
  isApproved: boolean;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  storeId: string;
  storeName: string;
  sellerId: string;
  questionId: number;
  customerId: number;
  customerName: string;
  productName: string;
  productMainId: string;
  productImageUrl: string;
  questionText: string;
  status: string;
  creationDate: number;
  answeredDateMessage: string;
  answer: {
    creationDate: number;
    text: string;
    hasPrivateInfo: boolean;
  } | null;
  rejectedAnswer: {
    creationDate: number;
    text: string;
    reason: string;
  } | null;
  rejectedDate: number | null;
  webUrl: string;
  isPublic: boolean;
  showUserName: boolean;
}
