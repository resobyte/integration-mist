import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/api-response.interface';
import { ProductResponseDto } from './dto/product-response.dto';
import { Store } from '../stores/entities/store.entity';
import { TrendyolProductApiService, TrendyolProduct } from './trendyol-product-api.service';

export interface ProductSyncResult {
  storeId: string;
  storeName: string;
  created: number;
  updated: number;
  deactivated: number;
  errors: number;
  error?: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly trendyolProductApiService: TrendyolProductApiService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const store = await this.storeRepository.findOne({
      where: { id: createProductDto.storeId },
      withDeleted: false,
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const product = this.productRepository.create({
      ...createProductDto,
      taxRate: createProductDto.taxRate ?? 0,
      isActive: createProductDto.isActive ?? true,
    });

    try {
      const savedProduct = await this.productRepository.save(product);
      return ProductResponseDto.fromEntity(savedProduct);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === 'ER_DUP_ENTRY') {
        const message = (error as any).message;
        if (message.includes('name')) {
          throw new ConflictException('Bu ürün adı zaten kullanılıyor');
        }
        if (message.includes('barcode')) {
          throw new ConflictException('Bu barkod zaten kullanılıyor');
        }
        throw new ConflictException('Bu ürün bilgileri zaten kullanılıyor');
      }
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    search?: string,
    storeId?: string,
    isActive?: boolean,
  ): Promise<PaginationResponse<ProductResponseDto>> {
    const { page, limit, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.store', 'store');

    if (isActive !== undefined) {
      queryBuilder.where('product.isActive = :isActive', { isActive });
    }

    if (search) {
      if (isActive !== undefined) {
        queryBuilder.andWhere(
          '(product.name LIKE :search OR product.barcode LIKE :search OR product.sku LIKE :search OR product.description LIKE :search)',
          { search: `%${search}%` },
        );
      } else {
        queryBuilder.where(
          '(product.name LIKE :search OR product.barcode LIKE :search OR product.sku LIKE :search OR product.description LIKE :search)',
          { search: `%${search}%` },
        );
      }
    }

    if (storeId) {
      if (search || isActive !== undefined) {
        queryBuilder.andWhere('product.storeId = :storeId', { storeId });
      } else {
        queryBuilder.where('product.storeId = :storeId', { storeId });
      }
    }

    if (sortBy) {
      queryBuilder.orderBy(`product.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('product.createdAt', 'DESC');
    }

    const [products, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: products.map((p) => ProductResponseDto.fromEntity(p, true)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ 
      where: { id },
      relations: ['store'],
      withDeleted: false,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return ProductResponseDto.fromEntity(product, true);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ 
      where: { id },
      withDeleted: false,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const newStoreId = (updateProductDto as { storeId?: string }).storeId;
    if (newStoreId && newStoreId !== product.storeId) {
      const store = await this.storeRepository.findOne({
        where: { id: newStoreId },
        withDeleted: false,
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }
    }

    Object.assign(product, updateProductDto);
    
    try {
      const updatedProduct = await this.productRepository.save(product);
      
      const productWithStore = await this.productRepository.findOne({
        where: { id: updatedProduct.id },
        relations: ['store'],
      });

      return ProductResponseDto.fromEntity(productWithStore!, true);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === 'ER_DUP_ENTRY') {
        const message = (error as any).message;
        if (message.includes('name')) {
          throw new ConflictException('Bu ürün adı zaten kullanılıyor');
        }
        if (message.includes('barcode')) {
          throw new ConflictException('Bu barkod zaten kullanılıyor');
        }
        throw new ConflictException('Bu ürün bilgileri zaten kullanılıyor');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ 
      where: { id },
      withDeleted: false,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.productRepository.softDelete(id);
  }

  async findByBarcodes(barcodes: string[]): Promise<Product[]> {
    if (barcodes.length === 0) {
      return [];
    }

    return this.productRepository
      .createQueryBuilder('product')
      .where('product.barcode IN (:...barcodes)', { barcodes })
      .andWhere('product.deletedAt IS NULL')
      .getMany();
  }

  async getExistingBarcodes(barcodes: string[]): Promise<Set<string>> {
    const products = await this.findByBarcodes(barcodes);
    return new Set(products.map((p) => p.barcode).filter((b): b is string => b !== null));
  }

  async syncProductsFromTrendyol(storeId: string): Promise<ProductSyncResult> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      withDeleted: false,
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (!store.sellerId || !store.apiKey || !store.apiSecret) {
      throw new NotFoundException('Store API credentials not found');
    }

    let created = 0;
    let updated = 0;
    let deactivated = 0;
    let errors = 0;

    try {
      const trendyolProducts = await this.trendyolProductApiService.getAllApprovedProducts(
        store.sellerId,
        store.apiKey,
        store.apiSecret,
        store.proxyUrl || undefined,
      );

      this.logger.log(`Syncing ${trendyolProducts.length} products for store: ${store.name}`);

      const syncedProductIds = new Set<string>();
      const trendyolBarcodes = new Set(trendyolProducts.map((p) => p.barcode));
      const trendyolProductIds = new Set(trendyolProducts.map((p) => p.id));

      for (const trendyolProduct of trendyolProducts) {
        try {
          const result = await this.upsertFromTrendyol(storeId, trendyolProduct);
          if (result.action === 'created') {
            created++;
          } else {
            updated++;
          }
          if (result.productId) {
            syncedProductIds.add(result.productId);
          }
        } catch (error) {
          errors++;
          this.logger.error(`Error syncing product ${trendyolProduct.barcode}: ${error.message}`);
        }
      }

      const existingProducts = await this.productRepository.find({
        where: { storeId, isActive: true },
        withDeleted: false,
      });

      for (const existingProduct of existingProducts) {
        const isInTrendyol = 
          (existingProduct.trendyolProductId && trendyolProductIds.has(existingProduct.trendyolProductId)) ||
          (existingProduct.barcode && trendyolBarcodes.has(existingProduct.barcode));

        if (!isInTrendyol && !syncedProductIds.has(existingProduct.id)) {
          existingProduct.isActive = false;
          await this.productRepository.save(existingProduct);
          deactivated++;
          this.logger.log(`Deactivated product: ${existingProduct.name} (${existingProduct.barcode})`);
        }
      }

      this.logger.log(`Sync completed for store ${store.name}: created=${created}, updated=${updated}, deactivated=${deactivated}, errors=${errors}`);

      return {
        storeId: store.id,
        storeName: store.name,
        created,
        updated,
        deactivated,
        errors,
      };
    } catch (error) {
      this.logger.error(`Error syncing products for store ${store.name}: ${error.message}`);
      return {
        storeId: store.id,
        storeName: store.name,
        created: 0,
        updated: 0,
        deactivated: 0,
        errors: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async upsertFromTrendyol(
    storeId: string,
    trendyolProduct: TrendyolProduct,
  ): Promise<{ action: 'created' | 'updated'; productId: string }> {
    const existingProduct = await this.productRepository.findOne({
      where: [
        { storeId, trendyolProductId: trendyolProduct.id },
        { storeId, barcode: trendyolProduct.barcode },
      ],
      withDeleted: false,
    });

    const productData = {
      storeId,
      name: trendyolProduct.title,
      barcode: trendyolProduct.barcode,
      stock: trendyolProduct.quantity || 0,
      salePrice: trendyolProduct.salePrice || null,
      listPrice: trendyolProduct.listPrice || null,
      taxRate: trendyolProduct.vatRate || 0,
      description: trendyolProduct.description || null,
      sku: trendyolProduct.stockCode || null,
      isActive: true,
      trendyolProductId: trendyolProduct.id,
      trendyolProductCode: trendyolProduct.productCode,
      brand: trendyolProduct.brand || null,
      categoryName: trendyolProduct.categoryName || null,
      color: trendyolProduct.color || null,
      size: trendyolProduct.size || null,
      imageUrl: trendyolProduct.images?.[0]?.url || null,
      productUrl: trendyolProduct.productUrl || null,
      trendyolLastUpdateDate: trendyolProduct.lastUpdateDate,
    };

    if (existingProduct) {
      Object.assign(existingProduct, productData);
      await this.productRepository.save(existingProduct);
      return { action: 'updated', productId: existingProduct.id };
    } else {
      const newProduct = this.productRepository.create(productData);
      const savedProduct = await this.productRepository.save(newProduct);
      return { action: 'created', productId: savedProduct.id };
    }
  }

  async syncAllStoresProducts(): Promise<{
    totalStores: number;
    results: ProductSyncResult[];
  }> {
    const stores = await this.storeRepository.find({
      where: { isActive: true },
      withDeleted: false,
    });

    const activeStores = stores.filter(
      (store) => store.sellerId && store.apiKey && store.apiSecret,
    );

    const results: ProductSyncResult[] = [];

    for (const store of activeStores) {
      try {
        const result = await this.syncProductsFromTrendyol(store.id);
        results.push(result);
      } catch (error) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          created: 0,
          updated: 0,
          deactivated: 0,
          errors: 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalStores: activeStores.length,
      results,
    };
  }
}

