import type { UserRole } from '../generated/prisma/enums'

export type SafeUser = { id: string; email: string; role: UserRole }
export type AuthenticatedRequest = {
  headers: { authorization?: string }
  authUser?: SafeUser
}
