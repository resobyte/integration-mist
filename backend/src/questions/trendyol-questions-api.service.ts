import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TrendyolQuestionAnswer {
  creationDate: number;
  hasPrivateInfo: boolean;
  id: number;
  reason: string;
  text: string;
}

interface TrendyolQuestion {
  answer: TrendyolQuestionAnswer | null;
  answeredDateMessage: string;
  creationDate: number;
  customerId: number;
  id: number;
  imageUrl: string;
  productName: string;
  public: boolean;
  reason: string;
  rejectedAnswer: TrendyolQuestionAnswer | null;
  rejectedDate: number;
  reportReason: string;
  reportedDate: number;
  showUserName: boolean;
  status: string;
  text: string;
  userName: string;
  webUrl: string;
  productMainId: string;
}

interface TrendyolQuestionsResponse {
  content: TrendyolQuestion[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface GetQuestionsParams {
  barcode?: number;
  page?: number;
  size?: number;
  supplierId?: number;
  endDate?: number;
  startDate?: number;
  status?: string;
  orderByField?: string;
  orderByDirection?: string;
}

@Injectable()
export class TrendyolQuestionsApiService {
  private readonly logger = new Logger(TrendyolQuestionsApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('TRENDYOL_QNA_API_URL') || 
                   'https://apigw.trendyol.com/integration/qna/sellers';
  }

  private getAuthHeader(apiKey: string, apiSecret: string): string {
    return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }

  async getQuestions(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    params?: GetQuestionsParams,
  ): Promise<TrendyolQuestionsResponse> {
    const url = new URL(`${this.baseUrl}/${sellerId}/questions/filter`);

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
      this.logger.error(`Trendyol Questions API error: ${errorText}`);
      throw new Error(`Trendyol API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getAllQuestions(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    status: string = 'WAITING_FOR_ANSWER',
  ): Promise<TrendyolQuestion[]> {
    const allQuestions: TrendyolQuestion[] = [];
    let page = 0;
    let hasMore = true;

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    while (hasMore) {
      const params: GetQuestionsParams = {
        page,
        size: 50,
        status,
        startDate: twoWeeksAgo,
        endDate: now,
        orderByField: 'LastModifiedDate',
        orderByDirection: 'DESC',
      };

      const response = await this.getQuestions(sellerId, apiKey, apiSecret, params);

      if (response.content && response.content.length > 0) {
        allQuestions.push(...response.content);
        page++;
        hasMore = page < response.totalPages;
      } else {
        hasMore = false;
      }
    }

    return allQuestions;
  }

  async getQuestionById(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    questionId: number,
  ): Promise<TrendyolQuestion> {
    const url = `${this.baseUrl}/${sellerId}/questions/${questionId}`;

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Trendyol Get Question error: ${errorText}`);
      throw new Error(`Trendyol API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async createAnswer(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    questionId: number,
    text: string,
  ): Promise<boolean> {
    const url = `${this.baseUrl}/${sellerId}/questions/${questionId}/answers`;

    if (text.length < 10 || text.length > 2000) {
      throw new Error('Answer text must be between 10 and 2000 characters');
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Trendyol Create Answer error: ${errorText}`);
      throw new Error(`Trendyol API error: ${response.status} - ${errorText}`);
    }

    return true;
  }
}

