# Kurulum notları / kırılanlar

## 1) Splice LocalNet — BLOCKED

- **Ne denendi:** cn-quickstart / Docker Compose LocalNet
- **Kırılan:** `docker` komutu yok; Docker Desktop yok; WSL yüklü değil
- **Elle düzenlenen dosya:** yok (kuruluma geçilemedi)
- **Etki:** Splice 3-validator LocalNet bu makinede yok
- **Çözüm yolu:** Docker Desktop + WSL2 kur → sonra cn-quickstart `make setup && make start`
- **PoC etkisi:** Kritik değil — native 2-participant topoloji yeterli

## 2) Türkçe Windows locale — Kırıldı, düzeltildi

- **Belirti:** Participant start fatal:
  `IllegalArgumentException: non expected non first character 0x130 in Daml-LF Name "TİME"`
- **Neden:** TR locale `i` → `İ` (U+0130); Daml-LF identifier `TIME` bozuluyor
- **Elle düzenlenen dosya:** yok — runtime JVM flag
- **Fix:**
  ```
  JAVA_TOOL_OPTIONS=-Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8
  ```
  (`localnet/scripts/health-check.ps1` bunu set ediyor)

## 3) Config hand-wire

- **Durum:** Gerekmedi
- **Kullanılan:** `vendor/canton-open-source-3.5.8/examples/01-simple-topology/` (upstream, diff yok)
- canton-compose #93 senaryosu (custom multi-node HOCON) bu aşamada gerekmedi

## 4) JDK

- Sistemde Java 8 vardı (yetersiz)
- `winget install Microsoft.OpenJDK.17` ile 17.0.19 kuruldu
