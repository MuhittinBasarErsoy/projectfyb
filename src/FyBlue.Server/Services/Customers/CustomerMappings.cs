using System.Linq.Expressions;
using FyBlue.Contracts;
using FyBlue.Server.Data;

namespace FyBlue.Server.Services.Customers;

/// <summary>Varlık → DTO dönüşümleri (EF sorgularında da kullanılabilen ifadeler).</summary>
public static class CustomerMappings
{
    public static CustomerDto ToDto(this Customer c) => new(c.Id, c.CustomerCode, c.Title, c.ShortName, c.TaxNumber,
        c.TaxOffice, c.AuthorizedPerson, c.Phone, c.Email, c.Address, c.Notes, c.IsActive, c.CreatedAt, c.UpdatedAt);

    public static ProductionSiteInfoDto ToDto(this ProductionSiteInfo p) => new(p.PlantName, p.PlantSubtype, p.AcPowerKw,
        p.DcPowerKwp, p.CommissioningDate, p.TiltDeg, p.AzimuthDeg, p.InverterBrand, p.InverterModel, p.InverterQuantity,
        p.InverterUnitPowerKw, p.PanelBrand, p.PanelModel, p.PanelQuantity, p.PanelUnitPowerWp, p.Notes);

    public static void CopyTo(this ProductionSiteInfoDto d, ProductionSiteInfo p)
    {
        p.PlantName = d.PlantName; p.PlantSubtype = d.PlantSubtype; p.AcPowerKw = d.AcPowerKw; p.DcPowerKwp = d.DcPowerKwp;
        p.CommissioningDate = d.CommissioningDate; p.TiltDeg = d.TiltDeg; p.AzimuthDeg = d.AzimuthDeg;
        p.InverterBrand = d.InverterBrand; p.InverterModel = d.InverterModel; p.InverterQuantity = d.InverterQuantity;
        p.InverterUnitPowerKw = d.InverterUnitPowerKw; p.PanelBrand = d.PanelBrand; p.PanelModel = d.PanelModel;
        p.PanelQuantity = d.PanelQuantity; p.PanelUnitPowerWp = d.PanelUnitPowerWp; p.Notes = d.Notes;
        p.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>DistributionCompany, ProductionSiteInfo ve OsosSubscriptions yüklenmiş olmalı.</summary>
    public static InstallationDto ToDto(this Installation i) => new(
        i.Id, i.CustomerId, i.Name, i.InstallationType, i.GenerationType,
        i.DistributionCompanyId, i.DistributionCompany?.Name,
        i.SourceAddress, i.ManualAddress, i.ManualAddress ?? i.SourceAddress,
        i.SourceInstalledPowerKw, i.ManualInstalledPowerKw, i.ManualInstalledPowerKw ?? i.SourceInstalledPowerKw,
        i.SourceContractPowerKw, i.ManualContractPowerKw, i.ManualContractPowerKw ?? i.SourceContractPowerKw,
        i.VoltageLevel, i.MeterType, i.Latitude, i.Longitude, i.IsActive, i.UpdatedAt,
        i.ProductionSiteInfo?.ToDto(),
        i.OsosSubscriptions.OrderBy(s => s.SubscriptionSerno)
            .Select(s => new OsosSubscriptionBrief(s.Id, s.SubscriptionSerno, s.IdentifierValue, s.SourceTitle)).ToList());

    public static readonly Expression<Func<OsosConnection, OsosConnectionDto>> ConnectionDto = c => new OsosConnectionDto(
        c.Id, c.CustomerId, c.DistributionCompanyId, c.DistributionCompany != null ? c.DistributionCompany.Name : null,
        c.ConnectionName, c.Username, c.IsActive, c.LastConnectionTestAt, c.LastConnectionStatus, c.LastSyncAt,
        c.Subscriptions.Count(s => s.IsActive));

    public static readonly Expression<Func<OsosSubscription, OsosSubscriptionDto>> SubscriptionDto = s => new OsosSubscriptionDto(
        s.Id, s.OsosConnectionId, s.OsosConnection!.ConnectionName ?? s.OsosConnection.Username,
        s.InstallationId, s.Installation != null ? s.Installation.Name : null,
        s.SubscriptionSerno, s.IdentifierValue, s.IdentifierValueSec, s.DefinitionType, s.SourceTitle, s.SourceAddress,
        s.MeterSerial, s.MeterBrand, s.MeterModel, s.Multiplier, s.InstalledPowerKw, s.ContractPowerKw, s.EtsoCode,
        s.LastIndexAt, s.LastProfileAt, s.IsActive, s.UpdatedAt);

    public static readonly Expression<Func<ParameterValue, ParameterValueDto>> ValueDto = v => new ParameterValueDto(
        v.Id, v.ParameterGroupId, v.Code, v.Name, v.Description, v.SortOrder, v.IsSystem, v.IsActive);
}
