namespace Epias.Core.Formulas;

/// <summary>
/// EPİAŞ kataloğu dışındaki bir formül kaynağı (ör. OSOS sorgu sonuçları).
/// Bu tablolarda kolonlar metin olarak saklanır, satırlar kullanıcıya aittir ve
/// aynı dönem birden çok kez sorgulanmış olabilir; derleyici bunları buna göre okur.
/// </summary>
public sealed record ExternalFormulaSource
{
    /// <summary>Formülde kullanılan tablo adı. Örn: <c>osos_consumption</c>.</summary>
    public required string Name { get; init; }
    public required string Title { get; init; }
    public required string Tag { get; init; }

    public required string Schema { get; init; }
    public required string Table { get; init; }

    /// <summary>Satırın zamanını taşıyan (metin) kolon; yoksa kaynak tarihsizdir.</summary>
    public string? TimestampColumn { get; init; }

    /// <summary>Zaman damgalarında saat bilgisi var mı (günlük veride yoktur).</summary>
    public bool HasHour { get; init; }

    public required IReadOnlyList<ExternalFormulaField> Fields { get; init; }

    /// <summary>Satırın sahibi kullanıcı kolonu; <c>@appUserId</c> ile süzülür.</summary>
    public string? OwnerColumn { get; init; }

    /// <summary>
    /// Aynı dönem yeniden sorgulandığında yalnızca en son sorgunun satırları
    /// kullanılır: bu kolonun en büyük değeri "en son" sayılır.
    /// </summary>
    public string? VersionColumn { get; init; }

    /// <summary>En son sorgu bu kolonların her değeri için ayrı belirlenir (ör. Serno).</summary>
    public IReadOnlyList<string> VersionPartitionColumns { get; init; } = [];

    public long RowCount { get; init; }
}

public sealed record ExternalFormulaField(string Column, string Label);

/// <summary>Formül derleyicisine EPİAŞ dışı kaynak sağlar.</summary>
public interface IFormulaSourceProvider
{
    /// <summary>Önbellekteki kaynaklar (eşzamanlı; derleme sırasında kullanılır).</summary>
    IReadOnlyList<ExternalFormulaSource> Sources { get; }

    /// <summary>Kaynak listesini gerekiyorsa veritabanından yeniler.</summary>
    Task RefreshAsync(bool force = false, CancellationToken ct = default);
}
