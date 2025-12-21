import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface TrendyolProduct {
  id: string;
  approved: boolean;
  archived: boolean;
  productCode: number;
  supplierId: number;
  createDateTime: number;
  lastUpdateDate: number;
  brand: string;
  barcode: string;
  title: string;
  categoryName: string;
  productMainId: string;
  description: string;
  stockUnitType: string;
  quantity: number;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  stockCode: string;
  images: Array<{ url: string }>;
  attributes: Array<{
    attributeId: number;
    attributeName: string;
    attributeValueId?: number;
    attributeValue?: string;
  }>;
  color?: string;
  size?: string;
  onsale: boolean;
  productUrl?: string;
}

interface TrendyolProductResponse {
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolProduct[];
}

@Injectable()
export class TrendyolProductApiService {
  private readonly logger = new Logger(TrendyolProductApiService.name);

  constructor(private readonly configService: ConfigService) {}

  async getProducts(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    params?: {
      approved?: boolean;
      barcode?: string;
      startDate?: number;
      endDate?: number;
      page?: number;
      size?: number;
      onSale?: boolean;
      archived?: boolean;
    },
    proxyUrl?: string,
  ): Promise<TrendyolProductResponse> {
    try {
      const baseUrl = this.configService.get<string>('TRENDYOL_PRODUCT_API_URL') ||
        'https://apigw.trendyol.com/integration/product/sellers';

      const url = `${baseUrl}/${sellerId}/products`;

      const queryParams = new URLSearchParams();
      if (params?.approved !== undefined) queryParams.append('approved', params.approved.toString());
      if (params?.barcode) queryParams.append('barcode', params.barcode);
      if (params?.startDate) queryParams.append('startDate', params.startDate.toString());
      if (params?.endDate) queryParams.append('endDate', params.endDate.toString());
      if (params?.page !== undefined) queryParams.append('page', params.page.toString());
      if (params?.size) queryParams.append('size', params.size.toString());
      if (params?.onSale !== undefined) queryParams.append('onSale', params.onSale.toString());
      if (params?.archived !== undefined) queryParams.append('archived', params.archived.toString());

      const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

      const integrationCompanyName = this.configService.get<string>('TRENDYOL_INTEGRATION_COMPANY_NAME', 'SelfIntegration');
      const userAgent = `${sellerId} - ${integrationCompanyName}`.substring(0, 30);

      const tokenString = `${apiKey}:${apiSecret}`;
      const base64Token = Buffer.from(tokenString, 'utf8').toString('base64');
      const authToken = `Basic ${base64Token}`;

      const axiosConfig: any = {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': userAgent,
        },
        maxRedirects: 0,
        maxBodyLength: Infinity,
        timeout: 30000,
      };

      if (proxyUrl) {
        try {
          axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
          axiosConfig.proxy = false;
        } catch (proxyError) {
          this.logger.error(`Invalid proxy URL for ${sellerId}: ${proxyUrl}`);
        }
      }

      const response = await axios.get<TrendyolProductResponse>(fullUrl, axiosConfig);

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching products from Trendyol: ${error.message}`, error.stack);

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
        `Failed to fetch products from Trendyol: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllApprovedProducts(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    proxyUrl?: string,
  ): Promise<TrendyolProduct[]> {
    const allProducts: TrendyolProduct[] = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const response = await this.getProducts(sellerId, apiKey, apiSecret, {
        approved: true,
        page,
        size: 100,
        onSale: true,
      }, proxyUrl);

      allProducts.push(...response.content);
      totalPages = response.totalPages;
      page++;

      if (page < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return allProducts;
  }
}

