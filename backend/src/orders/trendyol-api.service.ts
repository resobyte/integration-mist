import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface TrendyolOrderResponse {
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolOrder[];
}

interface TrendyolOrder {
  id: number;
  orderNumber: string;
  shipmentPackageId: number;
  customerId: number;
  supplierId: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  orderDate: number;
  grossAmount: number;
  packageGrossAmount: number;
  totalPrice: number;
  packageTotalPrice: number;
  currencyCode: string;
  cargoTrackingNumber?: string;
  cargoProviderName?: string;
  cargoTrackingLink?: string;
  shipmentAddress?: Record<string, unknown>;
  invoiceAddress?: Record<string, unknown>;
  lines?: Record<string, unknown>[];
  packageHistories?: Array<{
    createdDate: number;
    status: string;
  }>;
  shipmentPackageStatus: string;
  status: string;
  commercial: boolean;
  micro: boolean;
  deliveryAddressType?: string;
  lastModifiedDate?: number;
}

@Injectable()
export class TrendyolApiService {
  private readonly logger = new Logger(TrendyolApiService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  async getOrders(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    params?: {
      status?: string;
      startDate?: number;
      endDate?: number;
      page?: number;
      size?: number;
      orderByField?: string;
      orderByDirection?: 'ASC' | 'DESC';
    },
  ): Promise<TrendyolOrderResponse> {
    try {
      const baseUrl = this.configService.get<string>('TRENDYOL_API_URL') || 
                     'https://apigw.trendyol.com/integration/order/sellers';

      const url = `${baseUrl}/${sellerId}/orders`;

      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.startDate) queryParams.append('startDate', params.startDate.toString());
      if (params?.endDate) queryParams.append('endDate', params.endDate.toString());
      if (params?.page !== undefined) queryParams.append('page', params.page.toString());
      if (params?.size) queryParams.append('size', params.size.toString());
      if (params?.orderByField) queryParams.append('orderByField', params.orderByField);
      if (params?.orderByDirection) queryParams.append('orderByDirection', params.orderByDirection);

      const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

      const integrationCompanyName = this.configService.get<string>('TRENDYOL_INTEGRATION_COMPANY_NAME', 'SelfIntegration');
      const userAgent = this.configService.get<string>('TRENDYOL_USER_AGENT', `${sellerId} - ${integrationCompanyName}`.substring(0, 30));

      const tokenString = `${apiKey}:${apiSecret}`;
      const base64Token = Buffer.from(tokenString, 'utf8').toString('base64');
      const authToken = `Basic ${base64Token}`;

      this.logger.log(`Fetching orders from Trendyol for sellerId: ${sellerId}`);
      this.logger.debug(`User-Agent: ${userAgent}`);

      const response = await this.axiosInstance.get<TrendyolOrderResponse>(fullUrl, {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': userAgent,
        },
        maxRedirects: 0,
        maxBodyLength: Infinity,
      });

      this.logger.log(`Successfully fetched ${response.data.content.length} orders from Trendyol`);

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching orders from Trendyol: ${error.message}`, error.stack);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new HttpException(
            `Trendyol API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
            error.response.status || HttpStatus.BAD_GATEWAY,
          );
        }
        if (error.request) {
          throw new HttpException(
            'No response from Trendyol API',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
      }
      
      throw new HttpException(
        `Failed to fetch orders from Trendyol: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

