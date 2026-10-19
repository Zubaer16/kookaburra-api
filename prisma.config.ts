import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Direct connection for schema migrations; pooled URL for runtime functions.
// Missing URL is allowed for `prisma generate` in docs/health-only mode.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
})
