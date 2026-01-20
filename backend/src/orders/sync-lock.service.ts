import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SyncLockService {
  private readonly logger = new Logger(SyncLockService.name);
  private isSyncInProgress = false;

  get isLocked(): boolean {
    return this.isSyncInProgress;
  }

  lock(): void {
    this.isSyncInProgress = true;
    this.logger.log('Manual sync started - cronjobs will be skipped');
  }

  unlock(): void {
    this.isSyncInProgress = false;
    this.logger.log('Manual sync completed - cronjobs resumed');
  }
}
