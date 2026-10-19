import { validateEnvironment } from './environment'

describe('environment configuration', () => {
  it('uses restrictive defaults for local dev', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      SWAGGER_ENABLED: true,
      CORS_ORIGINS: '',
      DATABASE_URL: '',
    })
  })
  it('requires explicit allowed origins and database secrets in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'CORS',
    )
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://shop.example',
      }),
    ).toThrow('JWT')
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://shop.example',
        JWT_ACCESS_SECRET: 'x'.repeat(40),
      }),
    ).toThrow('DATABASE')
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://shop.example',
        JWT_ACCESS_SECRET: 'x'.repeat(40),
        DATABASE_URL: 'postgresql://local.example/db',
      }),
    ).not.toThrow()
  })
  it('rejects wildcard, paths and insecure production origins', () => {
    for (const origin of [
      '*',
      'https://shop.example.com/path',
      'http://shop.example.com',
    ]) {
      expect(() =>
        validateEnvironment({ NODE_ENV: 'production', CORS_ORIGINS: origin }),
      ).toThrow()
    }
  })
  it('rejects invalid ports and malformed docs flag', () => {
    expect(() => validateEnvironment({ PORT: '-4' })).toThrow()
    expect(() =>
      validateEnvironment({ SWAGGER_ENABLED: 'sometimes' }),
    ).toThrow()
  })
})
