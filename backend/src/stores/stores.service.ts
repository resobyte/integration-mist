import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Store } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/api-response.interface';
import { StoreResponseDto } from './dto/store-response.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async create(createStoreDto: CreateStoreDto): Promise<StoreResponseDto> {
    const storeData: any = {
      ...createStoreDto,
      isActive: createStoreDto.isActive ?? true,
    };

    if (createStoreDto.apiKey && createStoreDto.apiSecret) {
      const tokenString = `${createStoreDto.apiKey}:${createStoreDto.apiSecret}`;
      storeData.token = Buffer.from(tokenString, 'utf8').toString('base64');
    }

    const store = this.storeRepository.create(storeData);

    try {
      const savedStore = await this.storeRepository.save(store);
      if (Array.isArray(savedStore)) {
        return StoreResponseDto.fromEntity(savedStore[0]);
      }
      return StoreResponseDto.fromEntity(savedStore);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === 'ER_DUP_ENTRY') {
        const message = (error as any).message;
        if (message.includes('name')) {
          throw new ConflictException('Bu mağaza adı zaten kullanılıyor');
        }
        if (message.includes('sellerId')) {
          throw new ConflictException('Bu satıcı ID zaten kullanılıyor');
        }
        throw new ConflictException('Bu mağaza bilgileri zaten kullanılıyor');
      }
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    search?: string,
  ): Promise<PaginationResponse<StoreResponseDto>> {
    const { page, limit, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.storeRepository.createQueryBuilder('store');

    if (search) {
      queryBuilder.where(
        '(store.name LIKE :search OR store.description LIKE :search OR store.sellerId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`store.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('store.createdAt', 'DESC');
    }

    const [stores, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: stores.map(StoreResponseDto.fromEntity),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findOne({ 
      where: { id },
      withDeleted: false,
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return StoreResponseDto.fromEntity(store);
  }

  async update(
    id: string,
    updateStoreDto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findOne({ 
      where: { id },
      withDeleted: false,
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const updateData: any = { ...updateStoreDto };

    const apiKey = updateStoreDto.apiKey !== undefined ? updateStoreDto.apiKey : store.apiKey;
    const apiSecret = updateStoreDto.apiSecret !== undefined ? updateStoreDto.apiSecret : store.apiSecret;

    if (apiKey && apiSecret) {
      const tokenString = `${apiKey}:${apiSecret}`;
      updateData.token = Buffer.from(tokenString, 'utf8').toString('base64');
    } else if (apiKey || apiSecret) {
      updateData.token = null;
    }

    Object.assign(store, updateData);
    
    try {
      const updatedStore = await this.storeRepository.save(store);
      return StoreResponseDto.fromEntity(updatedStore);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === 'ER_DUP_ENTRY') {
        const message = (error as any).message;
        if (message.includes('name')) {
          throw new ConflictException('Bu mağaza adı zaten kullanılıyor');
        }
        if (message.includes('sellerId')) {
          throw new ConflictException('Bu satıcı ID zaten kullanılıyor');
        }
        throw new ConflictException('Bu mağaza bilgileri zaten kullanılıyor');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const store = await this.storeRepository.findOne({ 
      where: { id },
      withDeleted: false,
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    await this.storeRepository.softDelete(id);
  }
}

