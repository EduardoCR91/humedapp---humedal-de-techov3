import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PushPayload = {
  type?: "news" | "education_event" | "risk_report";
  title?: string;
  body?: string;
  recordId?: string;
};

const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

const encoder = new TextEncoder();

const toBase64Url = (input: string | Uint8Array) => {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const importPrivateKey = async (pem: string) => {
  const normalized = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binary = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
};

const createGoogleAccessToken = async () => {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "";
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
  const tokenUri = Deno.env.get("FIREBASE_TOKEN_URI") || "https://oauth2.googleapis.com/token";

  if (!clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY secret.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: GOOGLE_OAUTH_SCOPE,
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedToken),
  );
  const jwt = `${unsignedToken}.${toBase64Url(new Uint8Array(signature))}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth failed: ${text}`);
  }

  const data = await response.json();
  return data.access_token as string;
};

const sendFirebaseMessage = async (
  accessToken: string,
  firebaseProjectId: string,
  token: string,
  payload: Required<Pick<PushPayload, "title" | "body">> & Pick<PushPayload, "type" | "recordId">,
) => {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            type: payload.type || "",
            recordId: payload.recordId || "",
            click_action: "OPEN_ECOVIGIA_NOTIFICATION",
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "ecovigia_general",
              sound: "default",
            },
          },
        },
      }),
    },
  );

  if (response.ok) {
    return { ok: true as const };
  }

  const text = await response.text();
  return { ok: false as const, error: text };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedKey = Deno.env.get("PUSH_WEBHOOK_KEY") || "";
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!expectedKey || bearerToken !== expectedKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: PushPayload;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const title = body.title?.trim();
  const messageBody = body.body?.trim();
  if (!title || !messageBody) {
    return new Response("Missing title/body", { status: 400 });
  }

  const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID") || "";
  if (!firebaseProjectId) {
    return new Response("Missing FIREBASE_PROJECT_ID secret", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tokenRows, error: tokenError } = await supabase
    .from("device_push_tokens")
    .select("token")
    .eq("is_active", true)
    .eq("platform", "android");

  if (tokenError) {
    return new Response(tokenError.message, { status: 500 });
  }

  const tokens = (tokenRows || [])
    .map((row) => row.token as string)
    .filter(Boolean);

  if (!tokens.length) {
    return Response.json({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  let accessToken = "";
  try {
    accessToken = await createGoogleAccessToken();
  } catch (error) {
    return new Response((error as Error).message, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const result = await sendFirebaseMessage(accessToken, firebaseProjectId, token, {
      title,
      body: messageBody,
      type: body.type,
      recordId: body.recordId,
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;
    if (
      result.error.includes("UNREGISTERED") ||
      result.error.includes("INVALID_ARGUMENT")
    ) {
      invalidTokens.push(token);
    }
  }

  if (invalidTokens.length) {
    await supabase
      .from("device_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("token", invalidTokens);
  }

  return Response.json({
    ok: true,
    sent,
    failed,
    invalidated: invalidTokens.length,
  });
});
