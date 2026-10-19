import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { AuthenticatedRequest } from './auth.types'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const role = request.authUser?.role
    if (!role || !['OWNER', 'ADMIN', 'STAFF'].includes(role)) {
      throw new ForbiddenException('Admin role required')
    }
    return true
  }
}
