import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Claim } from './entities/claim.entity';
import { Store } from '../stores/entities/store.entity';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { TrendyolClaimsApiService } from './trendyol-claims-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([Claim, Store])],
  controllers: [ClaimsController],
  providers: [ClaimsService, TrendyolClaimsApiService],
  exports: [ClaimsService, TrendyolClaimsApiService],
})
export class ClaimsModule {}

