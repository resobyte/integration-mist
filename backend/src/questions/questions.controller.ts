import { Controller, Get, Post, Param, Query, UseGuards, Body, BadRequestException } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';

@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async findAll(@Query() paginationDto: PaginationDto) {
    const result = await this.questionsService.findAll(paginationDto);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Post(':id/answer')
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async createAnswer(
    @Param('id') id: string,
    @Query('sellerId') sellerId: string,
    @Body() createAnswerDto: CreateAnswerDto,
  ) {
    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) {
      throw new BadRequestException('Invalid question ID');
    }

    if (!sellerId) {
      throw new BadRequestException('sellerId is required');
    }

    const result = await this.questionsService.createAnswer(
      sellerId,
      questionId,
      createAnswerDto.text,
    );

    return {
      success: result.success,
      message: result.message,
    };
  }

  @Get(':id')
  @Roles(Role.PLATFORM_OWNER, Role.OPERATION)
  async findOne(@Param('id') id: string) {
    const question = await this.questionsService.findOne(id);
    return {
      success: true,
      data: question,
    };
  }
}

