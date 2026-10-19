import { Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const logger = new Logger('HTTP')
/** Avoid logging credentials, cookies, request bodies or potentially sensitive query strings. */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = process.hrtime.bigint()
  const requestId = randomUUID()
  res.setHeader('X-Request-Id', requestId)
  res.once('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000
    const path =
      (req.originalUrl || req.url).split('?')[0]?.replace(/[\r\n\t]/g, '') ??
      '/'
    logger.log(
      `${req.method} ${path} -> ${res.statusCode} (${elapsedMs.toFixed(0)}ms) [${requestId.slice(0, 8)}]`,
    )
  })
  next()
}
