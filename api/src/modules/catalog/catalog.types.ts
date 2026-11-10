import type { HsnSacKind } from "@erp-software/shared";

// The small masters behind item and vehicle forms. They share one module because they share
// one shape: name-like key unique among active rows, soft delete, list without pagination.
export const CATALOG_KINDS = ["categories", "brands", "hsnSac", "vehicleMakes", "vehicleModels"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

export interface BrandDto {
  id: string;
  name: string;
  itemCount: number;
}

export interface HsnSacDto {
  id: string;
  code: string;
  kind: HsnSacKind;
  description: string;
  gstRate: number;
}

export interface VehicleMakeDto {
  id: string;
  name: string;
  modelCount: number;
}

export interface VehicleModelDto {
  id: string;
  makeId: string;
  makeName: string;
  name: string;
}

export type CatalogDto = CategoryDto | BrandDto | HsnSacDto | VehicleMakeDto | VehicleModelDto;

export interface ListCatalogQuery {
  search?: string;
  makeId?: string;
}

export type CatalogInput = Record<string, unknown>;

export const CATALOG_LABELS: Record<CatalogKind, { entity: string; noun: string; key: "name" | "code" }> = {
  categories: { entity: "ItemCategory", noun: "Category", key: "name" },
  brands: { entity: "Brand", noun: "Brand", key: "name" },
  hsnSac: { entity: "HsnSac", noun: "HSN/SAC code", key: "code" },
  vehicleMakes: { entity: "VehicleMake", noun: "Make", key: "name" },
  vehicleModels: { entity: "VehicleModel", noun: "Model", key: "name" },
};
