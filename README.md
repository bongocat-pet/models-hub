# models-hub

Model registry, preview CDN, and package publisher for the BongoCat website.

## Public API

- `GET /models.json` returns every discovered model with its primary R2 URL and
  GitHub Release fallback URL.
- `GET /previews/:repository/:model.webp` serves model previews.
- `GET /avatars/:repository/a.*` serves creator avatars.
- `GET /health` reports Worker health.

The recommended production origin is `https://models.bongocat.pet`. The API is
public, CORS-enabled, and designed for `official-website` and third-party clients.

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
