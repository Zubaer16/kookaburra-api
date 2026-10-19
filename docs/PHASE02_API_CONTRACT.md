# Phase 02 API contract and security notes

Base URL local: `http://localhost:4000` / prefix `/v1`. All JSON over HTTPS in deployment. Swagger groups each _implemented_ endpoint by functional module.

| Swagger module            | Method | Path                   | Purpose                                                                                       |
| ------------------------- | ------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| System / Health           | GET    | `/v1/health`           | Liveness only (does not check DB).                                                            |
| Authentication / Customer | POST   | `/v1/auth/register`    | Customer creates account, requires email + 12..128 char password. Email verification pending. |
| Authentication / Customer | POST   | `/v1/auth/login`       | CUSTOMER user only; email + password.                                                         |
| Authentication / Customer | POST   | `/v1/auth/refresh`     | Exchange current opaque refresh token for rotated pair.                                       |
| Authentication / Customer | POST   | `/v1/auth/logout`      | Revoke presented opaque refresh token.                                                        |
| Authentication / Customer | GET    | `/v1/auth/me`          | Bearer access JWT required.                                                                   |
| Authentication / Admin    | POST   | `/v1/admin/auth/login` | STAFF/ADMIN/OWNER only (existing account; no public create).                                  |
| Authentication / Admin    | GET    | `/v1/admin/auth/me`    | Access JWT + staff role required.                                                             |

**Example request:**

```http
POST /v1/auth/login
Content-Type: application/json

{"email":"customer@example.com","password":"REPLACE_WITH_TEST_PASSWORD"}
```

**Example response shape:**

```json
{
  "accessToken": "<short-lived JWT>",
  "refreshToken": "<one-time opaque secret>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "<uuid>",
    "email": "customer@example.com",
    "role": "CUSTOMER"
  }
}
```

Response is not a cookie session; frontends haven't been connected. Browser app integration must address secure refresh-token transport/storage (prefer HttpOnly secure cookies/BFF), CSRF policy when cookies are used, and cross-domain configuration. The server hashes refresh tokens and stores only their SHA-256 digests; no request body/token is logged.

**Prisma schema foundation (no CRUD yet):** `User`, `AuthSession`, `AuditEvent`, `Category`, `Product`, `ProductVariant`, `ProductCategory`, `OutboxEvent`, `IdempotencyRecord`. Price stored in minor units, currency code text, variant options JSON. Variant-bearing products track stock at variant level; simple products at product level. Future writes must enforce consistency between these states. Outbox is a _table only_; no async dispatcher has yet been built.

## Important pending work

- Login and signup distributed throttling; email verification, password reset, compromised-password policy; complete permissions/role matrix.
- Password hashing in this patch uses Node core scrypt with salt and constant-time verify (not plaintext). Changing the algorithm requires versioned verification/migration.
- PostgreSQL integration tests and migration drift check on a real, isolated DB.
- Purchase totals, stock reservations, payments and media lifecycle are not implemented.
- No client-facing store branding is hardcoded in this API contract.
