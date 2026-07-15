# Manuel baseline — Offline party replication

**Durum:** Prosedür belgesi (docs’tan çıkarım). Bu makinede uçtan uca henüz **elle koşulmadı** — LocalNet’te doğrulama ayrı iş.  
**Kapsam:** Otomasyon kodu yok. Spekülasyon yok; kaynakta yoksa *bilinmiyor / doğrulanacak* yazıldı.  
**Ortam bağlama:** `localnet/` altında Canton OSS 3.5.8 `01-simple-topology` (`participant1` / `participant2`, synchronizer alias genelde `da`). Docs örnekleri `mysynchronizer` kullanır — komutlarda **kendi alias’ını** koy.

---

## Kaynaklar (tek doğruluk)

| Konu | URL / konum |
|------|-------------|
| Offline party replication (Canton Operate **3.5**) | https://docs.digitalasset.com/operate/3.5/howtos/operate/parties/party_replication.html |
| Backup / restore (Postgres örneği) | https://docs.digitalasset.com/operate/3.5/howtos/recover/backup-restore.html |
| Local 2-participant ortamımız | `localnet/README.md`, `vendor/canton-open-source-3.5.8/examples/01-simple-topology/` |

**Bu belgenin kapsadığı ana akış:** *Offline party replication* (party zaten Daml işlemi yaşamışsa zorunlu yol).

**Bilerek dışında:**

- *Simple party replication* (party henüz stakeholder değilse) — aynı sayfada ayrı bölüm; grant PoC odağı offline.
- Party **migration / offboarding** — docs: *currently not supported*.
- Splice validator disaster recovery (identities dump + SV-assisted ACS) — farklı prosedür; bu baseline değil.
- Repair / `participant.repair.import_acs` — party replication’ın `parties.import_party_acs` yolundan ayrı; karıştırma.

---

## Tanımlar

| Terim | Anlam (docs) |
|-------|----------------|
| `source` | Party’yi halihazırda host eden participant |
| `target` | Party’nin ekleneceği yeni participant |
| Offline | Target, ACS import öncesi **tüm synchronizer’lardan disconnect** edilmiş olmalı |
| Onboarding flag | `requiresPartyToBeOnboarded = true` (local) / external için `onboarding = HostingParticipant.Onboarding()` |

**Sıra kuralı (docs uyarısı):** Adımlar **listedeki sırada** yapılmalı. Sapma hatalara ve ciddi manuel düzeltmeye yol açabilir.

**Beklenen gürültü (docs):** Onboarding sırasında target’ta ACS commitment mismatch **beklenen** bir durum; zamanla düzelir — prosedür sırasında bunları “import bozuldu” sanma.

**TR Windows:** Canton console için `JAVA_TOOL_OPTIONS=-Duser.language=en -Duser.country=US` (bkz. `localnet/ISSUES.md`).

---

## Ortak değişkenler (console)

Docs senaryosu; LocalNet’te alias’ı uyarla:

```scala
val source = participant1
val target = participant2
// Docs: "mysynchronizer" | Bizim simple-topology genelde: "da"
val syncAlias = "da"   // veya "mysynchronizer"
val synchronizerId = source.synchronizers.id_of(syncAlias)
// Party: docs senaryoda source üzerinde oluşturulmuş / zaten host edilen party
// val alice = ...  // PartyId
```

Console’u her iki participant’a açık tutmak önerilir (tek makinede ACS dosya taşıması yok). Aksi halde ACS export dosyasını güvenli şekilde target ortamına taşı.

---

## Adım 0 — Senaryo önkoşulu (docs senaryo + bizim ortam)

| Alan | İçerik |
|------|--------|
| **Adım adı** | Ortam ve party hazır |
| **Komut(lar)** | Topoloji ayakta (bizim ortam): `localnet/scripts/health-check.ps1` veya interactive console + bootstrap. Party oluşturma (docs senaryo, local party örneği): `val alice = source.parties.enable("Alice", synchronizer = Some(syncAlias))` |
| **Pre-condition** | İki participant + synchronizer ayakta; birbirini görebildikleri doğrulanmış (`health.ping`). Party `alice`, `source` üzerinde host ediliyor ve (offline yol için) contracts / Daml etkileşimi mevcut **veya** bilerek oluşturduğun sözleşme var. |
| **Post-condition** | `source.parties.list(...)` / topology’de Alice görünür; `synchronizerId` biliniyor. Contract varlığı: *bilinmiyor / doğrulanacak* — docs post-assert için tek komut vermiyor; ACS / ledger sorgusu LocalNet’te doğrulanacak. |
| **Başarısızlık belirtisi** | Node’lar ayağa kalkmıyor; ping fail; party enable hata veriyor. Offline yola “hiç contract yokken” girmek: docs *simple* yolu önerir — yanlış yol seçimi (otomasyon değeri değil, operasyonel tercihi). |

---

## Adım 1 — Target: package vetting

| Alan | İçerik |
|------|--------|
| **Adım adı** | Target’ta gerekli paketleri vet et |
| **Komut(lar)** | ```scala<br>val mainPackageId = source.dars.list(filterName = "CantonExamples").head.mainPackageId<br>target.dars.upload("dars/CantonExamples.dar")<br>target.topology.vetted_packages.list()<br>  .filter(_.item.packages.exists(_.packageId == mainPackageId))<br>  .map(r => (r.context.storeId, r.item.participantId))<br>``` *(örnek DAR adı docs’tan; gerçek senaryoda party’nin stakeholder olduğu paketler)* |
| **Pre-condition** | Source’ta party’nin kullandığı DAR(lar) yüklü. Target participant çalışıyor ve synchronizer’a bağlı (henüz isolation yapılmadı). |
| **Post-condition** | `vetted_packages.list` filtresinde **hem** source **hem** target participant ID’si görünür (docs `res8` örneği). |
| **Başarısızlık belirtisi** | Target listesinde paket yok; upload hata. Sonraki import’ta package/vetting kaynaklı hatalar — tam mesaj: *bilinmiyor / doğrulanacak*. |

---

## Adım 2 — Source: data retention (pruning)

| Alan | İçerik |
|------|--------|
| **Adım adı** | Source retention — export penceresi boyunca veri kalsın |
| **Komut(lar)** | ```scala<br>val pruningSchedule = source.pruning.get_schedule()<br>source.pruning.clear_schedule()<br>``` Sonra (isteğe bağlı, adım 8’de) eski cron/retention ile `set_schedule` geri. |
| **Pre-condition** | Source’ta automatic pruning schedule bilinir veya bilinçli olarak `None`. Party-to-participant mapping’in effective olmasından ACS export bitene kadar süre, retention’dan uzun olmamalı (docs). |
| **Post-condition** | `get_schedule()` → schedule temizlenmiş / otomatik pruning kapalı. |
| **Başarısızlık belirtisi** | Docs: **manuel pruning programatik kapatılamaz** — dış otomasyon prune ederse export fail / eksik ACS riski. Prune sonrası spesifik hata kodu: *bilinmiyor / doğrulanacak*. |

---

## Adım 3 — Target: hosting authorization (onboarding flag)

| Alan | İçerik |
|------|--------|
| **Adım adı** | Target, party’yi onboarding flag ile host etmeyi kabul eder |
| **Komut(lar)** | Local party: ```scala<br>val proposal = target.topology.party_to_participant_mappings.propose_delta(<br>  party = alice,<br>  adds = Seq((target.id, ParticipantPermission.Observation)), // veya Submission; docs örneği Observation<br>  store = synchronizerId,<br>  requiresPartyToBeOnboarded = true<br>)<br>``` External: docs’ta ayrı blok (`onboarding = HostingParticipant.Onboarding()` + key imza) — private key yönetimi bu baseline’da yok. |
| **Pre-condition** | Adım 1 tamam. Target hâlâ synchronizer’a bağlı. **`requiresPartyToBeOnboarded = true` zorunlu** (docs warning). |
| **Post-condition** | Dönüş: `SignedTopologyTransaction` / proposal; mapping’de target `Observation(onboarding)` (veya seçilen permission + onboarding) görünür (docs örnek çıktısı). |
| **Başarısızlık belirtisi** | Onboarding flag unutulursa docs “significant manual correction” uyarır — tam hata metni: *bilinmiyor / doğrulanacak*. |

---

## Adım 4 — Target: tüm synchronizer’lardan disconnect

| Alan | İçerik |
|------|--------|
| **Adım adı** | Target isolation — disconnect_all |
| **Komut(lar)** | ```scala<br>target.synchronizers.disconnect_all()<br>``` |
| **Pre-condition** | Adım 3 authorization atılmış. |
| **Post-condition** | Target hiçbir synchronizer’a bağlı değil. Assert komutu docs’ta bu adımda ayrı verilmiyor — *bilinmiyor / doğrulanacak* (ör. `target.synchronizers.list_connected()` veya eşdeğeri LocalNet’te doğrulanacak). |
| **Başarısızlık belirtisi** | Disconnect olmadan import — docs: offline replication’ın tanımı bozulur; beklenen hata: *bilinmiyor / doğrulanacak*. |

---

## Adım 5 — Target: auto-reconnect kapat

| Alan | İçerik |
|------|--------|
| **Adım adı** | Restart’ta otomatik bağlanmayı kapat (`manualConnect = true`) |
| **Komut(lar)** | ```scala<br>target.synchronizers.config(syncAlias)<br>target.synchronizers.modify(syncAlias, _.copy(manualConnect = true))<br>target.synchronizers.config(syncAlias)<br>``` |
| **Pre-condition** | Adım 4 sonrası. Config’te ilgili alias var. |
| **Post-condition** | `config(...).manualConnect == true` (docs `res15`). |
| **Başarısızlık belirtisi** | Restart sonrası target tekrar bağlanırsa import penceresi bozulabilir — docs gerekçesi; tipik log: *bilinmiyor / doğrulanacak*. |

---

## Adım 6 — Source: offset kaydı + party authorization

| Alan | İçerik |
|------|--------|
| **Adım adı** | Aktivasyon öncesi offset + party tarafı hosting izni |
| **Komut(lar)** | ```scala<br>val beforeActivationOffset = source.ledger_api.state.end()<br>source.topology.party_to_participant_mappings.propose_delta(<br>  party = alice,<br>  adds = Seq((target.id, ParticipantPermission.Observation)),<br>  store = synchronizerId,<br>  requiresPartyToBeOnboarded = true<br>)<br>``` |
| **Pre-condition** | **Target önce disconnect edilmiş olmalı** (docs: “Only after the target participant has been disconnected…”). Permission, adım 3 ile **aynı** olmalı. Onboarding flag yine `true`. |
| **Post-condition** | `beforeActivationOffset: Long` kaydedildi. Topology transaction imzalı döner; mapping’de source + target (onboarding) görünür. |
| **Başarısızlık belirtisi** | Target hâlâ connected iken bu adım — docs sıra ihlali. Offset kaydedilmezse adım 7 export’un activation araması etkilenir. |

---

## Adım 7 — Source: ACS export

| Alan | İçerik |
|------|--------|
| **Adım adı** | Source’tan party ACS export |
| **Komut(lar)** | ```scala<br>source.parties.export_party_acs(<br>  party = alice,<br>  synchronizerId = synchronizerId,<br>  targetParticipantId = target.id,<br>  beginOffsetExclusive = beforeActivationOffset,<br>  exportFilePath = "party_replication.alice.acs.gz",<br>)<br>``` |
| **Pre-condition** | Adım 6 tamam; party target’ta aktivasyon topology’si bulunabilir (komut içeride `beginOffsetExclusive`’ten arar). Source prune penceresi hâlâ veri tutuyor. Target participant UID doğru. |
| **Post-condition** | Dosya `party_replication.alice.acs.gz` (veya verdiğin path) oluşmuş. Docs console’da ek return örneği göstermiyor — dosya varlığı / boyut: LocalNet’te doğrulanacak. |
| **Başarısızlık belirtisi** | Activation bulunamaz / timeout (`waitForActivationTimeout` opsiyonel, proto alan). Export fail. Dosya yok veya boş: *bilinmiyor / doğrulanacak*. |

---

## Adım 8 — (İsteğe bağlı) Source: automatic pruning’i geri aç

| Alan | İçerik |
|------|--------|
| **Adım adı** | Pruning schedule restore |
| **Komut(lar)** | ```scala<br>source.pruning.set_schedule("0 0 20 * * ?", 2.hours, 30.days) // docs örneği; kendi kaydettiğin değerleri kullan<br>``` |
| **Pre-condition** | Adım 7 export **bitmiş**. Adım 2’de schedule kaydedilmişti. |
| **Post-condition** | `get_schedule()` tekrar dolu / beklenen cron. |
| **Başarısızlık belirtisi** | Export bitmeden açılırsa adım 2 riski geri gelir. |

---

## Adım 9 — Target: backup (zorunlu)

| Alan | İçerik |
|------|--------|
| **Adım adı** | Target participant backup (ACS import öncesi) |
| **Komut(lar)** | Party replication sayfası **somut backup komutu vermiyor**; yalnızca zorunlu kılıyor. Postgres için backup-restore howto: ```bash<br>pg_dump -U <user> -h <host> -p <port> -w -F tar -f <fileName> <dbName><br>``` Restore: ```bash<br>pg_restore -U <user> -h <host> -p <port> -w -d <dbName> <fileName><br>``` Sıra kısıtı (backup-restore): participant/mediator backup’ı sequencer’dan **önce** (fork riski). |
| **Pre-condition** | Adım 7 tamam; henüz import yok. Production’da DB storage. |
| **Post-condition** | Geri yüklenebilir backup artifact var. |
| **Başarısızlık belirtisi** | Import yarıda kalırsa temiz recovery noktası yok (docs uyarısı). |
| **Bizim LocalNet notu** | `01-simple-topology` **memory** storage kullanır → `pg_dump` uygulanmaz. Memory node için anlamlı backup prosedürü: **bilinmiyor / doğrulanacak** (repo örneği veya docs’ta memory için ayrı talimat yok). PoC’te ya Postgres’li topolojiye geçilir ya da bu adım “production eşleniği” olarak checklist’te kalır. |

---

## Adım 10 — Target: ACS import

| Alan | İçerik |
|------|--------|
| **Adım adı** | Target’a party ACS import |
| **Komut(lar)** | Canton **3.5** docs: ```scala<br>target.parties.import_party_acs(<br>  synchronizerId,<br>  party = Some(alice),<br>  importFilePath = "party_replication.alice.acs.gz"<br>)<br>``` |
| **Pre-condition** | Target disconnect (adım 4–5). Backup alınmış (adım 9). Export dosyası erişilebilir. Package vetting yapılmış. |
| **Post-condition** | Import hata vermeden biter. Party ID verildiyse (PV ≥ 35) onboarding clearance arka planda planlanabilir (docs). Assert için ek console çıktısı docs’ta gösterilmiyor — ACS/query: LocalNet’te doğrulanacak. |
| **Başarısızlık belirtisi** | Crash / yarım import → backup’tan reset (docs). Party ID omit → otomatik flag clearance olmaz (docs note). Connected target’ta import: *bilinmiyor / doğrulanacak*. |

**Versiyon notu:** 3.4 docs örneği `import_party_acs("file")` (tek argüman) gösteriyordu; **3.5** imza `synchronizerId` + opsiyonel `party` içerir. Ortamımız 3.5.8 → **3.5 imzasını kullan**.

---

## Adım 11 — Target: ledger end kaydı + reconnect

| Alan | İçerik |
|------|--------|
| **Adım adı** | Target ledger end + synchronizer’a reconnect |
| **Komut(lar)** | ```scala<br>val targetLedgerEnd = target.ledger_api.state.end()<br>target.synchronizers.reconnect_local(syncAlias)  // docs: reconnect_local("mysynchronizer") → Boolean = true<br>``` |
| **Pre-condition** | Adım 10 import tamam. |
| **Post-condition** | `reconnect_local` → `true` (docs `res27`). `targetLedgerEnd` kaydedildi (manuel clearance için). |
| **Başarısızlık belirtisi** | Reconnect `false` / hata. Fork / topology sorunları: *bilinmiyor / doğrulanacak* (backup-restore kontekstinde `ForkHappened` geçer). |

---

## Adım 12 — (İsteğe bağlı) Target: auto-reconnect yeniden aç

| Alan | İçerik |
|------|--------|
| **Adım adı** | `manualConnect = false` |
| **Komut(lar)** | ```scala<br>target.synchronizers.modify(syncAlias, _.copy(manualConnect = false))<br>``` |
| **Pre-condition** | Adım 11 başarılı; orijinalde auto-reconnect isteniyordu. |
| **Post-condition** | `config(...).manualConnect == false`. |
| **Başarısızlık belirtisi** | Kritik değil; atlanırsa sadece restart davranışı farklı kalır. |

---

## Adım 13 — Target: onboarding flag clearance

| Alan | İçerik |
|------|--------|
| **Adım adı** | Onboarding flag temizle (replication tamamlanır) |
| **Komut(lar)** | **Otomatik (PV ≥ 35 + import’ta party ID verildiyse):** reconnect sonrası arka planda schedule; participant loglarında gözlemlenir (docs). **Manuel / poll:** ```scala<br>val flagStatus = target.parties.clear_party_onboarding_flag(alice, synchronizerId, targetLedgerEnd)<br>// FlagNotSet | FlagSet(earliest safe time = ...)<br>utils.retry_until_true(timeout = 2.minutes, maxWaitPeriod = 1.minutes) {<br>  target.parties.clear_party_onboarding_flag(alice, synchronizerId, targetLedgerEnd) match {<br>    case FlagSet(_) => false<br>    case FlagNotSet => true<br>  }<br>}<br>``` |
| **Pre-condition** | Adım 11 reconnect. `targetLedgerEnd` biliniyor (manuel yol). |
| **Post-condition** | `FlagNotSet` — onboarding flag temiz. Docs summary: Alice `source` ve `target` üzerinde multi-host. |
| **Başarısızlık belirtisi** | Uzun süre `FlagSet`; clearance schedule’te kalır. Otomatik clearance log’da görünmezse manuel yol. Yanlış offset ile arama: *bilinmiyor / doğrulanacak*. |

---

## Uçtan uca başarı (docs summary)

| Alan | İçerik |
|------|--------|
| **Adım adı** | Replication complete |
| **Komut(lar)** | Docs tek final assert komutu vermiyor. Tipik doğrulama adayları (LocalNet’te doğrulanacak): topology’de Alice → source+target; target’ta party ACS / ledger visible; (izin Submission ise) target üzerinden submit. |
| **Pre-condition** | Adım 1–13 (opsiyoneller dahil ihtiyaca göre) tamam. |
| **Post-condition** | Docs: *“You have successfully multi-hosted Alice on source and target participants.”* |
| **Başarısızlık belirtisi** | Tek taraflı host; onboarding flag kalıcı; ACS boş/eksik — hepsi LocalNet koşusunda ölçülecek. |

---

## Makine-okunur assert iskeleti (sonraki otomasyon için — kod yok)

Aşağısı docs’taki net sinyaller + bilinçli boşluklar:

| Adım | Assert sinyali (docs) | Durum |
|------|----------------------|--------|
| 1 | vetted_packages listesinde target var | docs |
| 2 | pruning schedule cleared | docs |
| 3 | mapping’te `onboarding` | docs |
| 4 | disconnected | assert komutu docs’ta yok → LocalNet |
| 5 | `manualConnect = true` | docs |
| 6 | `beforeActivationOffset` Long | docs |
| 7 | ACS dosyası var | dosya assert’i LocalNet |
| 9 | backup artifact | Postgres: `pg_dump` dosyası; memory: açık |
| 10 | import no-error | console |
| 11 | `reconnect_local` == true | docs |
| 13 | `FlagNotSet` | docs |

---

## Bilinçli riskler (docs’tan, spekülasyon değil)

1. Sıra ihlali → “errors that may require significant manual correction”.
2. Target backup atlanırsa interrupted import’tan güvenli dönüş yok.
3. Onboarding sırasında ACS commitment mismatch **beklenen**; prosedür ortasında panik kaynağı olmamalı.
4. Manual pruning dışarıdan tetiklenebilir — koordinasyon şart.
5. Party offboarding / migration yok — “source’tan sil” finali yok.

---

## LocalNet koşum kaydı

| Alan | Değer |
|------|--------|
| Uçtan uca koşuldu mu? | **EVET — 2026-07-16, gerçek Canton 3.5.8** (bkz. [manual-baseline-run-log.md](manual-baseline-run-log.md)) |
| Ortam | Canton OSS 3.5.8, `localnet/cro-topology.conf` (**H2 storage** — memory ACS import’u desteklemiyor, run-log’daki kritik keşif) |
| Splice LocalNet | BLOCKED (Docker yok) — bkz. `localnet/ISSUES.md`; PoC için gerekmedi |
| Sonuç | 13/13 adım geçti; assert boşlukları run-log’da kapandı; karar **GO** |

---

## Referans sıra (docs “exact order”)

1. Target: Package Vetting  
2. Source: Data Retention  
3. Target: Authorization (onboarding)  
4. Target: Isolation — disconnect_all  
5. Target: Disable auto-reconnect  
6. Source: Party Authorization (+ `beforeActivationOffset`)  
7. Source: ACS Export  
8. (Opt) Source: Re-enable pruning  
9. Target: Backup  
10. Target: ACS Import  
11. Target: Reconnect (+ `targetLedgerEnd`)  
12. (Opt) Target: Re-enable auto-reconnect  
13. Target: Onboarding Flag Clearance  
