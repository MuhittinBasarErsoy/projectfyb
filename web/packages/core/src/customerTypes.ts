// Müşteri modülü DTO'ları (sunucu: FyBlue.Contracts/CustomerContracts.cs). Null alanlar sunucudan gelmeyebilir.

export type UserRole = "Consultant" | "Customer";
export type InstallationType = "CONSUMPTION" | "PRODUCTION" | "PRODUCTION_CONSUMPTION";
export type GenerationType = "SOLAR" | "WIND" | "HYDRO" | "GEOTHERMAL" | "COGENERATION" | "OTHER";
export type CustomerOsosKind = "consumption" | "production" | "endex";

export interface CustomerListItem {
  id: number;
  customerCode: string;
  title: string;
  shortName?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  isActive: boolean;
  installationCount: number;
  ososConnectionCount: number;
  updatedAt: string;
}

export interface CustomerSaveRequest {
  customerCode: string;
  title: string;
  shortName?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  authorizedPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface CustomerDto extends CustomerSaveRequest {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummaryDto {
  customer: CustomerDto;
  installationCount: number;
  consumptionInstallationCount: number;
  productionInstallationCount: number;
  totalInstalledPowerKw?: number | null;
  totalContractPowerKw?: number | null;
  documentCount: number;
  invoiceCount: number;
  ososConnectionCount: number;
  subscriptionCount: number;
  unmatchedSubscriptionCount: number;
  lastSyncAt?: string | null;
}

export interface ProductionSiteInfoDto {
  plantName?: string | null;
  plantSubtype?: string | null;
  acPowerKw?: number | null;
  dcPowerKwp?: number | null;
  commissioningDate?: string | null;
  tiltDeg?: number | null;
  azimuthDeg?: number | null;
  inverterBrand?: string | null;
  inverterModel?: string | null;
  inverterQuantity?: number | null;
  inverterUnitPowerKw?: number | null;
  panelBrand?: string | null;
  panelModel?: string | null;
  panelQuantity?: number | null;
  panelUnitPowerWp?: number | null;
  notes?: string | null;
}

export interface OsosSubscriptionBrief {
  id: number;
  subscriptionSerno: number;
  identifierValue?: string | null;
  sourceTitle?: string | null;
}

export interface InstallationDto {
  id: number;
  customerId: number;
  name: string;
  installationType: InstallationType;
  generationType?: GenerationType | null;
  distributionCompanyId?: number | null;
  distributionCompanyName?: string | null;
  sourceAddress?: string | null;
  manualAddress?: string | null;
  effectiveAddress?: string | null;
  sourceInstalledPowerKw?: number | null;
  manualInstalledPowerKw?: number | null;
  effectiveInstalledPowerKw?: number | null;
  sourceContractPowerKw?: number | null;
  manualContractPowerKw?: number | null;
  effectiveContractPowerKw?: number | null;
  voltageLevel?: string | null;
  meterType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  updatedAt: string;
  productionSiteInfo?: ProductionSiteInfoDto | null;
  subscriptions: OsosSubscriptionBrief[];
}

export interface InstallationSaveRequest {
  name: string;
  installationType: InstallationType;
  generationType?: GenerationType | null;
  distributionCompanyId?: number | null;
  manualAddress?: string | null;
  manualInstalledPowerKw?: number | null;
  manualContractPowerKw?: number | null;
  voltageLevel?: string | null;
  meterType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  productionSiteInfo?: ProductionSiteInfoDto | null;
}

export interface OsosConnectionDto {
  id: number;
  customerId: number;
  distributionCompanyId?: number | null;
  distributionCompanyName?: string | null;
  connectionName?: string | null;
  username: string;
  isActive: boolean;
  lastConnectionTestAt?: string | null;
  lastConnectionStatus?: string | null;
  lastSyncAt?: string | null;
  subscriptionCount: number;
}

export interface OsosConnectionSaveRequest {
  distributionCompanyId?: number | null;
  connectionName?: string | null;
  username: string;
  /** Güncellemede boş → mevcut şifre korunur. */
  password?: string | null;
  isActive: boolean;
}

export interface OsosSubscriptionDto {
  id: number;
  ososConnectionId: number;
  connectionName?: string | null;
  installationId?: number | null;
  installationName?: string | null;
  subscriptionSerno: number;
  identifierValue?: string | null;
  identifierValueSec?: string | null;
  definitionType?: string | null;
  sourceTitle?: string | null;
  sourceAddress?: string | null;
  meterSerial?: string | null;
  meterBrand?: string | null;
  meterModel?: string | null;
  multiplier?: number | null;
  installedPowerKw?: number | null;
  contractPowerKw?: number | null;
  etsoCode?: string | null;
  lastIndexAt?: string | null;
  lastProfileAt?: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface OsosSyncResult {
  success: boolean;
  message: string;
  added: number;
  updated: number;
  deactivated: number;
}

export interface CustomerOsosResult {
  rawJson: string;
  rowCount: number;
  subscriptionCount: number;
  warnings: string[];
}

export interface DocumentDto {
  id: number;
  customerId: number;
  installationId?: number | null;
  installationName?: string | null;
  documentTypeId: number;
  documentTypeName: string;
  documentTypeCode: string;
  title: string;
  fileName: string;
  mimeType?: string | null;
  fileSize: number;
  documentDate?: string | null;
  periodYear?: number | null;
  periodMonth?: number | null;
  expiryDate?: string | null;
  description?: string | null;
  uploadedByType: "CONSULTANT" | "CUSTOMER";
  uploadedByName?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DocumentUpload {
  file: File;
  documentTypeId: number;
  installationId?: number | null;
  title?: string;
  documentDate?: string;
  periodYear?: number | null;
  periodMonth?: number | null;
  expiryDate?: string;
  description?: string;
}

export interface ParameterValueDto {
  id: number;
  parameterGroupId: number;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface ParameterGroupDto {
  id: number;
  code: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  values: ParameterValueDto[];
}

export interface ParameterValueSaveRequest {
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomerUserDto {
  id: string;
  username: string;
  email?: string | null;
  createdAt: string;
}
