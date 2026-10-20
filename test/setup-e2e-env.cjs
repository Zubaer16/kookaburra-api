/* global process: readonly */
// Set before AppModule import and configuration evaluation.
process.env.NODE_ENV = 'test'
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001'
// Required by OpenAPI contract/order E2E tests; production config is unchanged.
process.env.SWAGGER_ENABLED = 'true'
process.env.DATABASE_URL = ''
process.env.JWT_ACCESS_SECRET = ''
