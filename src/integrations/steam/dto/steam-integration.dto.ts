import { ApiProperty } from '@nestjs/swagger';

export class SteamAccountDto {
  @ApiProperty()
  steamId: string;

  @ApiProperty()
  personaName: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ type: Date, nullable: true })
  lastSyncedAt: Date | null;
}

export class SteamIntegrationStatusDto {
  @ApiProperty()
  connected: boolean;

  @ApiProperty({ type: SteamAccountDto, nullable: true })
  account: SteamAccountDto | null;
}

export class SteamLibraryItemDto {
  @ApiProperty()
  appId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  playtimeMinutes: number;

  @ApiProperty()
  imported: boolean;
}

export class SteamSyncResultDto {
  @ApiProperty({ type: [SteamLibraryItemDto] })
  items: SteamLibraryItemDto[];

  @ApiProperty()
  totalOwned: number;

  @ApiProperty()
  totalPlayed: number;

  @ApiProperty()
  updatedLibraryEntries: number;
}

export class SteamImportResultDto {
  @ApiProperty()
  imported: number;

  @ApiProperty()
  updated: number;

  @ApiProperty({ type: [Number] })
  unmatchedAppIds: number[];
}
