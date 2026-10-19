import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createHttpApp } from '../src/bootstrap'

describe('Phase 02 API smoke tests (no real database)', () => {
  let app: INestApplication
  beforeAll(async () => {
    app = await createHttpApp()
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
  })

  it('serves versioned liveness, with correlation header', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'commerce-api',
      version: '0.2.0',
    })
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('keeps commerce endpoints unavailable until Phase 03/04', async () => {
    await request(app.getHttpServer()).get('/v1/products').expect(404)
  })
  it('allows trusted frontend origins', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'http://localhost:3001')
      .expect('Access-Control-Allow-Origin', 'http://localhost:3001')
      .expect(200)
  })
  it('rejects untrusted CORS origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'https://unknown.example')
      .expect(200)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
  it('protects admin /me without bearer token', async () => {
    await request(app.getHttpServer()).get('/v1/admin/auth/me').expect(401)
  })
  it('rejects invalid customer registration payload before the database', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'invalid', password: 'short' })
      .expect(400)
  })
})
