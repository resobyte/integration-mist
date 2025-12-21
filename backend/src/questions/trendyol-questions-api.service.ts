import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('TRENDYOL_QNA_API_URL') || 
                   'https://apigw.trendyol.com/integration/qna/sellers';
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  private getAuthHeader(apiKey: string, apiSecret: string): string {
    return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }

  async getQuestions(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    params?: GetQuestionsParams,
    proxyUrl?: string,
  ): Promise<TrendyolQuestionsResponse> {
    const url = `${this.baseUrl}/${sellerId}/questions/filter`;

    const axiosConfig: any = {
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
      params: params,
    };

    if (proxyUrl) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      axiosConfig.proxy = false;
    }

    this.logger.log(`Fetching questions from Trendyol for sellerId: ${sellerId}${proxyUrl ? ' via proxy' : ''}`);

    try {
      const response = await this.axiosInstance.get<TrendyolQuestionsResponse>(url, axiosConfig);
      return response.data;
    } catch (error) {
      this.logger.error(`Trendyol Questions API error: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Trendyol API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async getAllQuestions(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    status: string = 'WAITING_FOR_ANSWER',
    proxyUrl?: string,
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

      const response = await this.getQuestions(sellerId, apiKey, apiSecret, params, proxyUrl);

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
    proxyUrl?: string,
  ): Promise<TrendyolQuestion> {
    const url = `${this.baseUrl}/${sellerId}/questions/${questionId}`;

    const axiosConfig: any = {
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
    };

    if (proxyUrl) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      axiosConfig.proxy = false;
    }

    try {
      const response = await this.axiosInstance.get<TrendyolQuestion>(url, axiosConfig);
      return response.data;
    } catch (error) {
      this.logger.error(`Trendyol Get Question error: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Trendyol API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async createAnswer(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
    questionId: number,
    text: string,
    proxyUrl?: string,
  ): Promise<boolean> {
    const url = `${this.baseUrl}/${sellerId}/questions/${questionId}/answers`;

    if (text.length < 10 || text.length > 2000) {
      throw new Error('Answer text must be between 10 and 2000 characters');
    }

    const axiosConfig: any = {
      headers: {
        Authorization: this.getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
    };

    if (proxyUrl) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      axiosConfig.proxy = false;
    }

    try {
      await this.axiosInstance.post(url, { text }, axiosConfig);
      return true;
    } catch (error) {
      this.logger.error(`Trendyol Create Answer error: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Trendyol API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
}

