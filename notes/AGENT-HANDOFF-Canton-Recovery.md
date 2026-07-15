# Canton Recovery Orchestration — Agent Handoff

**Tarih:** 2026-07-15  
**Amaç:** Bu dosyayı yeni bir agent’a vererek projeyi **aynı bağlam seviyesinde** devam ettirmek.  
**Dil:** Kullanıcı Türkçe konuşuyor; teknik terimler İngilizce kalabilir.

---

## 1) Proje tek cümle

Canton Network Development Fund için başvurulacak açık kaynak **CLI / ops aracı**: party/participant **taşıma + yedek doğrulama + felaket tatbikatı (restore drill)** orchestration’ı. Key/seed export yok. SDK değil. Cüzdan değil. DEX değil. Zorunlu ürün sitesi yok.

**Grant cümlesi:**  
> Canton’da party/participant recovery hâlâ manuel; biz key’e dokunmadan dry-run migration, backup doğrulama ve restore drill sunan open-source orchestration CLI getiriyoruz.

---

## 2) Ne yapıyoruz / ne değil

### Yapıyoruz
- Offline party replication akışının orchestration’ı
- `plan` (dry-run), `preflight`, `apply`, `resume` (idempotent)
- Post-condition doğrulama
- Bilerek bozuk ACS import tatbikatı (`ACS_COMMITMENT_MISMATCH` veya eşdeğeri)
- Runbook + CI’da koşan drill
- Open source (Apache-2.0 tercih)

### Yapmıyoruz (kapsam duvarı — bozma)
- Key / mnemonic / seed export (CWIF fikri öldü)
- Yeni cüzdan veya dApp UI / dashboard / observability platformu (COOT tuzağı)
- Hard domain / synchronizer migration (LSU alanı; #294 öldü)
- Party offboarding “sihirli taşı” (protokolde yok)
- Decentralized party membership (Decentralization Manager ayrı iş)
- DeFi / NFT / yield / wallet SDK

### Ürün tipi
- **CLI** (`cro` benzeri komutlar)
- README + demo video yeterli
- Site zorunlu değil; isterse sonra ince docs sayfası

---

## 3) Karar geçmişi (neden buradayız)

1. Kullanıcı Canton grant fikir istedi; klasik crypto listesi (DEX, NFT, payroll…) **dolu veya fon tipine uymaz** diye elendi.
2. **CWIF** (ZeWiF ilhamlı wallet interchange) önerildi → başka AI çürüttü: Canton external party’de key kullanıcıda / BIP-39 mnemonic zaten taşır; key export kurumsalda anti-pattern. Skor ~3/10 → **bırakıldı**.
3. **Recovery Orchestration** seçildi. Bağımsız AI değerlendirmesi: boşluk gerçek, key’siz güvenlik OK, en büyük risk champion apatisi + kapsam şişmesi. Skor **5.5/10**. Karar: **daralt → PoC → başvur**. Bant **400–650k CC** (1.2M tavanına çıkma).
4. Kullanıcı vibe-coding ile parçalı ilerleyecek; tek monolit prompt istemiyor.
5. HTML rehber yazıldı ve iki tur feedback ile güncellendi (DA roadmap sorusu, AI-slop kuralları, 2-participant darboğazı).

---

## 4) Şu an hangi seviyedeyiz? (durum)

| Madde | Durum |
|--------|--------|
| Fikir seçimi | ✅ Recovery Orchestration kilit |
| CWIF | ❌ Ölü — geri dönme |
| HTML rehber | ✅ Var (aşağıda path) |
| Kod / PoC repo | ❌ Henüz yok |
| LocalNet / 2-participant | ❌ Henüz kurulmadı |
| DA roadmap maili | ❌ Henüz atılmadı (Aşama 0A — **ŞİMDİ İLK İŞ**) |
| Grant PR | ❌ Erken — PoC sonrası |

**Sıradaki gerçek iş sırası:**
1. **Aşama 0A:** DA’ya roadmap sorusu (“party-level recovery/replication orchestration Splice yakın roadmap’te mi?”). Cevap “geliyor” → **DUR**.
2. **Aşama 0B:** İki bağımsız participant LocalNet (standart tek-container yetmeyebilir; HOCON/compose hand-wire; #93 problemi). Kurulamazsa PoC tıkanır.
3. Hafta 1: Manuel 13-adım baseline + pre/post conditions.
4. Hafta 2–4: CLI apply/resume → plan/preflight → fault drill + CI.
5. Sonra `canton-dev-fund` proposal PR (400–650k CC, AI-slop kurallarına uy).

Kullanıcı notu: Champion’ı “önce bul” şartı değil; PR → `needs-champion` → mail/SIG ile biri gelir. Yine de kimse sahiplenmezse (COOT gibi) ölür; güçlü PoC önemli.

---

## 5) Yerel dosya

Rehber (aşamalar + vibe-coding prompt setleri):  
`C:\Users\emrhn\Desktop\REPOLAR\grandarastırma\canton-recovery-orchestration-rehber.html`

Workspace: `C:\Users\emrhn\Desktop\REPOLAR\grandarastırma`

---

## 6) Grant programı — nereye / nasıl

| Ne | Link |
|----|------|
| Grants program sayfası | https://canton.foundation/grants-program/ |
| Fund lansman yazısı | https://canton.foundation/canton-foundation-launches-protocol-development-fund/ |
| Başvuru reposu | https://github.com/canton-foundation/canton-dev-fund |
| README (nasıl submit) | https://github.com/canton-foundation/canton-dev-fund/blob/main/README.md |
| Proposal template | https://github.com/canton-foundation/canton-dev-fund/blob/main/proposals/_template.md |
| PR template | https://github.com/canton-foundation/canton-dev-fund/blob/main/.github/pull_request_template.md |
| Review process | https://github.com/canton-foundation/canton-dev-fund/blob/main/Development%20Fund%20Proposal%20Review%20Process.md |
| SIG directory (champion adayları) | https://github.com/canton-foundation/canton-dev-fund/blob/main/sig-directory.md |
| Proposal lifecycle board | https://github.com/orgs/canton-foundation/projects/3/views/1 |
| Approved/merged proposals klasörü | https://github.com/canton-foundation/canton-dev-fund/tree/main/proposals |
| Mailing list | grants-discuss@lists.sync.global |
| Özel mail | dev-fund@canton.foundation |

**Governance:**
- CIP-0082 (fon %5): https://github.com/canton-foundation/cips/blob/main/cip-0082/cip-0082.md  
- CIP-0100 (süreç): https://github.com/canton-foundation/cips/blob/main/cip-0100/cip-0100.md  

**Başvuru şekli:** Web formu yok. Fork → `proposals/<name>.md` → PR `Proposal: <Name>`. Milestone bazlı ödeme **Canton Coin (CC)**.

**AI-slop bot (`aipricheck.yml`):** Proposal’da em-dash (—) yok; madde satırını `;` ile bitirme; uydurma jargon yok (sharding, Canton chain, Daml VM, vb.); abartı kalıp yok.

---

## 7) Örnek Approved başvurular (stil / kalite referansı)

| Proje | PR |
|--------|-----|
| CCTools | https://github.com/canton-foundation/canton-dev-fund/pull/159 |
| PartyLayer | https://github.com/canton-foundation/canton-dev-fund/pull/9 |
| SV Governance dApp | https://github.com/canton-foundation/canton-dev-fund/pull/223 |
| Rust SDK | https://github.com/canton-foundation/canton-dev-fund/pull/407 |
| Concordia (CAP) | https://github.com/canton-foundation/canton-dev-fund/pull/184 |
| Denex Localnet (büyük, örnek olarak) | https://github.com/canton-foundation/canton-dev-fund/pull/318 |

İlgili / uyarı PR’lar (çakışma ve “nasıl ölünür”):
- Hard Migration (Wayne kesti / LSU nedeniyle): ara `#294`
- COOT (kapsam şişkin + champion apatisi): ara `#433`
- Migration Lens (dar, az ilgi): ara `#34`
- canton-compose / LocalNet fixed topology: ara `#93`
- Decentralization Manager (komşu raf, farklı iş): https://github.com/canton-foundation/canton-dev-fund/pull/298 ve phase 2 `#530`

Proposal metin örnekleri (raw):
- https://raw.githubusercontent.com/canton-foundation/canton-dev-fund/main/proposals/2026-04-Avro-SV_Governance_dApp.md  
- https://raw.githubusercontent.com/canton-foundation/canton-dev-fund/main/proposals/2026-03-CCTools-cctools.md (veya PR #159 commit)  
- https://raw.githubusercontent.com/canton-foundation/canton-dev-fund/main/proposals/2026-02-Cayvox%20Labs-PartyLayer-Wallet-SDK.md  

---

## 8) Canton ekosistem / docs (araştırma için)

| Ne | Link |
|----|------|
| Canton Network | https://www.canton.network/ |
| Build sayfası | https://www.canton.network/build |
| Foundation | https://canton.foundation/ |
| Ecosystem directory | https://www.cantonecosystem.com/ |
| Forum (DX survey vb.) | https://forum.canton.network/ |
| DX survey 2026 | https://forum.canton.network/t/canton-network-developer-experience-and-tooling-survey-analysis-2026/8412 |
| DPM components call | https://forum.canton.network/t/dpm-components-extend-the-canton-developer-stack/8822 |
| Docs kök (docs.canton.network) | https://docs.canton.network/ |
| Wallet stack blog | https://www.canton.network/blog/canton-unlocks-the-wallet-stack |
| CIP-0103 (dApp↔wallet; CWIF ile karıştırma) | https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md |
| Wallet monorepo | https://github.com/canton-network/wallet |
| CC price (referans) | https://coinmarketcap.com/currencies/canton-network/ |
| TR / EN X | https://x.com/CantonNetwrkTR · https://x.com/CantonNetwork · https://x.com/CantonFdn |

**Teknik araştırma zorunluları (PoC öncesi/sonrası):**
- Splice / Canton **party replication**, **ACS export/import**, **backup/restore**, offline replication dokümanları (`docs.canton.network` ve Splice release notes)
- LocalNet / cn-quickstart; **2-participant hand-wire**
- External party key modeli (neden CWIF öldü): party ID = hint + fingerprint; key kullanıcıda

Potansiyel champion / roadmap muhatapları (SIG’den): Node Ops — Michael Gaare (Cumberland), Jonathan Mayeur (IntellectEU); DA — Itai Segall, Wayne Collier (roadmap teyidi).

---

## 9) Finans / milestone çerçevesi

- Hedef: **~400–650k CC**, 3 milestone (bugünkü CC ~$0.13–0.14 → kabaca ~$55–90k bandı; volatil)
- Örnek milestone iskeleti:
  1. Offline party replication orchestration + resume + docs  
  2. Preflight/plan + fault drill + CI  
  3. Harici operatör/NaaS adoption + hardening  
- Acceptance: artifact değil **değer + adoption** dili (template’e uy)

---

## 10) Fail testleri (fikri öldüren / savunan)

1. DA “bundan sonra biz yapıyoruz” derse → bırak.  
2. Manuel akış ~20 satır bootstrap ile zaten kolaysa → otomasyon değeri yok.  
3. Broken ACS / mismatch drill üretilemiyor veya yakalanamıyorsa → “script wrapper” itirazı haklı.  
4. Kapsam dashboard/ops platformuna şişerse → COOT.

---

## 11) Yeni agent’a talimat

1. Bu handoff + HTML rehberi oku.  
2. Kullanıcıya sormadan CWIF / DEX / cüzdan / site ürününe sapma.  
3. Şimdi kod yağdırma; önce **0A DA mail taslağı / gönderim**, sonra **0B 2-participant ortam**.  
4. Vibe-coding: rehberdeki Prompt A0a → A0b → A1… A5 sırası; tek prompt’ta her şeyi yapma.  
5. Grant PR’ı PoC kanıtı olmadan erken zorlama.  
6. Linkler kırılmışsa `canton-dev-fund` + `docs.canton.network` + forum’dan güncel karşılığını bul.

---

## 12) Kullanıcı tercihleri (özet)

- Türkçe, kısa ve net iletişim  
- Grant = common good; retail crypto checklist istemiyor  
- Vibe coding, parçalı adımlar  
- Champion sürecini PR sonrası `needs-champion` olarak biliyor  
- Rehberi HTML’de tutuyor; güncellemeler oraya işlendi

**Son durum cümlesi:** Fikir kilit, rehber hazır, uygulama Aşama 0’da (önce DA roadmap, sonra 2-participant LocalNet); kod yok.
