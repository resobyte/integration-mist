import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Answer must be at least 10 characters' })
  @MaxLength(2000, { message: 'Answer must not exceed 2000 characters' })
  text: string;
}

