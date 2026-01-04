import { ProductSalesReportDto } from './product-sales-report.dto';

export class ReportResponseDto {
  totalRevenue: number;
  totalOrders: number;
  totalSalesQuantity: number;
  totalCompletedRoutes: number;
  productSales: ProductSalesReportDto[];
}

