import { cookies } from "next/headers";
import { getAddress, isAddress, recoverMessageAddress } from "viem";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { address?: unknown; message?: unknown; signature?: unknown };
  try {
    body = (await request.json()) as {
      address?: unknown;
      message?: unknown;
      signature?: unknown;
    };
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body.address !== "string" ||
    !isAddress(body.address) ||
    typeof body.message !== "string" ||
    typeof body.signature !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(body.signature)
  ) {
    return Response.json({ error: "A valid address, signed message, and signature are required." }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const session = createSupabaseServerClient(cookieStore);
    const { data: authData, error: authError } = await session.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in to Supabase before linking a wallet." }, { status: 401 });
    }

    const address = getAddress(body.address);
    const signer = await recoverMessageAddress({
      message: body.message,
      signature: body.signature as `0x${string}`,
    });
    if (signer.toLowerCase() !== address.toLowerCase()) {
      return Response.json({ error: "The signature does not match the submitted wallet." }, { status: 401 });
    }

    const nonce = body.message.match(/^Nonce: ([a-fA-F0-9]+)$/m)?.[1];
    if (!nonce) {
      return Response.json({ error: "The signed challenge does not contain a valid nonce." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: nonceConsumed, error: nonceError } = await admin.rpc("consume_wallet_nonce", {
      p_nonce: nonce,
      p_wallet_address: address,
      p_message: body.message,
    });
    if (nonceError) {
      return Response.json({ error: "Could not verify the wallet challenge." }, { status: 500 });
    }
    if (!nonceConsumed) {
      return Response.json({ error: "The wallet challenge is expired or has already been used." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from("users")
      .update({ wallet_address: address })
      .eq("auth_user_id", authData.user.id)
      .select("id, wallet_address")
      .single();
    if (profileError || !profile) {
      if (profileError?.code === "23505") {
        return Response.json({ error: "This wallet is already linked to another account." }, { status: 409 });
      }
      return Response.json({ error: "Could not link the wallet to the Supabase profile." }, { status: 500 });
    }

    return Response.json({ userId: profile.id, walletAddress: profile.wallet_address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet linking failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
