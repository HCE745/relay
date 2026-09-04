import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL must be set to seed")

const adapter = new PrismaPg(connectionString)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database…")

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: "Acme Manufacturing",
      slug: "acme-manufacturing",
      industry: "Manufacturing",
    },
  })

  // Create locations
  const [hq, warehouse, plantA] = await Promise.all([
    prisma.location.create({ data: { name: "Headquarters", city: "Chicago", state: "IL", country: "US", organizationId: org.id } }),
    prisma.location.create({ data: { name: "Main Warehouse", address: "123 Industrial Blvd", city: "Chicago", state: "IL", country: "US", organizationId: org.id } }),
    prisma.location.create({ data: { name: "Plant A", city: "Detroit", state: "MI", country: "US", organizationId: org.id } }),
  ])

  // Create departments
  const [maintenance, operations, safety] = await Promise.all([
    prisma.department.create({ data: { name: "Maintenance", organizationId: org.id, locationId: warehouse.id } }),
    prisma.department.create({ data: { name: "Operations", organizationId: org.id, locationId: warehouse.id } }),
    prisma.department.create({ data: { name: "Safety & Compliance", organizationId: org.id } }),
  ])

  // Create vendors
  const [hvacVendor, electrician] = await Promise.all([
    prisma.vendor.create({ data: { name: "CoolAir HVAC Services", contactName: "Bob Smith", email: "bob@coolair.com", phone: "312-555-0101", specialty: "HVAC & Refrigeration", organizationId: org.id } }),
    prisma.vendor.create({ data: { name: "PowerUp Electric", contactName: "Sarah Jones", email: "sarah@powerup.com", phone: "312-555-0202", specialty: "Electrical", organizationId: org.id } }),
  ])

  // Create users
  const password = await bcrypt.hash("password123", 12)

  const [admin, manager, supervisor, emp1, emp2] = await Promise.all([
    prisma.user.create({ data: { name: "Alex Johnson", email: "admin@acme.com", password, role: "ADMIN", organizationId: org.id, locationId: hq.id } }),
    prisma.user.create({ data: { name: "Maria Garcia", email: "manager@acme.com", password, role: "MANAGER", organizationId: org.id, departmentId: operations.id, locationId: warehouse.id } }),
    prisma.user.create({ data: { name: "James Wilson", email: "supervisor@acme.com", password, role: "SUPERVISOR", organizationId: org.id, departmentId: maintenance.id, locationId: warehouse.id } }),
    prisma.user.create({ data: { name: "Emily Chen", email: "emily@acme.com", password, role: "EMPLOYEE", organizationId: org.id, departmentId: operations.id, locationId: warehouse.id } }),
    prisma.user.create({ data: { name: "David Brown", email: "david@acme.com", password, role: "EMPLOYEE", organizationId: org.id, departmentId: maintenance.id, locationId: plantA.id } }),
  ])

  // Create assets
  const [forklift, hvac, conveyor, truck] = await Promise.all([
    prisma.asset.create({ data: { name: "Forklift #1", assetTag: "FORK-001", type: "VEHICLE", status: "OPERATIONAL", manufacturer: "Toyota", model: "8FBE15U", serialNumber: "TY8F00234", organizationId: org.id, locationId: warehouse.id, departmentId: operations.id } }),
    prisma.asset.create({ data: { name: "HVAC Unit A", assetTag: "HVAC-001", type: "EQUIPMENT", status: "OPERATIONAL", manufacturer: "Carrier", model: "48HC", organizationId: org.id, locationId: warehouse.id, vendorId: hvacVendor.id } }),
    prisma.asset.create({ data: { name: "Conveyor Belt #3", assetTag: "CONV-003", type: "EQUIPMENT", status: "MAINTENANCE", manufacturer: "Hytrol", organizationId: org.id, locationId: plantA.id, departmentId: operations.id } }),
    prisma.asset.create({ data: { name: "Delivery Truck", assetTag: "VEH-001", type: "VEHICLE", status: "OPERATIONAL", manufacturer: "Ford", model: "F-350", serialNumber: "FORD35789", organizationId: org.id, locationId: warehouse.id } }),
  ])

  // Create issues
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  const twoDaysAgo = new Date(now.getTime() - 172800000)
  const threeDaysAgo = new Date(now.getTime() - 259200000)

  await Promise.all([
    prisma.issue.create({
      data: {
        title: "Forklift #1 making grinding noise",
        description: "The forklift has been making a loud grinding noise when lifting. Needs immediate inspection.",
        status: "OPEN",
        priority: "HIGH",
        category: "EQUIPMENT_BREAKDOWN",
        organizationId: org.id,
        locationId: warehouse.id,
        assetId: forklift.id,
        departmentId: operations.id,
        reportedById: emp1.id,
        assignedToId: supervisor.id,
        createdAt: yesterday,
      },
    }),
    prisma.issue.create({
      data: {
        title: "HVAC unit not cooling properly in storage area",
        description: "Temperature in the main storage area is 10 degrees above target. Products may be at risk.",
        status: "ESCALATED",
        priority: "CRITICAL",
        category: "FACILITY",
        organizationId: org.id,
        locationId: warehouse.id,
        assetId: hvac.id,
        vendorId: hvacVendor.id,
        reportedById: emp2.id,
        assignedToId: manager.id,
        isEscalated: true,
        escalationLevel: 2,
        lastEscalatedAt: yesterday,
        createdAt: threeDaysAgo,
      },
    }),
    prisma.issue.create({
      data: {
        title: "Conveyor belt #3 stopped mid-shift",
        description: "Conveyor stopped working during the night shift. Production halted for 2 hours.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        category: "EQUIPMENT_BREAKDOWN",
        organizationId: org.id,
        locationId: plantA.id,
        assetId: conveyor.id,
        departmentId: operations.id,
        reportedById: emp2.id,
        assignedToId: supervisor.id,
        createdAt: twoDaysAgo,
      },
    }),
    prisma.issue.create({
      data: {
        title: "Safety signage missing in loading dock area",
        description: "Several safety warning signs are missing or faded in the loading dock. This is a compliance issue.",
        status: "OPEN",
        priority: "MEDIUM",
        category: "SAFETY",
        organizationId: org.id,
        locationId: warehouse.id,
        departmentId: safety.id,
        reportedById: emp1.id,
        createdAt: twoDaysAgo,
      },
    }),
    prisma.issue.create({
      data: {
        title: "Low inventory of pallets",
        description: "We are running critically low on standard pallets. Current stock will last 2 days.",
        status: "OPEN",
        priority: "MEDIUM",
        category: "SUPPLY_SHORTAGE",
        organizationId: org.id,
        locationId: warehouse.id,
        reportedById: emp1.id,
        assignedToId: manager.id,
        createdAt: yesterday,
      },
    }),
    prisma.issue.create({
      data: {
        title: "Truck fluid leak in parking lot",
        description: "Noticed a fluid leak under the delivery truck. May be oil or coolant.",
        status: "RESOLVED",
        priority: "HIGH",
        category: "VEHICLE",
        organizationId: org.id,
        locationId: warehouse.id,
        assetId: truck.id,
        reportedById: emp2.id,
        assignedToId: supervisor.id,
        resolvedAt: now,
        createdAt: threeDaysAgo,
      },
    }),
  ])

  console.log("✅ Seed complete!")
  console.log("\nDemo accounts:")
  console.log("  Admin:      admin@acme.com / password123")
  console.log("  Manager:    manager@acme.com / password123")
  console.log("  Supervisor: supervisor@acme.com / password123")
  console.log("  Employee:   emily@acme.com / password123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
