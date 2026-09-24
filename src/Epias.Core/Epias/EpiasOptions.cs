namespace Epias.Core.Epias;

public sealed class EpiasOptions
{
    /// <summary>Şeffaflık elektrik servisleri kök adresi.</summary>
    public string BaseUrl { get; set; } = "https://seffaflik.epias.com.tr/electricity-service";

    /// <summary>CAS bilet (TGT) servisi.</summary>
    public string TicketUrl { get; set; } = "https://giris.epias.com.tr/cas/v1/tickets";

    /// <summary>Swagger dosyasının yerel yolu.</summary>
    public string SwaggerPath { get; set; } = "specs/electricity-swagger.json";

    /// <summary>Swagger yoksa buradan indirilir.</summary>
    public string SwaggerUrl { get; set; } =
        "https://seffaflik.epias.com.tr/electricity-service/technical/tr/swagger.json";

    /// <summary>TGT'nin önbellekte tutulacağı süre. EPİAŞ tarafı ~2 saat verir.</summary>
    public TimeSpan TicketLifetime { get; set; } = TimeSpan.FromMinutes(100);

    /// <summary>Sayfalı servislerde tek istekte istenecek satır sayısı.</summary>
    public int PageSize { get; set; } = 1000;

    /// <summary>Bir senkronizasyonda çekilecek azami sayfa (sonsuz döngü koruması).</summary>
    public int MaxPages { get; set; } = 500;

    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>429/5xx durumunda yeniden deneme sayısı.</summary>
    public int MaxRetries { get; set; } = 3;
}
