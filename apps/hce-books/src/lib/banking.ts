/**
 * Plaid integration + bank transaction sync.
 * Access tokens are encrypted at rest per-tenant via AES-256-GCM.
 */
import "server-only"
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid"
import { prisma } from "./prisma"
import { encrypt, decrypt } from "./encrypt"

function getPlaidClient() {
  const env = process.env.PLAID_ENV ?? "sandbox"
  const config = new Configuration({
    basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
        "PLAID-SECRET": process.env.PLAID_SECRET!,
      },
    },
  })
  return new PlaidApi(config)
}

/** Create a Plaid Link token for the given entity. */
export async function createLinkToken(userId: string, entityName: string) {
  const client = getPlaidClient()
  const resp = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "HCE Books",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    account_filters: {
      depository: { account_subtypes: ["checking", "savings"] as never[] },
    },
  })
  return resp.data.link_token
}

/** Exchange a public token for an access token and store it encrypted. */
export async function exchangePublicToken(params: {
  tenantId: string
  entityId: string
  publicToken: string
  ledgerAccountId: string
  accountName: string
}) {
  const client = getPlaidClient()
  const exchange = await client.itemPublicTokenExchange({ public_token: params.publicToken })
  const { access_token, item_id } = exchange.data

  // Fetch accounts to get plaidAccountId
  const acctResp = await client.accountsGet({ access_token })
  const account = acctResp.data.accounts[0]

  const encryptedToken = await encrypt(access_token)

  return prisma.bankAccount.create({
    data: {
      tenantId: params.tenantId,
      entityId: params.entityId,
      name: params.accountName,
      ledgerAccountId: params.ledgerAccountId,
      plaidItemId: item_id,
      plaidAccountId: account.account_id,
      plaidAccessToken: encryptedToken,
    },
  })
}

/** Sync transactions from Plaid for a bank account. */
export async function syncBankAccount(bankAccountId: string) {
  const bankAccount = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })
  if (!bankAccount.plaidAccessToken) throw new Error("Bank account not linked to Plaid")

  const accessToken = await decrypt(bankAccount.plaidAccessToken)
  const client = getPlaidClient()

  // Fetch up to 500 transactions (last 30 days)
  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const resp = await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
    options: { count: 500, offset: 0 },
  })

  const txns = resp.data.transactions

  // Upsert transactions
  for (const txn of txns) {
    // Plaid amounts: positive = money leaving account (debit in bank statement)
    const amountCents = Math.round(txn.amount * 100)

    await prisma.bankTransaction.upsert({
      where: {
        bankAccountId_plaidTransactionId: {
          bankAccountId,
          plaidTransactionId: txn.transaction_id,
        },
      },
      create: {
        tenantId: bankAccount.tenantId,
        entityId: bankAccount.entityId,
        bankAccountId,
        plaidTransactionId: txn.transaction_id,
        date: new Date(txn.date),
        name: txn.name,
        amount: amountCents,
        isMatched: false,
        isCleared: false,
        category: txn.personal_finance_category?.primary ?? null,
      },
      update: {
        name: txn.name,
        amount: amountCents,
        category: txn.personal_finance_category?.primary ?? null,
      },
    })
  }

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { lastSyncedAt: new Date() },
  })

  return { synced: txns.length }
}
