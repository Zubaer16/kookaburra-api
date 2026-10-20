import { expect, test } from '@playwright/test'
import { randomBytes, randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// This suite runs ONLY through run-api-tests.cjs, which validates an isolated
// local database called kookaburra_api_test before injecting DATABASE_URL.
const makePassword = () => `Test-${randomBytes(16).toString('hex')}-Aa1!`
const makeEmail = () => `api-${randomUUID()}@example.test`

function db() {
  if (process.env.API_TEST_MODE !== 'db' || !process.env.DATABASE_URL) {
    throw new Error('DB API tests require guarded API_TEST_DATABASE_URL setup')
  }
  const url = new URL(process.env.DATABASE_URL)
  if (
    decodeURIComponent(url.pathname.slice(1)) !== 'kookaburra_api_test' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())
  ) {
    throw new Error('Refusing to access a non-test database')
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
}

async function cleanupUser(id: string) {
  const prisma = db()
  try {
    await prisma.user.deleteMany({ where: { id } })
  } finally {
    await prisma.$disconnect()
  }
}

test.describe('Live authentication: isolated local PostgreSQL', () => {
  test('customer register, login, protected profile, refresh rotation, logout', async ({
    request,
  }) => {
    const email = makeEmail()
    const password = makePassword()
    let id: string | undefined
    try {
      const register = await request.post('/v1/auth/register', {
        data: { email, password },
      })
      expect(register.status()).toBe(201)
      const registered = await register.json()
      id = registered.user.id
      expect(registered.user).toMatchObject({ email, role: 'CUSTOMER' })
      expect(registered.accessToken).toEqual(expect.any(String))
      expect(registered.refreshToken).toEqual(expect.any(String))
      expect(registered.user.passwordHash).toBeUndefined()

      const duplicate = await request.post('/v1/auth/register', {
        data: { email, password },
      })
      expect(duplicate.status()).toBe(409)

      const login = await request.post('/v1/auth/login', {
        data: { email, password },
      })
      expect(login.status()).toBe(200)
      const loggedIn = await login.json()
      const me = await request.get('/v1/auth/me', {
        headers: { Authorization: `Bearer ${loggedIn.accessToken}` },
      })
      expect(me.status()).toBe(200)
      expect(await me.json()).toMatchObject({ email, role: 'CUSTOMER' })

      const wrong = await request.post('/v1/auth/login', {
        data: { email, password: makePassword() },
      })
      expect(wrong.status()).toBe(401)

      const refusedAdmin = await request.post('/v1/admin/auth/login', {
        data: { email, password },
      })
      expect(refusedAdmin.status()).toBe(401)
      const adminMe = await request.get('/v1/admin/auth/me', {
        headers: { Authorization: `Bearer ${loggedIn.accessToken}` },
      })
      expect(adminMe.status()).toBe(403)

      const rotate = await request.post('/v1/auth/refresh', {
        data: { refreshToken: loggedIn.refreshToken },
      })
      expect(rotate.status()).toBe(200)
      const refreshed = await rotate.json()
      expect(refreshed.refreshToken).not.toBe(loggedIn.refreshToken)

      const replay = await request.post('/v1/auth/refresh', {
        data: { refreshToken: loggedIn.refreshToken },
      })
      expect(replay.status()).toBe(401)

      const logout = await request.post('/v1/auth/logout', {
        data: { refreshToken: refreshed.refreshToken },
      })
      expect(logout.status()).toBe(200)
      expect(await logout.json()).toMatchObject({ loggedOut: true })
      const afterLogout = await request.post('/v1/auth/refresh', {
        data: { refreshToken: refreshed.refreshToken },
      })
      expect(afterLogout.status()).toBe(401)
    } finally {
      if (id) await cleanupUser(id)
    }
  })

  test('staff admin login works and customer login rejects staff accounts', async ({
    request,
  }) => {
    const email = makeEmail()
    const password = makePassword()
    let id: string | undefined
    try {
      const register = await request.post('/v1/auth/register', {
        data: { email, password },
      })
      expect(register.status()).toBe(201)
      id = (await register.json()).user.id
      const prisma = db()
      try {
        await prisma.user.update({ where: { id }, data: { role: 'STAFF' } })
      } finally {
        await prisma.$disconnect()
      }

      const adminLogin = await request.post('/v1/admin/auth/login', {
        data: { email, password },
      })
      expect(adminLogin.status()).toBe(200)
      const tokens = await adminLogin.json()
      expect(tokens.user.role).toBe('STAFF')
      const me = await request.get('/v1/admin/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      expect(me.status()).toBe(200)
      expect(await me.json()).toMatchObject({ email, role: 'STAFF' })

      const customerLogin = await request.post('/v1/auth/login', {
        data: { email, password },
      })
      expect(customerLogin.status()).toBe(401)
    } finally {
      if (id) await cleanupUser(id)
    }
  })
})
