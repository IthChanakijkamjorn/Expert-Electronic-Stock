import { createClient } from "@/lib/supabase/server";

export async function signedUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (!list.length) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("files").createSignedUrls(list, 3600);
  data?.forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
  return urls;
}
