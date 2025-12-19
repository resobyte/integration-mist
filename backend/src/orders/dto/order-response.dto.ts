import { Order, OrderStatus } from '../entities/order.entity';

export class OrderResponseDto {
  id: string;
  storeId: string;
  store?: {
    id: string;
    name: string;
  };
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
  lines: Record<string, unknown>[] | null;
  createdAt: string;
  updatedAt: string;

  static fromEntity(order: Order, includeStore = false): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.storeId = order.storeId;
    if (includeStore && order.store) {
      dto.store = {
        id: order.store.id,
        name: order.store.name,
      };
    }
    dto.orderNumber = order.orderNumber;
    dto.shipmentPackageId = order.shipmentPackageId;
    dto.trendyolStatus = order.trendyolStatus;
    dto.status = order.status;
    dto.customerFirstName = order.customerFirstName;
    dto.customerLastName = order.customerLastName;
    dto.customerEmail = order.customerEmail;
    dto.orderDate = order.orderDate;
    dto.grossAmount = Number(order.grossAmount);
    dto.totalPrice = Number(order.totalPrice);
    dto.currencyCode = order.currencyCode;
    dto.cargoTrackingNumber = order.cargoTrackingNumber;
    dto.cargoProviderName = order.cargoProviderName;
    dto.cargoTrackingLink = order.cargoTrackingLink;
    dto.commercial = order.commercial;
    dto.micro = order.micro;
    dto.deliveryAddressType = order.deliveryAddressType;
    dto.lines = order.lines;
    dto.createdAt = order.createdAt.toISOString();
    dto.updatedAt = order.updatedAt.toISOString();
    return dto;
  }
}

