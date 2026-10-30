# Toon Platform

Studio website for Toon Comics and Studios, featuring Volcano Racers and STARFALL.

## Run locally

Use Python 3 to serve the static site:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. No installation, API keys or build step is required.

## Design and features

Graphite and chrome design with metallic silver surfaces, blue accents, responsive layouts, accessible focus states and reduced-motion support. Includes a switchable series spotlight, six-saga catalog with search and filters, world dossiers, edition-note dialogs, reading-order guides, browser-local reading marks and shortlist, enlarged cover artwork, development slate and medium guide.

## Content and data

The two worlds are separate universes. Catalog data lives in `dist/app.js`. Source reader inventory, script drafts, illustrated proofs and finished releases are separate stages. Development links go to owner-controlled ChatGPT Library documents and retain their own access permissions. No accounts, checkout, completed television season, or finished retail editions are claimed. Browser-local reading marks and shortlist do not sync or grant access to books.

## Hosting

Serve `dist/` as a static directory. The included Vercel configuration uses that output directory without a build. This repository is a reviewable source import; it does not automatically replace the existing Sites source repository or change its private audience. Public repository visibility does not grant access to linked private source documents.

## Validation

JavaScript syntax, local asset links, unique IDs and internal section targets were checked. Visual browser QA and full interaction testing remain pending. Sites publication is blocked by DNS resolution of its source Git host in this execution environment.
