import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Res,
  ParseArrayPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteFilterDto } from './dto/route-filter.dto';
import { RouteStatus } from './entities/route.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_OWNER)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  create(@Body() createRouteDto: CreateRouteDto) {
    return this.routesService.create(createRouteDto);
  }

  @Get()
  findAll(@Query('status', new ParseArrayPipe({ items: String, optional: true, separator: ',' })) status?: string[]) {
    const routeStatuses = status?.map((s) => s as RouteStatus).filter((s) => Object.values(RouteStatus).includes(s));
    return this.routesService.findAll(routeStatuses);
  }

  @Get('filter-orders')
  getFilteredOrders(
    @Query('productIds', new ParseArrayPipe({ items: String, optional: true }))
    productIds?: string[],
    @Query('quantities', new ParseArrayPipe({ items: Number, optional: true }))
    quantities?: number[],
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
  ) {
    const filter: RouteFilterDto = {
      productIds,
      quantities,
      storeId,
      status,
    };
    return this.routesService.getFilteredOrders(filter);
  }

  @Get('suggestions')
  getRouteSuggestions(
    @Query('storeId') storeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('type', new ParseArrayPipe({ items: String, optional: true, separator: ',' })) type?: string[],
    @Query('productBarcodes', new ParseArrayPipe({ items: String, optional: true, separator: ',' })) productBarcodes?: string[],
  ) {
    const paginationDto: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      sortBy,
      sortOrder: sortOrder || 'DESC',
    };
    return this.routesService.getRouteSuggestions(storeId, paginationDto, type, productBarcodes);
  }

  @Post(':id/print-label')
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async printLabel(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.routesService.printLabel(id);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result.zpl);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.remove(id);
  }
}

