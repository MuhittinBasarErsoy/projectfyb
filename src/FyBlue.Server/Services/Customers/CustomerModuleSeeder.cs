using FyBlue.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Services.Customers;

/// <summary>
/// Başlangıçta parametre gruplarını ve temel değerleri ekler (idempotent: yalnızca eksik olanlar eklenir,
/// kullanıcının pasife aldığı/değiştirdiği kayıtlara dokunulmaz).
/// </summary>
public static class CustomerModuleSeeder
{
    /// <summary>Faturalar sekmesi bu kodlu belge tipini süzer; sistem kaydıdır, silinemez.</summary>
    public const string InvoiceDocumentType = "FATURA";

    private static readonly (string code, string name, (string code, string name, bool system)[] values)[] Groups =
    [
        (ParameterGroupCodes.DocumentType, "Belge tipleri",
        [
            (InvoiceDocumentType, "Fatura", true),
            ("SOZLESME", "Sözleşme", false),
            ("PROJE", "Proje", false),
            ("KABUL", "Kabul belgesi", false),
            ("DIGER", "Diğer", false),
        ]),
        (ParameterGroupCodes.DistributionCompany, "Dağıtım şirketleri",
        [
            ("ADM", "ADM EDAŞ", false), ("AKEDAS", "AKEDAŞ", false), ("AKDENIZ", "Akdeniz EDAŞ", false),
            ("ARAS", "Aras EDAŞ", false), ("AYEDAS", "AYEDAŞ", false), ("BASKENT", "Başkent EDAŞ", false),
            ("BOGAZICI", "Boğaziçi EDAŞ (BEDAŞ)", false), ("CAMLIBEL", "Çamlıbel EDAŞ", false),
            ("CORUH", "Çoruh EDAŞ", false), ("DICLE", "Dicle EDAŞ", false), ("FIRAT", "Fırat EDAŞ", false),
            ("GDZ", "GDZ EDAŞ", false), ("KCETAS", "KCETAŞ", false), ("MERAM", "Meram EDAŞ", false),
            ("OSMANGAZI", "Osmangazi EDAŞ", false), ("SAKARYA", "Sakarya EDAŞ", false),
            ("TOROSLAR", "Toroslar EDAŞ", false), ("TRAKYA", "Trakya EDAŞ", false),
            ("UEDAS", "Uludağ EDAŞ (UEDAŞ)", false), ("VANGOLU", "Vangölü EDAŞ", false),
            ("YESILIRMAK", "Yeşilırmak EDAŞ", false),
        ]),
        (ParameterGroupCodes.PanelBrand, "Panel markaları", []),
        (ParameterGroupCodes.InverterBrand, "İnverter markaları", []),
        (ParameterGroupCodes.MeterBrand, "Sayaç markaları", []),
    ];

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var groups = await db.ParameterGroups.Include(g => g.Values).ToListAsync(ct);
        foreach (var (code, name, values) in Groups)
        {
            var g = groups.FirstOrDefault(x => x.Code == code);
            if (g is null)
            {
                g = new ParameterGroup { Code = code, Name = name, IsSystem = true };
                db.ParameterGroups.Add(g);
            }
            int order = g.Values.Count == 0 ? 0 : g.Values.Max(v => v.SortOrder);
            foreach (var (vCode, vName, system) in values)
                if (!g.Values.Any(v => v.Code == vCode))
                    g.Values.Add(new ParameterValue { Code = vCode, Name = vName, IsSystem = system, SortOrder = ++order });
        }
        await db.SaveChangesAsync(ct);
    }
}
