namespace Osos.Contracts;

/// <summary>Anlık (tek seferlik) iş tetikleme.</summary>
/// <remarks>NotifyEmails: virgül/noktalı virgülle ayrılmış adresler; sonuç (özet + CSV) mail atılır.</remarks>
public sealed record RunNowRequest(string Screen, long Serno, int DaysBack, int Type, string? NotifyEmails = null);

/// <summary>Zamanlanmış (cron) iş oluşturma/güncelleme.</summary>
public sealed record ScheduleJobRequest(string Screen, long Serno, int DaysBack, int Type, string Cron, string? Name,
    string? NotifyEmails = null);

/// <summary>Hava durumu işi (anlık veya cron ile).</summary>
public sealed record WeatherJobRequest(
    double Latitude, double Longitude, int DaysBack, string Timezone,
    double? Tilt, double? Azimuth, string? Cron, string? Name);

/// <summary>Zamanlanmış iş özeti (liste için).</summary>
public sealed record JobDto(
    string Id,
    string Screen,
    long Serno,
    int DaysBack,
    string Cron,
    string? NextRun,
    string? LastRun,
    string? LastState,
    string? NotifyEmails = null);
