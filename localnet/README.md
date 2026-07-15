# LocalNet / 2-Participant Environment (Aşama 0B)

## Karar

Bu makinede **Docker / WSL yok**. Splice `cn-quickstart` LocalNet (container stack) **BLOCKED**.

Bunun yerine Canton OSS **native 2-participant** topolojisi kuruldu ve **ping ile doğrulandı** — party replication / recovery PoC için gereken ön koşul: iki bağımsız participant + bir synchronizer.

| Yol | Durum |
|-----|--------|
| Splice / cn-quickstart LocalNet (Docker) | **BLOCKED** — Docker Desktop + WSL yok |
| Canton OSS `01-simple-topology` (native) | **READY** — ping OK (~3910 ms) |

> **Türkçe Windows:** Canton’u her zaman `en_US` locale ile çalıştır (`health-check.ps1` yapıyor). Aksi halde `TIME` → `TİME` Daml-LF fatal hatası.

## Bileşenler

- Canton OSS **3.5.8** → `vendor/canton-open-source-3.5.8/`
- OpenJDK **17** (Microsoft Build)
- Config: `examples/01-simple-topology/simple-topology.conf`
  - `participant1` (ledger 5011, admin 5012)
  - `participant2` (ledger 5021, admin 5022)
  - `sequencer1` + `mediator1` (BFT synchronizer)

## Komutlar

### Tek seferlik sağlık kontrolü (başlat → ping → dur)

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd C:\Users\emrhn\Desktop\Canton-CRO\vendor\canton-open-source-3.5.8

.\bin\canton.bat run examples\01-simple-topology\simple-ping.canton `
  -c examples\01-simple-topology\simple-topology.conf
```

Beklenen: bootstrap sonrası `participant2.health.ping(participant1)` başarılı çıkar.

### İnteraktif console (manuel baseline için)

```powershell
.\bin\canton.bat -c examples\01-simple-topology\simple-topology.conf `
  --bootstrap examples\01-simple-topology\simple-ping.canton
```

Console içinde tekrar doğrulama:

```
participant1.health.status
participant2.health.status
participant1.health.ping(participant2)
```

### Yardımcı script

```powershell
.\localnet\scripts\health-check.ps1
```

## Config diff

Hand-wire edilmedi — upstream örnek config **olduğu gibi** kullanıldı. Diff yok.

İleride ayrı JVM süreçleri / Postgres storage gerekirse `examples/04-high-availability/` ve `examples/07-repair/` referans alınır (Docker Postgres ister).

## Splice LocalNet’i sonra açmak

1. Docker Desktop kur (+ WSL2)
2. `git clone https://github.com/digital-asset/cn-quickstart`
3. `make setup && make start` (sv + app-provider + app-user = 3 participant)
4. Orada da `app-provider` ↔ `app-user` ping / party host sağlık kontrolü

Splice LocalNet **şimdilik şart değil**; recovery orchestration PoC native 2-participant üzerinde yürür.
