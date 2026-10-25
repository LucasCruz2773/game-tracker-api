import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class UsernameParamDto {
  @ApiProperty({ example: 'lucas_fernandes' })
  @Matches(/^[a-z0-9_]{3,30}$/)
  username: string;
}
