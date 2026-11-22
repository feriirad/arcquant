import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = createSupabaseServerClient(await cookies());
    const { data: authData, error: authError } = await session.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error } = await admin
      .from("users")
      .select("id, wallet_address")
      .eq("auth_user_id", authData.user.id)
      .single();
    if (error || !profile) {
      return Response.json({ error: "The authenticated user profile was not found." }, { status: 404 });
    }

    return Response.json({ userId: profile.id, walletAddress: profile.wallet_address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the profile.";
    return Response.json({ error: message }, { status: 500 });
  }
}
