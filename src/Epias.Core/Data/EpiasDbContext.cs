using Microsoft.EntityFrameworkCore;

namespace Epias.Core.Data;

/// <summary>EPİAŞ modülünün meta verisi (kullanıcılar FyBlue Identity tarafında). Endpoint verileri burada değil, dinamik tablolarda tutulur.</summary>
public sealed class EpiasDbContext(DbContextOptions<EpiasDbContext> options) : DbContext(options)
{
    public DbSet<SyncRun> SyncRuns => Set<SyncRun>();
    public DbSet<Formula> Formulas => Set<Formula>();
    public DbSet<FormulaRun> FormulaRuns => Set<FormulaRun>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("app");

        b.Entity<SyncRun>(e =>
        {
            e.ToTable("sync_runs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.EndpointKey, x.StartedAt });
            e.Property(x => x.EndpointKey).HasMaxLength(150).IsRequired();
            e.Property(x => x.Error).HasColumnType("NVARCHAR(MAX)");
            e.Property(x => x.ParametersJson).HasColumnType("NVARCHAR(MAX)");
            e.Property(x => x.TriggeredBy).HasMaxLength(200);
        });

        b.Entity<Formula>(e =>
        {
            e.ToTable("formulas");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.Expression).HasColumnType("NVARCHAR(MAX)").IsRequired();
            e.Property(x => x.AlignmentMode).HasMaxLength(20).IsRequired();
            e.Property(x => x.OutputTable).HasMaxLength(150);
            e.Property(x => x.CreatedBy).HasMaxLength(200);
        });

        b.Entity<FormulaRun>(e =>
        {
            e.ToTable("formula_runs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.FormulaId, x.StartedAt });
            e.Property(x => x.Error).HasColumnType("NVARCHAR(MAX)");
            e.HasOne(x => x.Formula).WithMany(x => x.Runs).HasForeignKey(x => x.FormulaId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

public sealed class SyncRun
{
    public long Id { get; set; }
    public string EndpointKey { get; set; } = "";
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
    public int Fetched { get; set; }
    public int Inserted { get; set; }
    public int Duplicates { get; set; }
    public int Requests { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? ParametersJson { get; set; }
    public string? TriggeredBy { get; set; }
}

public sealed class Formula
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string Expression { get; set; } = "";
    public string AlignmentMode { get; set; } = "DateHour";
    public string? OutputTable { get; set; }
    public DateTimeOffset? DefaultFrom { get; set; }
    public DateTimeOffset? DefaultTo { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }

    public List<FormulaRun> Runs { get; set; } = new();
}

public sealed class FormulaRun
{
    public long Id { get; set; }
    public int FormulaId { get; set; }
    public Formula? Formula { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
    public int RowsProduced { get; set; }
    public int RowsPersisted { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}
