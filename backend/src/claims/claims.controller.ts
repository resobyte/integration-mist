import { Controller, Get, Post, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ApproveClaimDto } from './dto/approve-claim.dto';

@Controller('claims')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async findAll(@Query() paginationDto: PaginationDto) {
    const result = await this.claimsService.findAll(paginationDto);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async findOne(@Param('id') id: string) {
    const claim = await this.claimsService.findOne(id);
    return {
      success: true,
      data: claim,
    };
  }

  @Post('approve')
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async approveClaim(@Body() approveClaimDto: ApproveClaimDto) {
    const result = await this.claimsService.approveClaim(
      approveClaimDto.claimId,
      approveClaimDto.storeId,
      approveClaimDto.claimLineItemIds,
    );
    return {
      success: result.success,
      message: result.message,
    };
  }
}

