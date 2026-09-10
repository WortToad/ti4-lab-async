# Host TI4Toad at obsecsolutions.com/ti4

Use one Railway service running this repository's Dockerfile and one persistent
volume for SQLite. The main domain can point directly to this service: visiting
`https://obsecsolutions.com/` redirects into `/ti4/`. No separate database server,
proxy service, or object storage account is needed.

## Expected cost

Prices checked 10 September 2026, in **USD**, excluding tax, exchange fees, and
renewal of your existing domain.

| Option | Monthly hosting cost | Suitability |
| --- | --- | --- |
| Free | $0, with $1 of monthly usage credit | An experiment for very occasional use; usage and memory limits can interrupt availability. |
| Hobby | Minimum $5, including $5 of resource usage | Recommended for this app. Budget **$5–10/month** initially for a small group. |

The $5–10 range is an estimate, not a fixed price. Extra usage above the included
$5 is billed; $8 of usage means an $8 total, not $13.
[Plans](https://docs.railway.com/pricing/plans) and
[billing examples](https://docs.railway.com/pricing/understanding-your-bill).

Railway's published resource rates are:

| Resource | Rate |
| --- | --- |
| Average RAM while running | $10 per GB per month |
| Average CPU consumed | $20 per vCPU per month |
| Persistent storage used | $0.15 per GB per month |
| Outbound traffic | $0.05 per GB |

For example, 0.25 GB average RAM, 0.02 average vCPU, 0.5 GB storage, and 5 GB outbound
traffic works out to about $3.23 of resources, covered by Hobby's $5 minimum.
A busier example with 0.5 GB RAM, 0.05 vCPU, 1 GB storage, and 10 GB outbound is
about $6.65 total. These are illustrative workloads, not measured monthly usage.
[Resource pricing](https://railway.com/pricing).

## Deploy

1. Commit and push the prepared app to a GitHub repository you control. The
   downloaded `TI4_map_generator_bot` reference directory is not needed and
   should not be added. Alternatively, deploy your local directory using the
   Railway CLI; `.railwayignore` excludes the reference download and local data.
2. In Railway, create a project and add this GitHub repository as a service.
   Use the repository root as the source directory. Railway automatically
   detects the root `Dockerfile`.
3. Before the final deployment, open **Variables → Raw Editor** and paste the
   values from [`.env.railway.example`](../.env.railway.example):

   ```dotenv
   NODE_ENV=production
   TI4_BASE_PATH=/ti4
   VITE_PUBLIC_ORIGIN=https://obsecsolutions.com
   TI4_LAB_DATABASE_PATH=file:///data/sqlite.db
   DISCORD_DISABLED=true
   R2_INTEGRATION_DISABLED=true
   VITE_POSTHOG_KEY=
   ```

4. Attach a **persistent volume** to this service with mount path **`/data`**.
   Start with the smallest practical size (0.5–1 GB is ample for a small number
   of drafts). A directory inside the container alone does not persist across
   deployments. SQLite migrations run automatically at startup, after the
   volume is mounted.
5. Use the following service settings:

   | Setting | Value |
   | --- | --- |
   | Build | Detected Dockerfile; no build command override |
   | Start | Dockerfile command; no override |
   | Health check | `/health` |
   | Health check timeout | 120 seconds |
   | Replicas | **1** (SQLite and live draft rooms live in this instance) |
   | CPU limit | Start with 1 vCPU |
   | Memory limit | Start with 1 GB; inspect peaks before reducing |
   | Region | Closest available to your players; Singapore is a reasonable starting point for Australia |
   | Serverless | Enable, then deploy to apply the setting |

6. Deploy, then generate a Railway public domain in **Settings → Networking**.
   Test `https://YOUR-SERVICE.up.railway.app/ti4/`. The server listens on Railway's
   supplied `PORT`; use that port as the networking target. If the interface
   needs an explicit fixed target, set `PORT=3000` and target port `3000`.
7. After checking the generated domain, connect your own domain as below.

The two public URL variables are used during the build. Rebuild after changing
`TI4_BASE_PATH` or `VITE_PUBLIC_ORIGIN`; restarting an old build is insufficient.
Shared links use the configured public origin even while you test using the
Railway-generated hostname.

Railway documentation: [Dockerfile deployment and build variables](https://docs.railway.com/builds/dockerfiles),
[persistent volumes](https://docs.railway.com/volumes).

## Connect the domain

1. In the app service, select **Settings → Networking → Custom Domain**.
2. Enter **`obsecsolutions.com`**. Enter only the hostname; `/ti4` is handled by
   the app, not by DNS.
3. At your DNS provider, add the routing record and ownership **TXT** record
   exactly as Railway displays them. For the root domain (`@`), the provider
   must support CNAME flattening, ALIAS, or ANAME. Keep existing mail/MX and
   unrelated TXT records if the domain is used for email.
4. Wait for Railway to verify the domain and issue its HTTPS certificate.
5. Open `https://obsecsolutions.com/ti4/`, create a draft, and open its shared
   link in another browser. Confirm the draft remains after a service restart.

Use Railway's actual record values; a DNS target cannot be specified until the
service's custom domain is created. If the current DNS provider cannot point an
apex domain at Railway, a provider supporting CNAME flattening is needed.
[Custom domains and DNS](https://docs.railway.com/networking/domains/working-with-domains),
[apex domain record requirements](https://docs.railway.com/integrations/api/manage-domains).

## Keep the bill low

- Keep a single service and volume. The app serves both the web interface and
  backend; no Postgres, Redis, or separate frontend service is necessary.
- Enable Serverless. It can sleep after roughly 5–10 minutes without outbound
  traffic. Closed browser tabs and disabled Discord integration allow idle
  sleep; active Socket.IO connections keep sending traffic. Expect a delay on
  the first visit after sleep, and occasionally a retry. Storage still exists
  while the service sleeps. [Serverless behavior](https://docs.railway.com/deployments/serverless).
- Keep `DISCORD_DISABLED=true` unless you need a connected bot. Keeping a bot
  connected will generally prevent sleeping. Leave `R2_INTEGRATION_DISABLED=true`
  to serve image exports directly; a separate R2 account is optional.
- RAM limits are ceilings, not reserved capacity. Railway bills actual use.
  Reducing a limit below image-rendering peaks can crash the app.
- In workspace **Usage**, set a $5 email alert and a $10 compute hard limit
  (or your preferred budget). **Reaching the hard limit takes the workspace's
  workloads offline.** Account for any other services in that workspace.
  Railway Agent usage is separate; it is not needed to run this app.
  [Cost controls](https://docs.railway.com/pricing/cost-control).
- Inspect the estimated monthly bill after a week and adjust your budget based
  on actual usage. [Railway's estimation guidance](https://docs.railway.com/pricing/faqs).

The Docker image excludes the downloaded bot, local databases, and Chrome. It
reuses the built public assets for image rendering. Static assets have browser
cache headers. Draft image exports work with R2 disabled. Analytics stays off
unless you supply your own `VITE_POSTHOG_KEY`.

## Data and local verification

New deployments start with a new database. If you need drafts from an existing
installation, take a consistent SQLite backup and import it into `/data` while
the new service is stopped. Download periodic database backups or enable Railway
volume backups; account for their storage usage. Do not rely on an ephemeral
container directory as a backup.

To test the deployment locally with Node 22 and installed dependencies:

```sh
TI4_BASE_PATH=/ti4 VITE_PUBLIC_ORIGIN=http://localhost:3000 yarn build
TI4_BASE_PATH=/ti4 VITE_PUBLIC_ORIGIN=http://localhost:3000 \
  TI4_LAB_DATABASE_PATH=file:///absolute/path/ti4.sqlite \
  DISCORD_DISABLED=true R2_INTEGRATION_DISABLED=true yarn start
```

Open `http://localhost:3000/ti4/`. Leaving `TI4_BASE_PATH` unset supports the
original root-hosted layout. To use a subdomain later, rebuild with an empty
base path and that subdomain as `VITE_PUBLIC_ORIGIN`.

Local verification for this change: production build and TypeScript checks
passed; 18 focused URL, database, and draft-access tests passed. Browser checks
covered navigation, assets, RAW and bag draft creation, private share links,
and the WebSocket connection under `/ti4`. HTTP checks covered Mantis cookies,
map PNGs with R2 disabled, map likes, `/health`, and persistence after restart.
The broader test run had 138 passing tests and 5 failures in the existing
randomized Milty-EQ generator tests. Those generator failures remain unresolved.
Docker is unavailable in this workspace, so the container build and the real
Railway/DNS deployment still need verification on Railway.

This guide uses the dashboard and Dockerfile because Railway's old
`railway.json`/`railway.toml` format is deprecated for new services. Existing
legacy configurations have a published cutoff of 1 December 2026.
[Configuration migration](https://docs.railway.com/config-as-code).
