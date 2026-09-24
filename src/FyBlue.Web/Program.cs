using System.Globalization;
using FyBlue.Web;
using FyBlue.Web.Services;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var tr = new CultureInfo("tr-TR");
CultureInfo.DefaultThreadCurrentCulture = tr;
CultureInfo.DefaultThreadCurrentUICulture = tr;

// Sunucu WASM'i kendisi barındırır → API aynı origin'dedir.
// Web'i ayrı barındırırsanız wwwroot/appsettings.json → ApiBaseUrl verin.
var apiBase = builder.Configuration["ApiBaseUrl"];
if (string.IsNullOrWhiteSpace(apiBase)) apiBase = builder.HostEnvironment.BaseAddress;

builder.Services.AddScoped(_ => new HttpClient
{
    BaseAddress = new Uri(apiBase),
    Timeout = TimeSpan.FromMinutes(10) // EPİAŞ toplu senkronizasyon uzun sürebilir
});
builder.Services.AddScoped<TokenStore>();
builder.Services.AddScoped<AuthState>();
builder.Services.AddScoped<ApiHttp>();
builder.Services.AddScoped<AuthApi>();
builder.Services.AddScoped<ConnectionsState>();
builder.Services.AddScoped<OsosApiClient>();
builder.Services.AddScoped<EpiasApiClient>();

var host = builder.Build();
await host.Services.GetRequiredService<AuthState>().InitializeAsync();
await host.RunAsync();
