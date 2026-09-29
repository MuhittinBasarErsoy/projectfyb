namespace FyBlue.Server.Data;

// Müşteri modülü tabloları. Tablo/kolon adları müşterinin veri yapısı dokümanındaki gibi snake_case
// (AppDbContext.ConfigureCustomerModule). Fiziksel silme yerine is_active / deleted_at kullanılır.

/// <summary>Kullanıcı rolleri. Danışman tüm müşterileri görür; müşteri kullanıcısı yalnızca kendi müşterisini.</summary>
public static class AppRoles
{
    public const string Consultant = "Consultant";
    public const string Customer = "Customer";
    public static readonly string[] All = [Consultant, Customer];
}

public static class InstallationTypes
{
    public const string Consumption = "CONSUMPTION";
    public const string Production = "PRODUCTION";
    public const string ProductionConsumption = "PRODUCTION_CONSUMPTION";
    public static readonly string[] All = [Consumption, Production, ProductionConsumption];
    public static bool HasProduction(string? t) => t is Production or ProductionConsumption;
}

public static class GenerationTypes
{
    public const string Solar = "SOLAR";
    public static readonly string[] All = [Solar, "WIND", "HYDRO", "GEOTHERMAL", "COGENERATION", "OTHER"];
}

public static class PlantSubtypes
{
    public static readonly string[] All = ["ROOFTOP", "GROUND", "CARPORT", "FACADE", "OTHER"];
}

public static class UploaderTypes
{
    public const string Consultant = "CONSULTANT";
    public const string Customer = "CUSTOMER";
}

public static class ParameterGroupCodes
{
    public const string DocumentType = "DOCUMENT_TYPE";
    public const string DistributionCompany = "DISTRIBUTION_COMPANY";
    public const string PanelBrand = "PANEL_BRAND";
    public const string InverterBrand = "INVERTER_BRAND";
    public const string MeterBrand = "METER_BRAND";
}

public sealed class Customer
{
    public int Id { get; set; }
    public string CustomerCode { get; set; } = "";
    public string Title { get; set; } = "";
    public string? ShortName { get; set; }
    public string? TaxNumber { get; set; }
    public string? TaxOffice { get; set; }
    public string? AuthorizedPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Installation> Installations { get; set; } = new();
    public List<OsosConnection> OsosConnections { get; set; } = new();
    public List<Document> Documents { get; set; } = new();
}

public sealed class Installation
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string Name { get; set; } = "";
    public string InstallationType { get; set; } = InstallationTypes.Consumption;
    public string? GenerationType { get; set; }
    public int? DistributionCompanyId { get; set; }
    public ParameterValue? DistributionCompany { get; set; }

    // source_* = OSOS'tan gelen (senkronizasyonda güncellenir), manual_* = danışman düzeltmesi (ezilmez).
    public string? SourceAddress { get; set; }
    public string? ManualAddress { get; set; }
    public decimal? SourceInstalledPowerKw { get; set; }
    public decimal? ManualInstalledPowerKw { get; set; }
    public decimal? SourceContractPowerKw { get; set; }
    public decimal? ManualContractPowerKw { get; set; }

    public string? VoltageLevel { get; set; }
    public string? MeterType { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ProductionSiteInfo? ProductionSiteInfo { get; set; }
    public List<OsosSubscription> OsosSubscriptions { get; set; } = new();
}

public sealed class ProductionSiteInfo
{
    public int Id { get; set; }
    public int InstallationId { get; set; }
    public Installation? Installation { get; set; }
    public string? PlantName { get; set; }
    public string? PlantSubtype { get; set; }
    public decimal? AcPowerKw { get; set; }
    public decimal? DcPowerKwp { get; set; }
    public DateOnly? CommissioningDate { get; set; }
    public decimal? TiltDeg { get; set; }
    public decimal? AzimuthDeg { get; set; }
    public string? InverterBrand { get; set; }
    public string? InverterModel { get; set; }
    public int? InverterQuantity { get; set; }
    public decimal? InverterUnitPowerKw { get; set; }
    public string? PanelBrand { get; set; }
    public string? PanelModel { get; set; }
    public int? PanelQuantity { get; set; }
    public decimal? PanelUnitPowerWp { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class OsosConnection
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int? DistributionCompanyId { get; set; }
    public ParameterValue? DistributionCompany { get; set; }
    public string? ConnectionName { get; set; }
    public string Username { get; set; } = "";
    /// <summary>DataProtection ("Osos.OsosPassword") ile korunmuş şifre.</summary>
    public string EncryptedPassword { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime? LastConnectionTestAt { get; set; }
    public string? LastConnectionStatus { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<OsosSubscription> Subscriptions { get; set; } = new();
}

public sealed class OsosSubscription
{
    public int Id { get; set; }
    public int OsosConnectionId { get; set; }
    public OsosConnection? OsosConnection { get; set; }
    public int? InstallationId { get; set; }
    public Installation? Installation { get; set; }
    public long SubscriptionSerno { get; set; }
    public string? IdentifierValue { get; set; }
    public string? IdentifierValueSec { get; set; }
    public string? DefinitionType { get; set; }
    public string? SourceTitle { get; set; }
    public string? SourceAddress { get; set; }
    public string? MeterSerial { get; set; }
    public string? MeterBrand { get; set; }
    public string? MeterModel { get; set; }
    public decimal? Multiplier { get; set; }
    public DateTime? LastIndexAt { get; set; }
    public DateTime? LastProfileAt { get; set; }
    public string? ScheduleCode { get; set; }
    public decimal? InstalledPowerKw { get; set; }
    public decimal? ContractPowerKw { get; set; }
    public string? GroupInfo { get; set; }
    public string? EtsoCode { get; set; }
    public DateTime? MeterPointAssignedAt { get; set; }
    public DateTime? MultiplierChangedAt { get; set; }
    public decimal? MinCapacitiveRate { get; set; }
    public decimal? MinInductiveRate { get; set; }
    /// <summary>OSOS'tan gelen ham kayıt (tanınmayan alanlar dahil).</summary>
    public string? CustomerFieldsJson { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Document
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int? InstallationId { get; set; }
    public Installation? Installation { get; set; }
    public int DocumentTypeId { get; set; }
    public ParameterValue? DocumentType { get; set; }
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string? MimeType { get; set; }
    public long FileSize { get; set; }
    public DateOnly? DocumentDate { get; set; }
    public int? PeriodYear { get; set; }
    public int? PeriodMonth { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? Description { get; set; }
    public string? UploadedByUserId { get; set; }
    public string UploadedByType { get; set; } = UploaderTypes.Consultant;
    public bool IsActive { get; set; } = true;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ParameterGroup
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<ParameterValue> Values { get; set; } = new();
}

public sealed class ParameterValue
{
    public int Id { get; set; }
    public int ParameterGroupId { get; set; }
    public ParameterGroup? ParameterGroup { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
