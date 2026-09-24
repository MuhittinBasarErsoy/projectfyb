using Osos.Contracts;

namespace FyBlue.Web.Services;

/// <summary>OSOS modülü uçları. Hatalar <see cref="ApiException"/> olarak fırlatılır.</summary>
public sealed class OsosApiClient(ApiHttp api)
{
    public Task<MeDto?> GetMeAsync() => api.GetAsync<MeDto>("api/osos/me");

    public Task<OsosResult?> ConsumptionAsync(ConsumptionQuery q) => api.PostAsync<OsosResult>("api/osos/consumption", q);
    public Task<OsosResult?> EndexAsync(EndexQuery q) => api.PostAsync<OsosResult>("api/osos/endex", q);
    public Task<OsosResult?> ProfilesAsync(ProfilesQuery q) => api.PostAsync<OsosResult>("api/osos/profiles", q);
    public Task<OsosResult?> SubscriptionsAsync(SubscriptionsQuery q) => api.PostAsync<OsosResult>("api/osos/subscriptions", q);
    public Task<OsosResult?> OwnerConsumptionsAsync(OwnerConsumptionsQuery q) =>
        api.PostAsync<OsosResult>("api/osos/dashboard/owner-consumptions", q);

    // ---- Hava durumu (Open-Meteo) ----
    public Task<OsosResult?> WeatherAsync(WeatherQuery q) => api.PostAsync<OsosResult>("api/weather", q);
    public Task WeatherRunNowAsync(WeatherJobRequest req) => api.PostAsync<object>("api/jobs/weather/run-now", req);
    public Task WeatherScheduleAsync(WeatherJobRequest req) => api.PostAsync<object>("api/jobs/weather/schedule", req);

    // ---- Arama geçmişi ----
    public Task<PagedResult<SearchHistoryDto>?> GetHistoryAsync(int page = 1, int pageSize = 25) =>
        api.GetAsync<PagedResult<SearchHistoryDto>>($"api/searches?page={page}&pageSize={pageSize}");

    public Task<SearchResultDto?> GetSnapshotAsync(long id) => api.GetAsync<SearchResultDto>($"api/searches/{id}");
    public Task<OsosResult?> RerunAsync(long id) => api.PostAsync<OsosResult>($"api/searches/{id}/rerun", null);
    public Task DeleteAsync(long id) => api.SendAsync(HttpMethod.Delete, $"api/searches/{id}");

    public Task<(byte[] Bytes, string FileName)> ExportCsvAsync(long id) =>
        api.DownloadAsync($"api/searches/{id}/export", $"arama_{id}.csv");

    // ---- İşler (Hangfire) ----
    public Task RunNowAsync(RunNowRequest req) => api.PostAsync<object>("api/jobs/run-now", req);
    public Task ScheduleJobAsync(ScheduleJobRequest req) => api.PostAsync<object>("api/jobs/schedule", req);
    public Task<List<JobDto>?> GetJobsAsync() => api.GetAsync<List<JobDto>>("api/jobs");
    public Task TriggerJobAsync(string id) => api.PostAsync<object>($"api/jobs/{Uri.EscapeDataString(id)}/trigger", null);
    public Task DeleteJobAsync(string id) => api.SendAsync(HttpMethod.Delete, $"api/jobs/{Uri.EscapeDataString(id)}");
}
