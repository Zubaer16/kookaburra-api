import { ApiProperty } from '@nestjs/swagger'

export class LivenessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok'

  @ApiProperty({ example: 'commerce-api' })
  service!: string

  @ApiProperty({ example: '0.2.0' })
  version!: string

  @ApiProperty({ example: '2026-10-19T12:00:00.000Z' })
  timestamp!: string
}
