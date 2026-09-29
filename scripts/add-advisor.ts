// Makes someone an advisor (access to every client).
//
//   npm run add-advisor -- will@owneroptionaladvisory.com "Will"

import { resolve } from "node:path";
import { config } from "dotenv";
import { adminClient, findUserByEmail } from "./lib";

config({ path: resolve(__dirname, "../.env.local"), quiet: true });

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('\n✗ Usage: npm run add-advisor -- <email> "<display name>"\n');
    process.exit(1);
  }
  const db = adminClient();
  let user = await findUserByEmail(db, email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
    if (error) throw new Error(error.message);
    user = data.user;
  }
  const { data: member } = await db.from("client_members").select("id").eq("user_id", user.id).maybeSingle();
  if (member) throw new Error(`${email} is a client member. Use a different email for the advisor login.`);
  const { error } = await db.from("advisors").upsert({ user_id: user.id, display_name: name }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  console.log(`\n✓ ${name} <${email}> is an advisor. Sign in at /login with that email.\n`);
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
