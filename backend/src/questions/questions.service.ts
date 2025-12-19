import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../stores/entities/store.entity';
import { TrendyolQuestionsApiService } from './trendyol-questions-api.service';
import { QuestionResponseDto } from './dto/question-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly trendyolQuestionsApiService: TrendyolQuestionsApiService,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<{
    data: QuestionResponseDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const stores = await this.storeRepository.find({
      where: { isActive: true },
    });

    const activeStores = stores.filter(
      (store) => store.sellerId && store.apiKey && store.apiSecret,
    );

    const allQuestions: QuestionResponseDto[] = [];

    for (const store of activeStores) {
      try {
        const trendyolQuestions = await this.trendyolQuestionsApiService.getAllQuestions(
          store.sellerId!,
          store.apiKey!,
          store.apiSecret!,
          'WAITING_FOR_ANSWER',
        );

        for (const trendyolQuestion of trendyolQuestions) {
          const dto = QuestionResponseDto.fromTrendyolQuestion(
            trendyolQuestion,
            store.id,
            store.name,
          );
          allQuestions.push(dto);
        }
      } catch (error) {
        this.logger.error(`Error fetching questions for store ${store.name}:`, error);
      }
    }

    const { page = 1, limit = 10, sortBy = 'creationDate', sortOrder = 'DESC' } = paginationDto;

    allQuestions.sort((a, b) => {
      const aValue = a[sortBy as keyof QuestionResponseDto];
      const bValue = b[sortBy as keyof QuestionResponseDto];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    const total = allQuestions.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedQuestions = allQuestions.slice(startIndex, endIndex);

    return {
      data: paginatedQuestions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<QuestionResponseDto> {
    const [storeId, questionIdStr] = id.split('-', 2);

    if (!storeId || !questionIdStr) {
      throw new NotFoundException('Invalid question ID format');
    }

    const questionId = parseInt(questionIdStr, 10);
    if (isNaN(questionId)) {
      throw new NotFoundException('Invalid question ID');
    }

    const store = await this.storeRepository.findOne({ where: { id: storeId } });

    if (!store || !store.sellerId || !store.apiKey || !store.apiSecret) {
      throw new NotFoundException('Store not found or credentials not configured');
    }

    const trendyolQuestion = await this.trendyolQuestionsApiService.getQuestionById(
      store.sellerId,
      store.apiKey,
      store.apiSecret,
      questionId,
    );

    return QuestionResponseDto.fromTrendyolQuestion(trendyolQuestion, store.id, store.name);
  }

  async createAnswer(
    questionId: number,
    storeId: string,
    text: string,
  ): Promise<{ success: boolean; message: string }> {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (!store.sellerId || !store.apiKey || !store.apiSecret) {
      throw new BadRequestException('Store Trendyol credentials not configured');
    }

    if (text.length < 10 || text.length > 2000) {
      throw new BadRequestException('Answer text must be between 10 and 2000 characters');
    }

    await this.trendyolQuestionsApiService.createAnswer(
      store.sellerId,
      store.apiKey,
      store.apiSecret,
      questionId,
      text,
    );

    return {
      success: true,
      message: 'Cevap başarıyla gönderildi',
    };
  }
}

