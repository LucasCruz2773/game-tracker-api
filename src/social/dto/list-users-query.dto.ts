import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Searches by username or display name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
