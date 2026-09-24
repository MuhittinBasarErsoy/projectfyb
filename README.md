# FyBlue

OSOS Suite ve EPİAŞ Şeffaflık Senkronizasyon projelerinin birleşimi: **tek kayıt / tek giriş**,
tek web arayüzü, tek sunucu ve tek MSSQL veritabanı.

- **OSOS** — UEDAŞ OSOS portalı: tüketim, endeks, akım/gerilim/cosφ, abone sorguları, sorgu geçmişi,
  CSV dışa aktarma, Hangfire ile zamanlanmış işler, Open-Meteo hava durumu.
- **EPİAŞ** — Şeffaflık Platformu: 301 operasyonluk katalog, 163 veri servisinin kendi tablosuna
  tekrarsız senkronizasyonu, tablolar arası formüller.

## Kimlik modeli

| | Nerede | Ne için |
|---|---|---|
| **FyBlue hesabı** | `/register`, `/login` (ASP.NET Identity + JWT) | Uygulamaya giriş. Tek hesap, iki modül. |
| **OSOS hesabı** | Ayarlar → Bağlı Hesaplar | OSOS API çağrıları. Önce OSOS'ta doğrulanır, sonra şifreli saklanır. |
| **EPİAŞ hesabı** | Ayarlar → Bağlı Hesaplar | EPİAŞ CAS bileti (TGT). Önce `giris.epias.com.tr`'de doğrulanır, sonra şifreli saklanır. |

Dış hesap şifreleri ASP.NET **Data Protection** ile şifrelenir (`OsosCredentials`, `EpiasCredentials`
tabloları). Bir modülün hesabı bağlı değilse API **409** ve `osos_not_linked` / `epias_not_linked`
kodu döner; arayüz "hesabı bağla" ekranı gösterir. **401 yalnızca FyBlue oturumu** için kullanılır —
yanlış bir dış hesap şifresi kullanıcıyı uygulamadan atmaz.

## Mimari

```
FyBlue.slnx
├─ src/FyBlue.Server      ASP.NET Core 10: tüm API + Blazor WASM'i barındırır (tek süreç, tek origin)
│   ├─ Controllers/            auth, osos, searches, jobs, weather
│   ├─ Controllers/Epias/      epias (hesap), catalog, sync, data, formulas  →  /api/epias/...
│   ├─ Data/                   Identity + OSOS + dış hesap bağlantıları (dbo)
│   └─ Security/               EPİAŞ bilet erişimi (kullanıcının bağlı hesabından)
├─ src/FyBlue.Web         Blazor WebAssembly arayüz (tek tasarım sistemi, açık/koyu tema)
├─ src/FyBlue.Contracts   Ortak auth / hesap bağlama DTO'ları
├─ src/Osos.Core          OSOS istemcisi + CryptoJS uyumlu AES
├─ src/Osos.Contracts     OSOS DTO'ları
├─ src/Epias.Core         Katalog, CAS bilet servisi, dinamik tablolar, formül motoru, EpiasDbContext (app şeması)
├─ src/Epias.Contracts    EPİAŞ DTO'ları
├─ tests/                 Osos.Core.Tests (kripto), Epias.Core.Tests (katalog, formül, depolama)
└─ specs/electricity-swagger.json
```

Veritabanı `FyBlue` içinde iki EF bağlamı yan yana durur:
`AppDbContext` (dbo — Identity, OSOS geçmişi, hesap bağlantıları) ve `EpiasDbContext`
(`app` şeması, geçmiş tablosu `app.__migrations`). EPİAŞ verileri `epias.*`, formül çıktıları
`formula.*` şemalarındadır. Hangfire kendi `HangFire` şemasını oluşturur. Migration'lar ve
163 endpoint tablosu açılışta otomatik uygulanır.

## Çalıştırma

Gereksinimler: .NET 10 SDK, Docker Desktop (veya erişilebilir bir SQL Server).

### Geliştirme

```bash
docker compose up -d mssql
dotnet run --project src/FyBlue.Server --launch-profile http
```

Tarayıcı: http://localhost:5151 → **Kayıt ol** → **Bağlı Hesaplar**'dan OSOS ve/veya EPİAŞ hesabını bağla.
API dokümanı (Development): http://localhost:5151/scalar/v1

Visual Studio'da başlangıç projesi yalnızca **FyBlue.Server**'dır (web arayüzünü kendisi sunar).

### Docker ile tamamı

```bash
cp .env.example .env    # JWT_KEY, MSSQL_SA_PASSWORD, HANGFIRE_PASSWORD değerlerini doldurun
docker compose up -d --build
```

http://localhost:8080 — `fyblue-keys` birimi Data Protection anahtarlarını tutar; silinirse
saklanan OSOS/EPİAŞ şifreleri çözülemez ve hesapların yeniden bağlanması gerekir.

## Yapılandırma

| Anahtar | Açıklama |
|---|---|
| `ConnectionStrings:Default` | MSSQL bağlantısı |
| `Jwt:Key` | **Zorunlu**, en az 32 karakter (üretimde ortam değişkeni `Jwt__Key`) |
| `DataProtection:KeyPath` | Anahtar klasörü (boşsa `<içerik kökü>/.keys`) |
| `Hangfire:User` / `Hangfire:Password` | `/hangfire` paneli; şifre boşsa panel kapalı |
| `Epias:*`, `Storage:*` | EPİAŞ istemcisi ve dinamik tablo ayarları |
| `ExposeApiDocs` | Üretimde `/scalar/v1`'i açar (varsayılan kapalı) |

## Test

```bash
dotnet test
```

SQL gerektiren EPİAŞ testleri için: `EPIAS_TEST_SQL='Server=127.0.0.1,1433;Database=master;User Id=sa;Password=...;TrustServerCertificate=True'`.

## API özeti

| Yöntem | Yol | Açıklama |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | FyBlue hesabı → JWT |
| GET | `/api/auth/me` | Profil |
| GET / POST / DELETE | `/api/osos/status`, `/api/osos/link` | OSOS hesap bağlantısı |
| GET / POST / DELETE | `/api/epias/status`, `/api/epias/link` | EPİAŞ hesap bağlantısı |
| POST | `/api/osos/consumption`, `endex`, `profiles`, `subscriptions`, `dashboard/owner-consumptions` | OSOS sorguları (geçmişe kaydedilir) |
| GET / POST / DELETE | `/api/searches…` | Sorgu geçmişi, tekrar çalıştırma, CSV |
| GET / POST / DELETE | `/api/jobs…`, `/api/weather` | Hangfire işleri, hava durumu |
| GET | `/api/epias/catalog/endpoints`, `/tags`, `/endpoints/{key}` | EPİAŞ kataloğu |
| POST / GET | `/api/epias/sync/run`, `/run-bulk`, `/runs`, `/status` | Senkronizasyon |
| POST / GET | `/api/epias/data/query`, `/api/epias/data/{key}/csv` | Tablo verisi |
| GET / POST / DELETE | `/api/epias/formulas…` | Formüller |
