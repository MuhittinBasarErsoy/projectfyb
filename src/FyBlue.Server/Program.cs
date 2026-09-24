using System.Text;
using System.Text.Json.Serialization;
using Epias.Core.Catalog;
using Epias.Core.Data;
using Epias.Core.Epias;
using Epias.Core.Formulas;
using Epias.Core.Ingestion;
using Epias.Core.Security;
using Epias.Core.Storage;
using FyBlue.Server.Data;
using FyBlue.Server.Infrastructure;
using FyBlue.Server.Security;
using FyBlue.Server.Services;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .WriteTo.Console());

// ---------------------------------------------------------------------------
// Yapılandırma
// ---------------------------------------------------------------------------

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key en az 32 karakter olmalı. Üretimde Jwt__Key ortam değişkeniyle verin.");
builder.Services.AddSingleton(jwt);

var connStr = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default tanımlı değil.");

builder.Services.Configure<EpiasOptions>(builder.Configuration.GetSection("Epias"));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
// StorageOptions bağlantı dizesini ayrıca taşımasın; tek kaynaktan beslensin.
builder.Services.PostConfigure<StorageOptions>(o =>
{
    if (string.IsNullOrWhiteSpace(o.ConnectionString)) o.ConnectionString = connStr;
});

// ---------------------------------------------------------------------------
// Veritabanı: tek DB, iki bağlam
//   AppDbContext   → Identity + OSOS + dış hesap bağlantıları (dbo)
//   EpiasDbContext → EPİAŞ meta verisi (app şeması); endpoint verisi epias.* / formula.*
// ---------------------------------------------------------------------------

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(connStr, sql =>
    sql.EnableRetryOnFailure(maxRetryCount: 6, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null)));
builder.Services.AddDbContext<EpiasDbContext>(o => o.UseSqlServer(connStr, sql =>
{
    sql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
    sql.MigrationsHistoryTable("__migrations", "app");
}));

builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.Password.RequiredLength = 6;
        o.Password.RequireNonAlphanumeric = false;
        o.User.RequireUniqueEmail = false;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddErrorDescriber<TurkishIdentityErrorDescriber>();

// ---------------------------------------------------------------------------
// Kimlik doğrulama (tek JWT, tüm modüller)
// ---------------------------------------------------------------------------

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

// Dış hesap şifreleri (OSOS + EPİAŞ) bu anahtar zinciriyle korunur; anahtarlar kalıcı olmalı.
var keyPath = builder.Configuration["DataProtection:KeyPath"];
if (string.IsNullOrWhiteSpace(keyPath)) keyPath = Path.Combine(builder.Environment.ContentRootPath, ".keys");
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keyPath))
    .SetApplicationName("fyblue");

// ---------------------------------------------------------------------------
// OSOS modülü
// ---------------------------------------------------------------------------

builder.Services.AddSingleton<OsosSessionService>();
builder.Services.AddHttpClient<Osos.Core.Weather.OpenMeteoClient>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<ResultMaterializer>();
builder.Services.AddScoped<SearchService>();

builder.Services.AddHangfire(cfg => cfg
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseSqlServerStorage(connStr, new SqlServerStorageOptions
    {
        PrepareSchemaIfNecessary = true,
        QueuePollInterval = TimeSpan.FromSeconds(15)
    }));
builder.Services.AddHangfireServer();
builder.Services.AddScoped<JobRunner>();

// ---------------------------------------------------------------------------
// EPİAŞ modülü
// ---------------------------------------------------------------------------

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<ICredentialProtector, DataProtectionCredentialProtector>();
builder.Services.AddSingleton<EndpointCatalog>();
builder.Services.AddSingleton<EpiasTicketService>();
builder.Services.AddSingleton<EpiasDataClient>();
builder.Services.AddSingleton<DynamicTableStore>();
builder.Services.AddSingleton<BulkSyncService>();

builder.Services.AddScoped<TicketContext>();
builder.Services.AddScoped<IEpiasTicketAccessor, HttpTicketAccessor>();
builder.Services.AddScoped<IngestionService>();
builder.Services.AddScoped<FormulaCompiler>();
builder.Services.AddScoped<FormulaService>();

var epiasTimeout = TimeSpan.FromSeconds(builder.Configuration.GetValue("Epias:TimeoutSeconds", 120));
builder.Services.AddHttpClient(EpiasTicketService.HttpClientName, c => c.Timeout = epiasTimeout);
builder.Services.AddHttpClient(EpiasDataClient.HttpClientName, c =>
{
    c.Timeout = epiasTimeout;
    c.DefaultRequestHeaders.UserAgent.ParseAdd("FyBlue/1.0");
});

// ---------------------------------------------------------------------------
// Web API
// ---------------------------------------------------------------------------

builder.Services.AddControllers(o => o.Filters.Add<ApiExceptionFilter>())
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull);
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>()
    .AddDbContextCheck<EpiasDbContext>();

// Ters vekil (Caddy/nginx/Traefik) arkasında istemci IP'si ve https şeması.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

var app = builder.Build();

// ---------------------------------------------------------------------------
// Başlangıç: migration'lar + EPİAŞ şema/katalog/tablolar
// ---------------------------------------------------------------------------

await using (var scope = app.Services.CreateAsyncScope())
{
    var sp = scope.ServiceProvider;
    try
    {
        await sp.GetRequiredService<AppDbContext>().Database.MigrateAsync();
        await sp.GetRequiredService<EpiasDbContext>().Database.MigrateAsync();
    }
    catch (Microsoft.Data.SqlClient.SqlException ex)
    {
        var server = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connStr).DataSource;
        app.Logger.LogCritical(ex,
            "SQL Server'a bağlanılamadı: {Server}. Yerel geliştirmede 'docker compose up -d mssql' çalıştırın.",
            server);
        throw;
    }

    var store = sp.GetRequiredService<DynamicTableStore>();
    await store.EnsureSchemasAsync();

    var catalog = sp.GetRequiredService<EndpointCatalog>();
    await catalog.InitializeAsync();

    // EPİAŞ tablolarını ilk senkronizasyonu beklemeden hazırla.
    if (builder.Configuration.GetValue("Storage:CreateTablesOnStartup", true))
    {
        var created = 0;
        foreach (var ep in catalog.DataEndpoints)
        {
            try
            {
                await store.EnsureTableAsync(ep);
                created++;
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "{Table} tablosu oluşturulamadı.", ep.TableName);
            }
        }
        app.Logger.LogInformation("{Count} endpoint tablosu hazır.", created);
    }
}

app.UseForwardedHeaders();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment() || builder.Configuration.GetValue("ExposeApiDocs", false))
{
    app.MapOpenApi();
    app.MapScalarApiReference(o => o.WithTitle("FyBlue API"));
}

// Blazor WASM istemcisini aynı sunucudan sun (tek uygulama, tek origin).
app.UseBlazorFrameworkFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// Hangfire dashboard — Basic auth. Şifre boşsa kapalıdır.
var hfUser = builder.Configuration["Hangfire:User"] ?? "admin";
var hfPass = builder.Configuration["Hangfire:Password"] ?? "";
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new BasicAuthDashboardFilter(hfUser, hfPass) }
});

app.MapControllers();
app.MapHealthChecks("/health");

// API dışındaki tüm yollar Blazor index.html'e düşer (SPA yönlendirmesi).
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
