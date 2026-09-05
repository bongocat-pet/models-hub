# models-hub

Model registry, preview CDN, and package publisher for the BongoCat website.

## Public API

- `GET /models.json` returns every discovered model with its tracked R2 download
  URL and GitHub Release fallback URL, plus public download and workshop click counts.
- `GET /download/:model-id` records a free-package download and redirects to R2.
- `GET /workshop/:model-id` records a workshop click and redirects to the
  creator's Bilibili page.
- `GET /previews/:repository/:model.webp` serves model previews.
- `GET /avatars/:repository/a.*` serves creator avatars.
- `GET /health` reports Worker health.

The recommended production origin is `https://models.bongocat.pet`. The API is
public, CORS-enabled, and designed for `official-website` and third-party clients.

### D1 event storage

Download and workshop counters are stored in Cloudflare D1. Each IP is stored
only as a hash for deduplication: the same hashed IP, model, and event type is
counted at most once in a rolling 24-hour window. Repeated requests still
redirect normally. The Worker keeps serving and redirecting normally when no
D1 binding is configured, but counts will remain zero until the binding is
added. The production database is already declared in `wrangler.jsonc`; for a
new environment, create a database and apply the included migrations:

```bash
npx wrangler d1 create bongocat-model-stats
npx wrangler d1 migrations apply bongocat-model-stats --remote
```

Set a private salt for IP hashing in production:

```bash
npx wrangler secret put IP_HASH_SECRET
```

Then add the returned binding to `wrangler.jsonc` (replace the ID with the value
printed by Wrangler), if it is not already present:

```jsonc
"d1_databases": [{
  "binding": "DB",
  "database_name": "bongocat-model-stats",
  "database_id": "YOUR_D1_DATABASE_ID",
  "migrations_dir": "./migrations"
}]
```

## Repository contract

Every public, non-archived, non-fork repository in `bongocat-pet` is inspected.
It is included automatically when it contains:

```text
creator-repository/
├── README.md                 # standalone creator profile URLs
├── a.webp                    # one root avatar: gif/webp/png/jpg/jpeg
└── models/
    ├── webp/
    │   ├── Model Name.webp   # preview with the same model directory name
    │   └── links.json         # optional full-version URL by model name
    └── Model Name/
        └── .../config.json   # a complete Bongo-Cat-Mver package
```

`yuhen` already follows this contract. New matching repositories and models are
picked up by the half-hourly sync without editing this repository.

Repositories ending in `-custom` are classified as custom works. For example,
`qianqiuqiu-custom` is displayed on the website's `/custom` page. Custom
repositories only need previews and are not packaged or uploaded to R2.
Their previews may be placed directly in `models/` (or in `models/webp/`).

Custom repository README files may also provide the artist's service details
using `# About` and `# Pricing` sections. `About` is displayed as the full
service description, while `Pricing` is intended for a short, language-neutral
price or price range such as `100` or `100-300`. The website localizes the
starting-price label when a single price is provided.

When present, `models/webp/links.json` is a JSON object whose keys exactly match
model directory names and whose values are public HTTPS full-version pages.

## Publishing flow

The catalog sync reads GitHub trees without cloning large model repositories and
commits `data/models.json` only when source metadata changes. A catalog change
triggers the package workflow, which creates one ZIP for each model, synchronizes
the packages to `models/<repository>/<model folder>.zip` in Cloudflare R2, verifies the public custom
domain, and then replaces the assets on the stable `models` GitHub Release as a
fallback. Cloudflare Workers Builds runs `npm run build:assets`, sparse-checkouts
only avatars and previews, and deploys those lightweight assets with the Worker.
Hashed R2 package paths remain available for cached manifests during catalog
rollouts, so an older page never loses its active download URL.

The package workflow requires these GitHub Actions repository settings:

```text
Secrets:  CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
Variables: R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
```

Production uses `R2_PUBLIC_BASE_URL=https://downloads.bongocat.pet` and bucket
`bongocat-model-packages`. The R2 token should have object read/write access only
to that bucket.

Connect this repository to Cloudflare Workers Builds with deploy command
`npx wrangler deploy`, then bind the Worker to `models.bongocat.pet`.

## Local development

With `yuhen` next to this repository:

```bash
npm install
npm run catalog:local
npm test
npm run dev
```
