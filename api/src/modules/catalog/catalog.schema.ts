import { z } from "zod";
import {
  brandCreateSchema,
  brandUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  hsnSacCreateSchema,
  hsnSacUpdateSchema,
  vehicleMakeCreateSchema,
  vehicleMakeUpdateSchema,
  vehicleModelCreateSchema,
  vehicleModelUpdateSchema,
} from "@automobile/shared";
import { searchQuery } from "../../common/schemas";
import type { CatalogKind } from "./catalog.types";

export const CATALOG_SCHEMAS: Record<CatalogKind, { create: z.ZodObject; update: z.ZodObject }> = {
  categories: { create: categoryCreateSchema, update: categoryUpdateSchema },
  brands: { create: brandCreateSchema, update: brandUpdateSchema },
  hsnSac: { create: hsnSacCreateSchema, update: hsnSacUpdateSchema },
  vehicleMakes: { create: vehicleMakeCreateSchema, update: vehicleMakeUpdateSchema },
  vehicleModels: { create: vehicleModelCreateSchema, update: vehicleModelUpdateSchema },
};

export const listCatalogQuerySchema = z.object({ search: searchQuery, makeId: z.uuid().optional() });
