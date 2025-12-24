import { Controller, Get, Query, UseGuards, ParseArrayPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_OWNER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getReports(
    @Query('storeIds', new ParseArrayPipe({ items: String, optional: true, separator: ',' })) storeIds?: string[],
    @Query('productBarcodes', new ParseArrayPipe({ items: String, optional: true, separator: ',' })) productBarcodes?: string[],
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filter: ReportFilterDto = {
      storeIds,
      productBarcodes,
      startDate,
      endDate,
    };
    const result = await this.reportsService.getReports(filter);
    return {
      success: true,
      data: result,
    };
  }
}

