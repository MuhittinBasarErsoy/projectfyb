namespace FyBlue.Contracts;

// ---- Müşteri modülü ----
// Kod listeleri (installation_type, generation_type, plant_subtype) sunucudaki sabitlerle aynıdır:
// CONSUMPTION | PRODUCTION | PRODUCTION_CONSUMPTION; SOLAR | WIND | HYDRO | GEOTHERMAL | COGENERATION | OTHER.

public sealed record CustomerListItem(
    int Id, string CustomerCode, string Title, string? ShortName, string? TaxNumber, string? Phone,
    bool IsActive, int InstallationCount, int OsosConnectionCount, DateTime UpdatedAt);

public sealed record CustomerDto(
    int Id, string CustomerCode, string Title, string? ShortName, string? TaxNumber, string? TaxOffice,
    string? AuthorizedPerson, string? Phone, string? Email, string? Address, string? Notes,
    bool IsActive, DateTime CreatedAt, DateTime UpdatedAt);

public sealed record CustomerSaveRequest(
    string CustomerCode, string Title, string? ShortName, string? TaxNumber, string? TaxOffice,
    string? AuthorizedPerson, string? Phone, string? Email, string? Address, string? Notes, bool IsActive = true);

/// <summary>Müşteri detayının "Özet" sekmesi.</summary>
public sealed record CustomerSummaryDto(
    CustomerDto Customer,
    int InstallationCount,
    int ConsumptionInstallationCount,
    int ProductionInstallationCount,
    decimal? TotalInstalledPowerKw,
    decimal? TotalContractPowerKw,
    int DocumentCount,
    int InvoiceCount,
    int OsosConnectionCount,
    int SubscriptionCount,
    int UnmatchedSubscriptionCount,
    DateTime? LastSyncAt);

// ---- Tesisatlar ----

public sealed record ProductionSiteInfoDto(
    string? PlantName, string? PlantSubtype, decimal? AcPowerKw, decimal? DcPowerKwp, DateOnly? CommissioningDate,
    decimal? TiltDeg, decimal? AzimuthDeg,
    string? InverterBrand, string? InverterModel, int? InverterQuantity, decimal? InverterUnitPowerKw,
    string? PanelBrand, string? PanelModel, int? PanelQuantity, decimal? PanelUnitPowerWp,
    string? Notes);

/// <summary>
/// Kaynak (OSOS) ve manuel değerler ayrı döner; Effective* = manuel ?? kaynak.
/// Manuel değerler OSOS senkronizasyonunda ezilmez.
/// </summary>
public sealed record InstallationDto(
    int Id, int CustomerId, string Name, string InstallationType, string? GenerationType,
    int? DistributionCompanyId, string? DistributionCompanyName,
    string? SourceAddress, string? ManualAddress, string? EffectiveAddress,
    decimal? SourceInstalledPowerKw, decimal? ManualInstalledPowerKw, decimal? EffectiveInstalledPowerKw,
    decimal? SourceContractPowerKw, decimal? ManualContractPowerKw, decimal? EffectiveContractPowerKw,
    string? VoltageLevel, string? MeterType, decimal? Latitude, decimal? Longitude,
    bool IsActive, DateTime UpdatedAt,
    ProductionSiteInfoDto? ProductionSiteInfo,
    IReadOnlyList<OsosSubscriptionBrief> Subscriptions);

public sealed record OsosSubscriptionBrief(int Id, long SubscriptionSerno, string? IdentifierValue, string? SourceTitle);

/// <summary>Kaynak (source_*) alanları yalnızca OSOS senkronizasyonu yazar; formdan manuel değerler gelir.</summary>
public sealed record InstallationSaveRequest(
    string Name, string InstallationType, string? GenerationType, int? DistributionCompanyId,
    string? ManualAddress, decimal? ManualInstalledPowerKw, decimal? ManualContractPowerKw,
    string? VoltageLevel, string? MeterType, decimal? Latitude, decimal? Longitude, bool IsActive = true,
    ProductionSiteInfoDto? ProductionSiteInfo = null);

// ---- OSOS bağlantıları / abonelikler ----

public sealed record OsosConnectionDto(
    int Id, int CustomerId, int? DistributionCompanyId, string? DistributionCompanyName, string? ConnectionName,
    string Username, bool IsActive, DateTime? LastConnectionTestAt, string? LastConnectionStatus, DateTime? LastSyncAt,
    int SubscriptionCount);

/// <summary>Password boş bırakılırsa (güncellemede) mevcut şifre korunur.</summary>
public sealed record OsosConnectionSaveRequest(
    int? DistributionCompanyId, string? ConnectionName, string Username, string? Password, bool IsActive = true);

public sealed record OsosSubscriptionDto(
    int Id, int OsosConnectionId, string? ConnectionName, int? InstallationId, string? InstallationName,
    long SubscriptionSerno, string? IdentifierValue, string? IdentifierValueSec, string? DefinitionType,
    string? SourceTitle, string? SourceAddress, string? MeterSerial, string? MeterBrand, string? MeterModel,
    decimal? Multiplier, decimal? InstalledPowerKw, decimal? ContractPowerKw, string? EtsoCode,
    DateTime? LastIndexAt, DateTime? LastProfileAt, bool IsActive, DateTime UpdatedAt);

/// <summary>InstallationId null → eşleşmeyi kaldır.</summary>
public sealed record LinkSubscriptionRequest(int? InstallationId);

public sealed record OsosSyncResult(bool Success, string Message, int Added, int Updated, int Deactivated);

/// <summary>Müşteri detayındaki Tüketim / Üretim / Endeks sekmeleri (canlı OSOS sorgusu).</summary>
public sealed record CustomerOsosQuery(DateTime StartDate, DateTime EndDate, int? InstallationId = null, int Type = 2);

public sealed record CustomerOsosResult(string RawJson, int RowCount, int SubscriptionCount, IReadOnlyList<string> Warnings);

// ---- Belgeler ----

public sealed record DocumentDto(
    int Id, int CustomerId, int? InstallationId, string? InstallationName,
    int DocumentTypeId, string DocumentTypeName, string DocumentTypeCode,
    string Title, string FileName, string? MimeType, long FileSize,
    DateOnly? DocumentDate, int? PeriodYear, int? PeriodMonth, DateOnly? ExpiryDate, string? Description,
    string UploadedByType, string? UploadedByName, bool IsActive, DateTime CreatedAt);

// ---- Parametreler ----

public sealed record ParameterValueDto(
    int Id, int ParameterGroupId, string Code, string Name, string? Description, int SortOrder, bool IsSystem, bool IsActive);

public sealed record ParameterGroupDto(
    int Id, string Code, string Name, bool IsSystem, bool IsActive, IReadOnlyList<ParameterValueDto> Values);

public sealed record ParameterGroupSaveRequest(string Code, string Name, bool IsActive = true);

public sealed record ParameterValueSaveRequest(string Code, string Name, string? Description, int SortOrder = 0, bool IsActive = true);

// ---- Müşteri kullanıcıları ----

public sealed record CustomerUserDto(string Id, string Username, string? Email, DateTime CreatedAt);

public sealed record CreateCustomerUserRequest(string Username, string? Email, string Password);
