import { supabaseAdmin } from "../src/lib/supabaseClient.js";

const { data, error } = await supabaseAdmin.from("boards").select("*").limit(1);

if (error) {
  console.error("Supabase connection failed:", error.message);
  process.exit(1);
}

console.log("Supabase connection ok.");
console.log(`Selected ${data.length} row${data.length === 1 ? "" : "s"} from boards.`);

if (data[0]) {
  console.log({ id: data[0].id, name: data[0].name, user_id: data[0].user_id });
}
