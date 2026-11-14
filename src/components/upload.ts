import { createClient } from "@/lib/supabase/client";

// Storage keys stay ASCII (uuid + extension); the original name is kept in the database.
export async function uploadToStorage(prefix: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const path = `${prefix}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { error } = await createClient()
    .storage.from("files")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}
