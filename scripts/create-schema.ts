import "dotenv/config"
import { Client } from "pg"

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  await c.query("CREATE SCHEMA IF NOT EXISTS hce")
  console.log("hce schema created")
  await c.end()
}

main().catch(console.error)
