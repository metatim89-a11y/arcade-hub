import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "https://metatim89-a11y.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Authorization required");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: actor }, error: actorError } = await admin.auth.getUser(token);
    if (actorError || !actor) throw new Error("Invalid administrator session");
    const { data: assignment } = await admin.from("admin_users").select("user_id").eq("user_id", actor.id).maybeSingle();
    if (!assignment) throw new Error("Administrator access required");
    const { action, userId, temporaryPassword } = await request.json();
    if (!userId || userId === actor.id) throw new Error("That account cannot be managed here");

    if (action === "set_temporary_password") {
      if (typeof temporaryPassword !== "string" || temporaryPassword.length < 8) throw new Error("Temporary password must have at least 8 characters");
      const { error } = await admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
      if (error) throw error;
    } else if (action === "send_reset_email") {
      const { data, error: userError } = await admin.auth.admin.getUserById(userId);
      if (userError || !data.user?.email) throw new Error("Player email could not be found");
      const { error } = await admin.auth.resetPasswordForEmail(data.user.email, { redirectTo: "https://metatim89-a11y.github.io/arcade-hub/?password-recovery=1" });
      if (error) throw error;
    } else if (action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(userId, true);
      if (error) throw error;
    } else throw new Error("Unsupported account action");
    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }), { status: 400, headers });
  }
});
