import { Product } from '../entities/product.entity';
import { StoreResponseDto } from '../../stores/dto/store-response.dto';

export class ProductResponseDto {
  id: string;
  storeId: string;
  store?: StoreResponseDto;
  name: string;
  barcode: string | null;
  stock: number;
  purchasePrice: number | null;
  salePrice: number | null;
  taxRate: number;
  description: string | null;
  sku: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: Product, includeStore = false): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = entity.id;
    dto.storeId = entity.storeId;
    dto.name = entity.name;
    dto.barcode = entity.barcode;
    dto.stock = entity.stock;
    dto.purchasePrice = entity.purchasePrice;
    dto.salePrice = entity.salePrice;
    dto.taxRate = entity.taxRate;
    dto.description = entity.description;
    dto.sku = entity.sku;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    
    if (includeStore && entity.store) {
      dto.store = StoreResponseDto.fromEntity(entity.store);
    }
    
    return dto;
  }
}

