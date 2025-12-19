import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
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
  ): Promise<PaginationResponse<ProductResponseDto>> {
    const { page, limit, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.store', 'store');

    if (search) {
      queryBuilder.where(
        '(product.name LIKE :search OR product.barcode LIKE :search OR product.sku LIKE :search OR product.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (storeId) {
      if (search) {
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
}

