import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const page = (title: string, body: string, status: number) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:sans-serif;background:#faf7f0;color:#00004d;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center"><div><h1>${title}</h1><p>${body}</p></div>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase.rpc("resolve_share", { p_token: token });
  const share = data?.[0];
  if (!share) {
    return page(
      "Link expired / ลิงก์หมดอายุ",
      "This link is invalid, expired or revoked. Please contact Expert Electronic &amp; Communication.",
      404,
    );
  }
  const { data: signed } = await supabase.storage
    .from("files")
    .createSignedUrl(
      share.storage_path,
      120,
      new URL(req.url).searchParams.has("download") ? { download: share.file_name } : undefined,
    );
  if (!signed?.signedUrl) return page("File not found / ไม่พบไฟล์", "The file is no longer available.", 404);
  const res = NextResponse.redirect(signed.signedUrl);
  res.headers.set("cache-control", "no-store");
  res.headers.set("referrer-policy", "no-referrer");
  return res;
}
