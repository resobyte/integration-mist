import { Route, RouteStatus } from '../entities/route.entity';
import { OrderResponseDto } from '../../orders/dto/order-response.dto';

export class RouteResponseDto {
  id: string;
  name: string;
  description: string | null;
  status: RouteStatus;
  orders: OrderResponseDto[];
  orderCount: number;
  labelPrintedAt: string | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: Route, includeOrders: boolean = false): RouteResponseDto {
    const dto = new RouteResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.labelPrintedAt = entity.labelPrintedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    
    if (includeOrders && entity.orders) {
      dto.orders = entity.orders.map((order) => OrderResponseDto.fromEntity(order, true));
      dto.orderCount = entity.orders.length;
    } else {
      dto.orders = [];
      dto.orderCount = 0;
    }
    
    return dto;
  }
}






