import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { ISettingsRepository } from "./interfaces/isettings.repository";
import type { SettingsGroup, StoredSetting } from "./settings.types";

@injectable()
export class SettingsRepository implements ISettingsRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  findAll(): Promise<StoredSetting[]> {
    return this.prisma.setting.findMany({ select: { group: true, value: true } });
  }

  find(group: SettingsGroup): Promise<StoredSetting | null> {
    return this.prisma.setting.findUnique({ where: { group }, select: { group: true, value: true } });
  }

  async upsert(group: SettingsGroup, value: object, updatedById: string): Promise<void> {
    const json = value as Prisma.InputJsonObject;
    await this.prisma.setting.upsert({
      where: { group },
      create: { group, value: json, updatedById },
      update: { value: json, updatedById },
    });
  }
}
