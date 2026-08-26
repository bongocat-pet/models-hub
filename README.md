# models-hub

Model registry, preview CDN, and package publisher for the BongoCat website.

## Public API

- `GET /models.json` returns every discovered model and its download metadata.
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
    │   └── Model Name.webp   # preview with the same model directory name
    └── Model Name/
        └── .../config.json   # a complete Bongo-Cat-Mver package
```

`yuhen` already follows this contract. New matching repositories and models are
picked up by the half-hourly sync without editing this repository.

## Publishing flow

The catalog sync reads GitHub trees without cloning large model repositories and
commits `data/models.json` only when source metadata changes. A catalog change
triggers the package workflow, which creates one ZIP for each model and replaces
the assets on the stable `models` GitHub Release. Cloudflare Workers Builds runs
`npm run build:assets`, sparse-checkouts only avatars and previews, and deploys
those lightweight assets with the Worker.

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
