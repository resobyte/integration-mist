import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductFilterDto } from './dto/product-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_OWNER)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('sync/:storeId')
  @HttpCode(HttpStatus.OK)
  async syncProducts(@Param('storeId', ParseUUIDPipe) storeId: string) {
    const result = await this.productsService.syncProductsFromTrendyol(storeId);
    return {
      success: true,
      message: `Products synced successfully. Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors}`,
      data: result,
    };
  }

  @Post('sync-all')
  @HttpCode(HttpStatus.OK)
  async syncAllProducts() {
    const result = await this.productsService.syncAllStoresProducts();
    const totalCreated = result.results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = result.results.reduce((sum, r) => sum + r.updated, 0);
    return {
      success: true,
      message: `Products synced for all stores. Total: ${result.totalStores} stores. Created: ${totalCreated}, Updated: ${totalUpdated}`,
      data: result,
    };
  }

  @Get()
  findAll(@Query() filterDto: ProductFilterDto) {
    const isActiveBoolean = filterDto.isActive === undefined ? undefined : filterDto.isActive === 'true';
    return this.productsService.findAll(filterDto, filterDto.search, filterDto.storeId, isActiveBoolean);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }
}

