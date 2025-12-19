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
  listPrice: number | null;
  taxRate: number;
  description: string | null;
  sku: string | null;
  isActive: boolean;
  trendyolProductId: string | null;
  trendyolProductCode: number | null;
  brand: string | null;
  categoryName: string | null;
  color: string | null;
  size: string | null;
  imageUrl: string | null;
  productUrl: string | null;
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
    dto.listPrice = entity.listPrice;
    dto.taxRate = entity.taxRate;
    dto.description = entity.description;
    dto.sku = entity.sku;
    dto.isActive = entity.isActive;
    dto.trendyolProductId = entity.trendyolProductId;
    dto.trendyolProductCode = entity.trendyolProductCode;
    dto.brand = entity.brand;
    dto.categoryName = entity.categoryName;
    dto.color = entity.color;
    dto.size = entity.size;
    dto.imageUrl = entity.imageUrl;
    dto.productUrl = entity.productUrl;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    
    if (includeStore && entity.store) {
      dto.store = StoreResponseDto.fromEntity(entity.store);
    }
    
    return dto;
  }
}

