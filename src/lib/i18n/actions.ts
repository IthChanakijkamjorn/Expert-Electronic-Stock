"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANGS, type Lang } from "./dictionaries";

export async function setLang(lang: Lang) {
  if (!LANGS.includes(lang)) return;
  (await cookies()).set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
