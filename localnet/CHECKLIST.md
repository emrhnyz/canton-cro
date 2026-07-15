# Ortam hazır checklist — Aşama 0B

## Durum özeti (2026-07-15)

| Madde | Sonuç |
|--------|--------|
| DA roadmap (0A) | Not edilmiş: party-level recovery tooling yakın roadmap’te yok |
| Docker / WSL | **YOK** → Splice cn-quickstart LocalNet **BLOCKED** (şimdilik) |
| Native Canton OSS 3.5.8 | **OK** |
| OpenJDK 17 | **OK** (`Microsoft.OpenJDK.17`) |
| 2 bağımsız participant | **OK** (`participant1` + `participant2`) |
| Synchronizer (sequencer+mediator) | **OK** |
| Cross-participant ping | **OK** (~3910 ms round-trip, exit 0) |
| Recovery tool kodu | Yazılmadı (kısıta uyuldu) |

## Checklist

- [x] JDK 17+ kurulu ve `JAVA_HOME` set
- [x] Canton OSS extract (`vendor/canton-open-source-3.5.8`)
- [x] TR Windows locale fix (`-Duser.language=en -Duser.country=US`)
- [x] `simple-topology.conf` — 2 participant + sequencer + mediator
- [x] `simple-ping.canton` bootstrap çalıştı
- [x] Logda: `Starting ping` → `responding to a ping` → `Observed archival of ping`
- [x] Exit code 0 + `Shutdown complete`
- [ ] (Opsiyonel ileri) Docker Desktop + WSL2 → cn-quickstart Splice LocalNet
- [ ] (Sonraki aşama) Manuel offline party replication baseline — Aşama 1

## Sağlık kanıtı (özet)

Kaynak log: `vendor/canton-open-source-3.5.8/log/canton.log` (çıkış: `localnet/out/`)

```
Starting ping PingRequest(... target = participant1::1220d3b963d6...)
Successfully submitted ping ...
participant1 ... responding to a ping from participant2::12200f5da490...
Observed archival of ping contract after 3910 milliseconds
Shutdown complete.
```

Tekrar koşmak:

```powershell
.\localnet\scripts\health-check.ps1
```

## BLOCKER notu

**Splice LocalNet (cn-quickstart):** Docker Desktop ve WSL kurulu olmadığı için **BLOCKER**.  
**PoC ön koşulu (2 bağımsız participant):** Native Canton ile **karşılandı** — PoC’ye native topoloji üzerinde geçilebilir.

`canton-compose` #93 tipi hand-wire gerekmedi; upstream `01-simple-topology` yeterli.
