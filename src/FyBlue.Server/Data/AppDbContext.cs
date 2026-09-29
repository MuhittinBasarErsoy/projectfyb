using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Data;

public sealed class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<OsosCredential> OsosCredentials => Set<OsosCredential>();
    public DbSet<EpiasCredential> EpiasCredentials => Set<EpiasCredential>();
    public DbSet<SearchHistory> SearchHistories => Set<SearchHistory>();
    public DbSet<SearchResultSnapshot> SearchResultSnapshots => Set<SearchResultSnapshot>();

    // Müşteri modülü
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Installation> Installations => Set<Installation>();
    public DbSet<ProductionSiteInfo> ProductionSiteInfos => Set<ProductionSiteInfo>();
    public DbSet<OsosConnection> OsosConnections => Set<OsosConnection>();
    public DbSet<OsosSubscription> OsosSubscriptions => Set<OsosSubscription>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<ParameterGroup> ParameterGroups => Set<ParameterGroup>();
    public DbSet<ParameterValue> ParameterValues => Set<ParameterValue>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<OsosCredential>(e =>
        {
            e.HasIndex(x => x.AppUserId).IsUnique();
            e.HasOne(x => x.AppUser).WithOne(u => u.OsosCredential)
             .HasForeignKey<OsosCredential>(x => x.AppUserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<EpiasCredential>(e =>
        {
            e.HasIndex(x => x.AppUserId).IsUnique();
            e.Property(x => x.EpiasUsername).HasMaxLength(200);
            e.HasOne(x => x.AppUser).WithOne(u => u.EpiasCredential)
             .HasForeignKey<EpiasCredential>(x => x.AppUserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SearchHistory>(e =>
        {
            e.HasIndex(x => new { x.AppUserId, x.CreatedAt });
            e.HasOne(x => x.AppUser).WithMany(u => u.Searches)
             .HasForeignKey(x => x.AppUserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Snapshot).WithOne(s => s.SearchHistory)
             .HasForeignKey<SearchResultSnapshot>(s => s.SearchHistoryId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AppUser>(e =>
        {
            e.Property(x => x.Role).HasMaxLength(20).HasDefaultValue(AppRoles.Consultant);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureCustomerModule(b);
    }

    private static readonly Type[] CustomerModuleTables =
    [
        typeof(Customer), typeof(Installation), typeof(ProductionSiteInfo), typeof(OsosConnection),
        typeof(OsosSubscription), typeof(Document), typeof(ParameterGroup), typeof(ParameterValue)
    ];

    private static void ConfigureCustomerModule(ModelBuilder b)
    {
        b.Entity<Customer>(e =>
        {
            e.ToTable("customers");
            e.HasIndex(x => x.CustomerCode).IsUnique();
            e.Property(x => x.CustomerCode).HasMaxLength(50);
            e.Property(x => x.Title).HasMaxLength(300);
            e.Property(x => x.ShortName).HasMaxLength(100);
            e.Property(x => x.TaxNumber).HasMaxLength(20);
            e.Property(x => x.TaxOffice).HasMaxLength(100);
            e.Property(x => x.AuthorizedPerson).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Email).HasMaxLength(200);
        });

        b.Entity<Installation>(e =>
        {
            e.ToTable("installations");
            e.Property(x => x.Name).HasMaxLength(300);
            e.Property(x => x.InstallationType).HasMaxLength(30);
            e.Property(x => x.GenerationType).HasMaxLength(30);
            e.Property(x => x.VoltageLevel).HasMaxLength(50);
            e.Property(x => x.MeterType).HasMaxLength(50);
            e.Property(x => x.Latitude).HasPrecision(9, 6);
            e.Property(x => x.Longitude).HasPrecision(9, 6);
            e.HasOne(x => x.Customer).WithMany(c => c.Installations).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DistributionCompany).WithMany().HasForeignKey(x => x.DistributionCompanyId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProductionSiteInfo>(e =>
        {
            e.ToTable("production_site_info");
            e.HasIndex(x => x.InstallationId).IsUnique();
            e.Property(x => x.PlantName).HasMaxLength(200);
            e.Property(x => x.PlantSubtype).HasMaxLength(30);
            e.Property(x => x.TiltDeg).HasPrecision(5, 2);
            e.Property(x => x.AzimuthDeg).HasPrecision(5, 2);
            e.HasOne(x => x.Installation).WithOne(i => i.ProductionSiteInfo)
             .HasForeignKey<ProductionSiteInfo>(x => x.InstallationId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<OsosConnection>(e =>
        {
            e.ToTable("osos_connections");
            e.Property(x => x.ConnectionName).HasMaxLength(200);
            e.Property(x => x.Username).HasMaxLength(100);
            e.Property(x => x.LastConnectionStatus).HasMaxLength(500);
            e.HasOne(x => x.Customer).WithMany(c => c.OsosConnections).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DistributionCompany).WithMany().HasForeignKey(x => x.DistributionCompanyId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OsosSubscription>(e =>
        {
            e.ToTable("osos_subscriptions");
            e.HasIndex(x => new { x.OsosConnectionId, x.SubscriptionSerno }).IsUnique();
            foreach (var p in new[] { "IdentifierValue", "IdentifierValueSec", "DefinitionType", "MeterSerial", "MeterBrand",
                                      "MeterModel", "ScheduleCode", "GroupInfo", "EtsoCode" })
                e.Property(p).HasMaxLength(100);
            e.Property(x => x.SourceTitle).HasMaxLength(300);
            e.HasOne(x => x.OsosConnection).WithMany(c => c.Subscriptions).HasForeignKey(x => x.OsosConnectionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Installation).WithMany(i => i.OsosSubscriptions).HasForeignKey(x => x.InstallationId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Document>(e =>
        {
            e.ToTable("documents");
            e.HasIndex(x => new { x.CustomerId, x.IsActive });
            e.Property(x => x.Title).HasMaxLength(300);
            e.Property(x => x.FileName).HasMaxLength(300);
            e.Property(x => x.StorageKey).HasMaxLength(300);
            e.Property(x => x.MimeType).HasMaxLength(150);
            e.Property(x => x.UploadedByType).HasMaxLength(20);
            e.HasOne(x => x.Customer).WithMany(c => c.Documents).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Installation).WithMany().HasForeignKey(x => x.InstallationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DocumentType).WithMany().HasForeignKey(x => x.DocumentTypeId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ParameterGroup>(e =>
        {
            e.ToTable("parameter_groups");
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(50);
            e.Property(x => x.Name).HasMaxLength(200);
        });

        b.Entity<ParameterValue>(e =>
        {
            e.ToTable("parameter_values");
            e.HasIndex(x => new { x.ParameterGroupId, x.Code }).IsUnique();
            e.Property(x => x.Code).HasMaxLength(50);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasOne(x => x.ParameterGroup).WithMany(g => g.Values).HasForeignKey(x => x.ParameterGroupId).OnDelete(DeleteBehavior.Restrict);
        });

        foreach (var t in CustomerModuleTables)
            foreach (var p in b.Entity(t).Metadata.GetProperties())
            {
                // Dokümandaki gibi snake_case kolon adları (SourceInstalledPowerKw → source_installed_power_kw).
                p.SetColumnName(ToSnakeCase(p.Name));
                // Güç/çarpan/oran alanları için varsayılan decimal(18,4).
                if (Nullable.GetUnderlyingType(p.ClrType) == typeof(decimal) || p.ClrType == typeof(decimal))
                {
                    if (p.GetPrecision() is null) p.SetPrecision(18);
                    if (p.GetScale() is null) p.SetScale(4);
                }
            }
    }

    internal static string ToSnakeCase(string name)
    {
        var sb = new System.Text.StringBuilder(name.Length + 8);
        for (int i = 0; i < name.Length; i++)
        {
            char c = name[i];
            if (char.IsUpper(c) && i > 0) sb.Append('_');
            sb.Append(char.ToLowerInvariant(c));
        }
        return sb.ToString();
    }
}
