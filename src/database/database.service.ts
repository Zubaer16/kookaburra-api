import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { Environment } from '../config/environment'

/** Client-owned external PostgreSQL. Does not connect on liveness-only builds. */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly instance: PrismaClient | null
  constructor(config: ConfigService<Environment, true>) {
    const url = config.get('DATABASE_URL', { infer: true })
    this.instance = url
      ? new PrismaClient({
          adapter: new PrismaPg({
            connectionString: url,
            max: 3,
            connectionTimeoutMillis: 5000,
          }),
        })
      : null
  }

  get client(): PrismaClient {
    if (!this.instance) {
      throw new ServiceUnavailableException(
        'Database is not configured; set DATABASE_URL and apply migrations',
      )
    }
    return this.instance
  }

  async onModuleDestroy(): Promise<void> {
    if (this.instance) await this.instance.$disconnect()
  }
}
