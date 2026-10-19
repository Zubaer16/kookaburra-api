import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { Environment } from '../config/environment'
import type { UserRole } from '../generated/prisma/enums'
import { CredentialsDto, RefreshDto, TokenPairDto } from './auth.dto'
import { hashPassword, verifyPassword } from './password'
import { SafeUser } from './auth.types'

const REFRESH_MS = 30 * 24 * 60 * 60 * 1000
const ACCESS_SECONDS = 15 * 60
const normalize = (email: string): string => email.trim().toLowerCase()
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private async issue(
    user: SafeUser,
    familyId = randomUUID(),
  ): Promise<TokenPairDto> {
    const refreshToken = randomBytes(48).toString('base64url')
    await this.database.client.authSession.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_MS),
      },
    })
    return this.pair(user, refreshToken)
  }

  private async pair(
    user: SafeUser,
    refreshToken: string,
  ): Promise<TokenPairDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'access', role: user.role },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: ACCESS_SECONDS,
        issuer: 'commerce-api',
        audience: 'commerce-clients',
        algorithm: 'HS256',
      },
    )
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_SECONDS,
      user,
    }
  }

  async register(dto: CredentialsDto): Promise<TokenPairDto> {
    const email = normalize(dto.email)
    const exists = await this.database.client.user.findUnique({
      where: { email },
    })
    if (exists)
      throw new ConflictException('An account with this email already exists')
    let user
    try {
      user = await this.database.client.user.create({
        data: {
          email,
          passwordHash: await hashPassword(dto.password),
          role: 'CUSTOMER',
        },
      })
    } catch (error: unknown) {
      // Race on a unique email. Do not expose DB details.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists')
      }
      throw error
    }
    return this.issue({ id: user.id, email: user.email, role: user.role })
  }

  async login(dto: CredentialsDto, adminOnly = false): Promise<TokenPairDto> {
    const user = await this.database.client.user.findUnique({
      where: { email: normalize(dto.email) },
    })
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      (adminOnly ? user.role === 'CUSTOMER' : user.role !== 'CUSTOMER')
    ) {
      throw new UnauthorizedException('Invalid credentials')
    }
    if (!(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials')
    }
    await this.database.client.auditEvent.create({
      data: {
        actorId: user.id,
        action: adminOnly ? 'admin.login' : 'customer.login',
        targetType: 'user',
        targetId: user.id,
      },
    })
    return this.issue({ id: user.id, email: user.email, role: user.role })
  }

  async refresh(dto: RefreshDto): Promise<TokenPairDto> {
    const record = await this.database.client.authSession.findUnique({
      where: { tokenHash: hashToken(dto.refreshToken) },
      include: { user: true },
    })
    if (!record) throw new UnauthorizedException('Invalid refresh token')
    if (record.revokedAt) {
      // Reuse of a rotated token indicates possible compromise; revoke the family.
      await this.database.client.authSession.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Refresh token replay detected')
    }
    if (record.expiresAt <= new Date() || record.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Refresh token expired or user disabled')
    }
    const refreshToken = randomBytes(48).toString('base64url')
    await this.database.client.$transaction(async (tx) => {
      const consumed = await tx.authSession.updateMany({
        where: {
          id: record.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      })
      if (consumed.count !== 1)
        throw new UnauthorizedException('Refresh token already used')
      await tx.authSession.create({
        data: {
          userId: record.userId,
          familyId: record.familyId,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_MS),
        },
      })
    })
    return this.pair(
      { id: record.user.id, email: record.user.email, role: record.user.role },
      refreshToken,
    )
  }

  async logout(dto: RefreshDto): Promise<{ loggedOut: boolean }> {
    const tokenHash = hashToken(dto.refreshToken)
    await this.database.client.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { loggedOut: true }
  }

  async revokeAll(userId: string): Promise<void> {
    await this.database.client.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  // For future permission-scoped RBAC; only role enforcement is live in this phase.
  static isStaff(role: UserRole): boolean {
    return role !== 'CUSTOMER'
  }
}
