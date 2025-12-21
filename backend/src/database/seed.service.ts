import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async seed() {
    try {
      const seedEmail = this.configService.get<string>('SEED_EMAIL');
      const seedPassword = this.configService.get<string>('SEED_PASSWORD');
      const seedFirstName = this.configService.get<string>('SEED_FIRST_NAME') || 'Admin';
      const seedLastName = this.configService.get<string>('SEED_LAST_NAME') || 'User';

      if (!seedEmail || !seedPassword) {
        this.logger.warn('Seed credentials not found in environment variables. Skipping seed.');
        return;
      }

      const existingUser = await this.userRepository.findOne({
        where: { email: seedEmail },
        withDeleted: false,
      });

      if (existingUser) {
        return;
      }

      const hashedPassword = await bcrypt.hash(seedPassword, 12);

      const adminUser = this.userRepository.create({
        firstName: seedFirstName,
        lastName: seedLastName,
        email: seedEmail,
        password: hashedPassword,
        role: Role.PLATFORM_OWNER,
        isActive: true,
      });

      await this.userRepository.save(adminUser);
    } catch (error) {
      this.logger.error('Error during seed:', error);
      throw error;
    }
  }
}
