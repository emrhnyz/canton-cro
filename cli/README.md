# CRO — Canton Recovery Orchestration CLI (skeleton)

Happy-path orchestration + ACS fault drill. Stub runner (no Canton Admin API yet). No keys, no dashboard.

## Setup

```powershell
cd cli
npm install
```

## Commands

```text
npm run cro -- init      --run <id>
npm run cro -- plan      --run <id>
npm run cro -- preflight --run <id>
npm run cro -- apply     --run <id> [--fault none|broken-acs-import|partial-acs-import]
npm run cro -- drill     --run <id> --fault broken-acs-import|partial-acs-import
npm run cro -- resume    --run <id>
npm run cro -- status    --run <id>
```

## Fault drill

```powershell
npm run cro -- init --run demo-broken
npm run cro -- drill --run demo-broken --fault broken-acs-import
# Expect: DIAGNOSIS + diagnosis.json + import_acs=failed, reconnect=pending
```

## Tests

```powershell
npm test
```

Demo proof steps (TR): see root [`README.md`](../README.md) — **Kanıt adımları**.
