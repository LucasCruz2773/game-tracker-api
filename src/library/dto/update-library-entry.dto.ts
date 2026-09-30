import { OmitType } from '@nestjs/swagger';
import { AddToLibraryDto } from './add-to-library.dto.js';

export class UpdateLibraryEntryDto extends OmitType(AddToLibraryDto, [
  'gameId',
] as const) {}
