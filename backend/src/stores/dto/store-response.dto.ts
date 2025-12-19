import { Store } from '../entities/store.entity';

export class StoreResponseDto {
  id: string;
  name: string;
  sellerId: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  token: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: Store): StoreResponseDto {
    const dto = new StoreResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.sellerId = entity.sellerId;
    dto.apiKey = entity.apiKey;
    dto.apiSecret = entity.apiSecret;
    dto.token = entity.token;
    dto.description = entity.description;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

