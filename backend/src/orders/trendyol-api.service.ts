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
      const baseUrl = this.configService.get<string>('TRENDYOL_ORDER_API_URL') || 
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
          'Accept-Encoding': 'gzip, deflate, bör',
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

  async updatePackage(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    packageId: number,
    lines: Array<{ lineId: number; quantity: number }>,
  ): Promise<boolean> {
    try {
      const baseUrl = this.configService.get<string>('TRENDYOL_ORDER_API_URL') || 
                     'https://apigw.trendyol.com/integration/order/sellers';

      const url = `${baseUrl}/${sellerId}/shipment-packages/${packageId}`;

      const integrationCompanyName = this.configService.get<string>('TRENDYOL_INTEGRATION_COMPANY_NAME', 'SelfIntegration');
      const userAgent = this.configService.get<string>('TRENDYOL_USER_AGENT', `${sellerId} - ${integrationCompanyName}`.substring(0, 30));

      const tokenString = `${apiKey}:${apiSecret}`;
      const base64Token = Buffer.from(tokenString, 'utf8').toString('base64');
      const authToken = `Basic ${base64Token}`;

      this.logger.log(`Updating package status to Picking for packageId: ${packageId}, sellerId: ${sellerId}`);

      const response = await this.axiosInstance.put(
        url,
        {
          lines,
          params: {},
          status: 'Picking',
        },
        {
          headers: {
            'Authorization': authToken,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': userAgent,
          },
          maxRedirects: 0,
        },
      );

      this.logger.log(`Successfully updated package status to Picking for packageId: ${packageId}`);

      return true;
    } catch (error) {
      this.logger.error(`Error updating package status to Picking: ${error.message}`, error.stack);
      
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
        `Failed to update package status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createTestOrder(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    orderData: {
      customerFirstName: string;
      customerLastName: string;
      customerEmail: string;
      customerPhone?: string;
      addressText: string;
      neighborhood?: string;
      district: string;
      city: string;
      postalCode?: string;
      latitude?: string;
      longitude?: string;
      commercial?: boolean;
      company?: string;
      invoiceTaxNumber?: string;
      invoiceTaxOffice?: string;
      microRegion?: string;
      lines: Array<{ productBarcode: string; quantity: number; discountPercentage?: number }>;
    },
  ): Promise<TrendyolOrder> {
    try {
      const url = 'https://stageapigw.trendyol.com/integration/test/order/orders/core';

      const integrationCompanyName = this.configService.get<string>('TRENDYOL_INTEGRATION_COMPANY_NAME', 'SelfIntegration');
      const userAgent = this.configService.get<string>('TRENDYOL_USER_AGENT', `Mozilla/5.0 (compatible; TrendyolIntegration/1.0; +https://trendyol.com)`);

      const tokenString = `${apiKey}:${apiSecret}`;
      const base64Token = Buffer.from(tokenString, 'utf8').toString('base64');
      const authToken = `Basic ${base64Token}`;

      const numericSellerId = parseInt(sellerId, 10);
      if (isNaN(numericSellerId)) {
        throw new HttpException('Invalid sellerId format', HttpStatus.BAD_REQUEST);
      }

      const requestBody: any = {
        customer: {
          customerFirstName: orderData.customerFirstName,
          customerLastName: orderData.customerLastName,
        },
        shippingAddress: {
          addressText: orderData.addressText,
          city: orderData.city,
          company: '',
          district: orderData.district,
          latitude: orderData.latitude || '',
          longitude: orderData.longitude || '',
          neighborhood: orderData.neighborhood || '',
          phone: orderData.customerPhone || '',
          postalCode: orderData.postalCode || '',
          shippingFirstName: orderData.customerFirstName,
          shippingLastName: orderData.customerLastName,
          email: orderData.customerEmail,
        },
        invoiceAddress: {
          addressText: orderData.addressText,
          city: orderData.city,
          company: orderData.company || '',
          district: orderData.district,
          invoiceFirstName: orderData.customerFirstName,
          invoiceLastName: orderData.customerLastName,
          latitude: orderData.latitude || '',
          longitude: orderData.longitude || '',
          neighborhood: orderData.neighborhood || '',
          phone: orderData.customerPhone || '',
          postalCode: orderData.postalCode || '',
          email: orderData.customerEmail,
          invoiceTaxNumber: orderData.invoiceTaxNumber || '',
          invoiceTaxOffice: orderData.invoiceTaxOffice || '',
        },
        lines: orderData.lines.map((line) => ({
          barcode: line.productBarcode,
          quantity: line.quantity,
          ...(line.discountPercentage !== undefined && { discountPercentage: line.discountPercentage }),
        })),
        seller: {
          sellerId: numericSellerId,
        },
        commercial: orderData.commercial || false,
      };

      if (orderData.microRegion) {
        requestBody.microRegion = orderData.microRegion;
      }

      this.logger.log(`Creating test order for sellerId: ${sellerId}`);

      this.logger.debug(`Request URL: ${url}`);
      this.logger.debug(`Request Headers: SellerID=${numericSellerId}, User-Agent=${userAgent}`);

      const response = await this.axiosInstance.post<TrendyolOrder>(
        url,
        requestBody,
        {
          headers: {
            'Authorization': authToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': userAgent,
            'SellerID': numericSellerId.toString(),
            'Origin': 'https://stageapigw.trendyol.com',
            'Referer': 'https://stageapigw.trendyol.com/',
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 500,
          timeout: 30000,
        },
      );

      this.logger.log(`Successfully created test order: ${response.data.orderNumber}`);

      return response.data;
    } catch (error) {
      this.logger.error(`Error creating test order: ${error.message}`, error.stack);
      
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
        `Failed to create test order: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

