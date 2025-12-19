import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { OrdersService } from './orders.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { OrderStatus } from './entities/order.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_OWNER)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('fetch/:storeId')
  @HttpCode(HttpStatus.OK)
  async fetchOrders(@Param('storeId') storeId: string) {
    const result = await this.ordersService.fetchAndSaveOrders(storeId);
    return {
      success: true,
      message: `Orders fetched successfully. Saved: ${result.saved}, Updated: ${result.updated}, Errors: ${result.errors}`,
      data: result,
    };
  }

  @Post('fetch-all')
  @HttpCode(HttpStatus.OK)
  async fetchAllOrders() {
    const result = await this.ordersService.fetchAllStoresOrders();
    return {
      success: true,
      message: `Orders fetched for all stores. Total: ${result.totalStores} stores processed.`,
      data: result,
    };
  }

  @Get()
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('storeId') storeId?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.findAll(paginationDto, storeId, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return {
      success: true,
      data: await this.ordersService.findOne(id),
    };
  }
}
