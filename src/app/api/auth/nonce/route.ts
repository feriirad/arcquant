import { randomBytes } from "node:crypto";
import { getAddress, isAddress } from "viem";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: { address?: unknown };
  try {
    body = (await request.json()) as { address?: unknown };
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return Response.json({ error: "A valid wallet address is required." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return Response.json({ error: "NEXT_PUBLIC_SITE_URL is not configured." }, { status: 500 });
  }

  let origin: URL;
  try {
    origin = new URL(siteUrl);
  } catch {
    return Response.json({ error: "NEXT_PUBLIC_SITE_URL must be an absolute URL." }, { status: 500 });
  }

  const address = getAddress(body.address);
  const nonce = randomBytes(24).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
  const message = [
    "ArcQuant wallet linking",
    `Domain: ${origin.host}`,
    `Address: ${address}`,
    "Chain ID: 5042002",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("wallet_nonces").insert({
      nonce,
      wallet_address: address,
      message,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      return Response.json({ error: "Could not create a wallet verification challenge." }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error.";
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ message });
}
