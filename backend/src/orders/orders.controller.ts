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

  @Post('sync-created-all')
  @HttpCode(HttpStatus.OK)
  async syncAllStoresCreatedOrders() {
    const result = await this.ordersService.syncAllStoresCreatedOrders();
    const totalInitialSync = result.results.filter((r) => r.initialSync).length;
    const totalInitialSaved = result.results.reduce((sum, r) => sum + r.initialSyncSaved, 0);
    const totalNew = result.results.reduce((sum, r) => sum + r.newOrdersAdded, 0);
    const totalUpdated = result.results.reduce((sum, r) => sum + r.ordersUpdated, 0);
    const totalSkipped = result.results.reduce((sum, r) => sum + r.ordersSkipped, 0);
    const totalErrors = result.results.reduce((sum, r) => sum + r.errors, 0);
    
    let message = '';
    if (totalInitialSync > 0) {
      message = `${totalInitialSync} mağaza için ilk senkronizasyon yapıldı (${totalInitialSaved} sipariş kaydedildi). `;
    }
    message += `${result.totalStores} mağaza işlendi: ${totalNew} yeni eklendi, ${totalUpdated} güncellendi, ${totalSkipped} atlandı, ${totalErrors} hata`;
    
    return {
      success: true,
      message,
      data: result,
    };
  }

  @Post('sync-created/:storeId')
  @HttpCode(HttpStatus.OK)
  async syncCreatedOrders(@Param('storeId') storeId: string) {
    const result = await this.ordersService.syncCreatedOrders(storeId);
    let message = '';
    if (result.initialSync) {
      message = `Initial sync completed. Saved ${result.initialSyncSaved} orders with all statuses. `;
    }
    message += `CREATED orders synced. Trendyol: ${result.trendyolCreatedCount}, DB: ${result.dbCreatedCount}, New: ${result.newOrdersAdded}, Updated: ${result.ordersUpdated}, Skipped: ${result.ordersSkipped}, Errors: ${result.errors}`;
    return {
      success: true,
      message,
      data: result,
    };
  }

  @Post('sync/:storeId')
  @HttpCode(HttpStatus.OK)
  async syncExistingOrders(
    @Param('storeId') storeId: string,
    @Query('status') status?: string,
  ) {
    const orderStatus = status && Object.values(OrderStatus).includes(status as OrderStatus) 
      ? (status as OrderStatus) 
      : undefined;
    const result = await this.ordersService.syncExistingOrders(storeId, orderStatus);
    return {
      success: true,
      message: `Orders synced successfully. Total: ${result.total}, Updated: ${result.updated}, Not Found: ${result.notFound}, Errors: ${result.errors}`,
      data: result,
    };
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
  ) {
    const paginationDto: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      sortBy,
      sortOrder: sortOrder || 'DESC',
    };
    const orderStatus = status && Object.values(OrderStatus).includes(status as OrderStatus) 
      ? (status as OrderStatus) 
      : undefined;
    return this.ordersService.findAll(paginationDto, storeId, orderStatus);
  }

  @Get('count')
  async getCount(@Query('status') status?: string) {
    const orderStatus = status && Object.values(OrderStatus).includes(status as OrderStatus) 
      ? (status as OrderStatus) 
      : undefined;
    const count = await this.ordersService.getCount(orderStatus);
    return {
      success: true,
      data: { count },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return {
      success: true,
      data: await this.ordersService.findOne(id),
    };
  }
}
