import { prisma } from "@/lib/prisma"

export async function getPlatformConfig(key: string): Promise<string> {
  const row = await prisma.platformConfig.findUnique({ where: { key } })
  return row?.value ?? ""
}

export async function setPlatformConfig(key: string, value: string): Promise<void> {
  await prisma.platformConfig.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  })
}
