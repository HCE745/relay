import { prisma } from "@/lib/prisma"
import { GoogleAuth } from "google-auth-library"

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "", "base64").toString("utf8")
)

let _auth: GoogleAuth | null = null

function getAuth(): GoogleAuth {
  if (!_auth) {
    _auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    })
  }
  return _auth
}

async function getFcmAccessToken(): Promise<string> {
  const client = await getAuth().getClient()
  const token  = await client.getAccessToken()
  if (!token.token) throw new Error("Failed to obtain FCM access token")
  return token.token
}

// Returns the FCM V1 endpoint for the given project.
// Reads project_id from the service account key file at runtime.
async function getFcmEndpoint(): Promise<string> {
  const auth      = getAuth()
  const projectId = await auth.getProjectId()
  return `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
}

/**
 * Send a push notification to all registered devices for a user via FCM V1.
 * Uses a service account JSON for OAuth2 Bearer auth — no legacy server key.
 * Silently no-ops when the service account file is missing or the user has no tokens.
 */
export async function sendPushNotification(
  userId: string,
  title:  string,
  body:   string,
  data?:  Record<string, string>,
): Promise<void> {
  try {
    const deviceTokens = await prisma.deviceToken.findMany({
      where:  { userId },
      select: { token: true },
    })

    if (deviceTokens.length === 0) return

    const [accessToken, endpoint] = await Promise.all([
      getFcmAccessToken(),
      getFcmEndpoint(),
    ])

    // FCM V1 sends one message per token (no batch registration_ids).
    await Promise.allSettled(
      deviceTokens.map(({ token }) =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data:         data ?? {},
              android: {
                priority: "high",
                notification: { sound: "default" },
              },
              apns: {
                payload: {
                  aps: { sound: "default", badge: 1 },
                },
              },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        }).then(async res => {
          if (!res.ok) {
            console.error("[push] FCM V1 error for token", token.slice(-8), res.status, await res.text())
          }
        }),
      ),
    )
  } catch (err) {
    // Never throw — push is fire-and-forget alongside in-app/email
    console.error("[push] sendPushNotification error:", err)
  }
}
