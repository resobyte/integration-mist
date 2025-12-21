import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TrendyolClaimItem {
  orderLine: {
    id: number;
    productName: string;
    barcode: string;
    merchantSku: string;
    productColor: string;
    productSize: string;
    price: number;
    vatBaseAmount: number;
    vatRate: number;
    salesCampaignId: number;
    productCategory: string;
  };
  claimItems: {
    id: string;
    orderLineItemId: number;
    customerClaimItemReason: {
      id: string;
      name: string;
      externalReasonId: number;
      code: string;
    };
    trendyolClaimItemReason: {
      id: string;
      name: string;
      externalReasonId: number;
      code: string;
    };
    claimItemStatus: {
      name: string;
    };
    note: string;
    customerNote: string;
    resolved: boolean;
    autoAccepted: boolean;
    acceptedBySeller: boolean;
  }[];
}

interface TrendyolClaim {
  id: string;
  claimId: string;
  orderNumber: string;
  orderDate: number;
  customerFirstName: string;
  customerLastName: string;
  claimDate: number;
  cargoTrackingNumber: string;
  cargoTrackingLink: string;
  cargoSenderNumber: string;
  cargoProviderName: string;
  orderShipmentPackageId: number;
  replacementOutboundpackageinfo?: Record<string, unknown>;
  rejectedpackageinfo?: Record<string, unknown>;
  items: TrendyolClaimItem[];
  lastModifiedDate: number;
  orderOutboundPackageId: number;
}

interface TrendyolClaimsResponse {
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolClaim[];
}

interface GetClaimsParams {
  claimIds?: string;
  claimItemStatus?: string;
  startDate?: number;
  endDate?: number;
  orderNumber?: string;
  size?: number;
  page?: number;
}

@Injectable()
export class TrendyolClaimsApiService {
  private readonly logger = new Logger(TrendyolClaimsApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('TRENDYOL_ORDER_API_URL') || 
                   'https://apigw.trendyol.com/integration/order/sellers';
  }

  private getAuthHeader(apiKey: string, apiSecret: string): string {
    return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }

  async getClaims(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    params?: GetClaimsParams,
  ): Promise<TrendyolClaimsResponse> {
    const url = new URL(`${this.baseUrl}/${sellerId}/claims`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Trendyol Claims API error: ${errorText}`);
      throw new Error(`Trendyol API error: ${response.status}`);
    }

    return response.json();
  }

  async getAllClaims(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    status?: string,
  ): Promise<TrendyolClaim[]> {
    const allClaims: TrendyolClaim[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const params: GetClaimsParams = {
        page,
        size: 200,
        claimItemStatus: status || 'Created',
      };

      const response = await this.getClaims(sellerId, apiKey, apiSecret, params);

      if (response.content && response.content.length > 0) {
        allClaims.push(...response.content);
        page++;
        hasMore = page < response.totalPages;
      } else {
        hasMore = false;
      }
    }

    return allClaims;
  }

  async approveClaim(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    claimId: string,
    claimLineItemIdList: string[],
  ): Promise<boolean> {
    const url = `${this.baseUrl}/${sellerId}/claims/${claimId}/items/approve`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimLineItemIdList,
        params: {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Trendyol Approve Claim error: ${errorText}`);
      throw new Error(`Trendyol API error: ${response.status} - ${errorText}`);
    }

    return true;
  }
}

