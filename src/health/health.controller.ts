import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { LivenessResponseDto } from './health.dto'

@ApiTags('System / Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Liveness probe (not database or payment readiness)',
  })
  @ApiOkResponse({ type: LivenessResponseDto })
  liveness(): LivenessResponseDto {
    return {
      status: 'ok',
      service: 'commerce-api',
      version: '0.2.0',
      timestamp: new Date().toISOString(),
    }
  }
}
