import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, In } from 'typeorm';
import { Store } from './entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { Route, RouteStatus } from '../routes/entities/route.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/api-response.interface';
import { StoreResponseDto } from './dto/store-response.dto';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
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

    const isActiveChanged = updateStoreDto.isActive !== undefined && updateStoreDto.isActive !== store.isActive;
    const newIsActive = updateStoreDto.isActive !== undefined ? updateStoreDto.isActive : store.isActive;

    Object.assign(store, updateData);
    
    try {
      const updatedStore = await this.storeRepository.save(store);

      if (isActiveChanged) {
        await this.updateRelatedEntitiesActiveStatus(id, newIsActive);
      }

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

  private async updateRelatedEntitiesActiveStatus(storeId: string, isActive: boolean): Promise<void> {
    try {
      const [productsResult, ordersResult] = await Promise.all([
        this.productRepository.update(
          { storeId },
          { isActive },
        ),
        this.orderRepository.update(
          { storeId },
          { isActive },
        ),
      ]);

      const storeOrders = await this.orderRepository.find({
        where: { storeId },
        select: ['id'],
      });

      const orderIds = storeOrders.map((o) => o.id);

      if (orderIds.length > 0) {
        const routesWithStoreOrders = await this.routeRepository
          .createQueryBuilder('route')
          .innerJoin('route.orders', 'order')
          .where('order.id IN (:...orderIds)', { orderIds })
          .andWhere('route.status IN (:...statuses)', {
            statuses: [RouteStatus.COLLECTING, RouteStatus.COMPLETED],
          })
          .getMany();

        const routeIds = routesWithStoreOrders.map((r) => r.id);

        if (routeIds.length > 0) {
          await this.routeRepository.update(
            { id: In(routeIds) },
            { isActive },
          );
        }
      }

      this.logger.log(
        `Updated related entities for store ${storeId}: isActive = ${isActive}. ` +
        `Products: ${productsResult.affected}, Orders: ${ordersResult.affected}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating related entities for store ${storeId}: ${error.message}`,
        error.stack,
      );
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

