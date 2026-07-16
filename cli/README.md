# CRO — Canton Recovery Orchestration CLI

Offline party replication orchestration: plan, live preflight, apply, resume, fault drills.
Real Canton runner + stub fallback for unit tests. No keys, no dashboard.

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

ASCII banner prints once per process. Hide it with:

```text
$env:CRO_NO_BANNER = "1"   # PowerShell
export CRO_NO_BANNER=1     # bash
```

## Fault drill (stub)

```powershell
npm run cro -- init --run demo-broken
npm run cro -- drill --run demo-broken --fault broken-acs-import
# Expect: DIAGNOSIS + diagnosis.json + import_acs=failed, reconnect=pending
```

## Live drills (real Canton)

```bash
bash cli/scripts/live-drill.sh
bash cli/scripts/live-fault-drill.sh
```

## Tests

```powershell
npm test
```

Demo proof steps: see root [`README.md`](../README.md).
