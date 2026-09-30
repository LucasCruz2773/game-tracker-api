import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const LOCAL_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a PostgreSQL connection string',
  })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN_SECONDS: number = 604800;

  @IsString()
  @MinLength(1)
  RAWG_API_KEY: string;

  @IsString()
  @MinLength(1)
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @MinLength(1)
  GOOGLE_CLIENT_SECRET: string;

  @IsUrl(LOCAL_URL_OPTIONS)
  GOOGLE_CALLBACK_URL: string;

  @IsUrl(LOCAL_URL_OPTIONS)
  FRONTEND_URL: string;
}

export function validateEnvironment(
  rawEnvironment: Record<string, unknown>,
): EnvironmentVariables {
  const environment = plainToInstance(EnvironmentVariables, rawEnvironment, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(environment);

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid environment variables:\n- ${messages.join('\n- ')}`,
    );
  }

  return environment;
}
