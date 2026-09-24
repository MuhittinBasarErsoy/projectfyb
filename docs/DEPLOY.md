# Ubuntu sunucuda Tailscale ile canlıya alma

FyBlue, sunucuda **hiçbir port internete açılmadan** Tailscale ağı (tailnet) üzerinden yayınlanır.
HTTPS sertifikasını Tailscale verir; adres `https://fyblue.<tailnet>.ts.net` olur ve yalnızca
tailnet'e katılmış cihazlar erişebilir.

```
Tailnet cihazları ──HTTPS──► fyblue-ts (Tailscale düğümü, TLS burada)
                                 │  Docker ağı
                                 ▼
                             fyblue-app :8080 ──► fyblue-mssql :1433
```

## 1. Ön koşullar

**Sunucu:** Ubuntu 22.04/24.04, en az 4 GB RAM (MSSQL ~2 GB ister), Docker Engine 24+ ve Compose v2.

```bash
docker --version && docker compose version
```

Docker yoksa:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER   # sonra oturumu kapatıp açın
```

**Tailscale admin konsolu** (https://login.tailscale.com/admin):

1. **DNS** → *MagicDNS* açık, *HTTPS Certificates* → **Enable**.
2. **Settings → Keys → Generate auth key**: *Reusable* kapalı, *Ephemeral* kapalı. `tskey-auth-…` değerini kopyalayın.

## 2. Kodu sunucuya alın

```bash
sudo mkdir -p /opt/fyblue && sudo chown $USER /opt/fyblue
```

```bash
git clone https://github.com/MuhittinBasarErsoy/projectfyb.git /opt/fyblue
```

Repo private olduğu için GitHub kullanıcı adı + personal access token (veya sunucuda `gh auth login`) gerekir.

## 3. Gizli değerleri oluşturun

```bash
cd /opt/fyblue && cp .env.example .env && chmod 600 .env
```

`.env` içinde şunları doldurun:

| Değişken | Değer |
|---|---|
| `MSSQL_SA_PASSWORD` | `openssl rand -base64 24 \| tr -d '/+=;'` çıktısı + `Aa1!` (SQL karmaşıklık kuralı) |
| `JWT_KEY` | `openssl rand -base64 48` çıktısı |
| `HANGFIRE_PASSWORD` | `/hangfire` paneli için şifre (boşsa panel kapalı) |
| `TS_AUTHKEY` | 1. adımdaki `tskey-auth-…` |
| `TS_HOSTNAME` | `fyblue` (adres bu olur) |

## 4. Başlatın

```bash
docker compose -f docker-compose.tailscale.yml up -d --build
```

İlk açılışta MSSQL hazır olur (~1 dk), uygulama şemayı ve 163 EPİAŞ tablosunu oluşturur:

```bash
docker compose -f docker-compose.tailscale.yml logs -f app
```

`163 endpoint tablosu hazır.` satırını görünce tailnet'teki bir cihazdan açın:
`https://fyblue.<tailnet>.ts.net` → Kayıt ol → Bağlı Hesaplar.

Düğüm tailnet'e katıldıktan sonra `TS_AUTHKEY` artık gerekmez (kimlik `ts-state` biriminde saklanır).

## Güncelleme

```bash
cd /opt/fyblue && git pull && docker compose -f docker-compose.tailscale.yml up -d --build
```

Migration'lar açılışta kendiliğinden uygulanır.

## Yedekleme

İki şey yedeklenmeli — veritabanı ve Data Protection anahtarları (anahtarlar olmadan
saklanan OSOS/EPİAŞ şifreleri çözülemez):

```bash
docker exec fyblue-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C \
  -Q "BACKUP DATABASE [FyBlue] TO DISK='/var/opt/mssql/fyblue.bak' WITH INIT, COMPRESSION"
docker cp fyblue-mssql:/var/opt/mssql/fyblue.bak ./fyblue-$(date +%F).bak
```

```bash
docker run --rm -v fyblue_fyblue-keys:/keys -v "$PWD":/backup alpine tar czf /backup/keys-$(date +%F).tar.gz -C /keys .
```

## Notlar

- `MSSQL_PID=Developer` üretimde lisans açısından uygun değildir; `Express` (10 GB sınırı) veya lisanslı sürüm kullanın.
- Sunucudaki eski EPİAŞ kurulumu (`epias`, `epias-api` düğümleri) bu kurulumla çakışmaz ama artık gereksizdir;
  kapatmak için eski klasörde `docker compose -f docker-compose.tailscale.yml down`. EPİAŞ verilerini taşımak ayrı bir iştir.
