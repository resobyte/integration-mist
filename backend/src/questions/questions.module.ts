import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../stores/entities/store.entity';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { TrendyolQuestionsApiService } from './trendyol-questions-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([Store])],
  controllers: [QuestionsController],
  providers: [QuestionsService, TrendyolQuestionsApiService],
  exports: [QuestionsService, TrendyolQuestionsApiService],
})
export class QuestionsModule {}

