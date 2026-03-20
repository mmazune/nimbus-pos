# Postman Guide — Nimbus POS

## Directory Structure

```
postman/
├── POSTMAN_GUIDE.md
├── collections/
│   ├── M0-Repo-Bootstrap.postman_collection.json
│   └── M1-Health-DB.postman_collection.json
└── environments/
    └── dev.postman_environment.json
```

## Setup

1. Import the **environment** file `postman/environments/dev.postman_environment.json` into Postman.
2. Import the relevant **collection** from `postman/collections/`.
3. Select the `Nimbus POS — Dev` environment.
4. Run requests.

## Conventions

- One collection per milestone (minimum).
- Collections are named `M<N>-<Short-Name>.postman_collection.json`.
- Each collection should include test scripts that validate response shape.
- Environment variables are used for `baseUrl`, tokens, and dynamic IDs.

## Token Capture

> **Note:** Auth is not implemented until **M2**. Token capture scripts will be
> added to the login request in the M2 collection. Until then, the health
> endpoint requires no authentication.

## Milestone Coverage

| Milestone | Collection          | Auth Required              |
| --------- | ------------------- | -------------------------- |
| M0        | `M0-Repo-Bootstrap` | No                         |
| M1        | `M1-Health-DB`       | No                         |
| M2+       | (future)            | Yes — token capture begins |

## Manual Checklist — M0

- [ ] Import `dev.postman_environment.json`
- [ ] Import `M0-Repo-Bootstrap.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200` with `{ "status": "ok" }`
- [ ] Confirm no auth headers are required

## Manual Checklist — M1

- [ ] Import `dev.postman_environment.json` (if not already imported)
- [ ] Import `M1-Health-DB.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200`
- [ ] Verify `status` = `"ok"`
- [ ] Verify `db` = `"ok"`
- [ ] Verify `timestamp` exists and is a valid ISO string
- [ ] Confirm no auth headers required
- [ ] Note: auth/token capture starts in M2, not M1
