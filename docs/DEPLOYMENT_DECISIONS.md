# Host portability rules

- One deployment per client (not a multi-tenant data plane).
- Domain, origins, database, payment keys, mail and media credentials belong to client.
- Demo API: Vercel Functions (Nest entry `src/main.ts`); client API: Vercel or persistent VPS/Docker.
- No persistent in-memory state, filesystem uploads or fire-and-forget deletes assumed on Vercel.
- Cloudinary may hold multiple unrelated developer projects separated by project prefixes. Keep actual provider asset ID/storage key and references in database; avoid deleting files merely by assumed URL/folder name.
- Media deletion is logically marked and durably retried. Only unreferenced assets can be destroyed. CDN invalidation is best-effort/reconciled.
- Redis, RabbitMQ, and WebSocket are **not required** for baseline version. Add after measured need and provision appropriate workers.
- A Vercel Hobby plan may be unsuitable for commercial software showcases or client deployments; check provider's current terms and service limits.
