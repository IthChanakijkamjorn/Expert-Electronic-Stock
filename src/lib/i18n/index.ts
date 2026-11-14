import { cookies } from "next/headers";
import {
  DEFAULT_LANG,
  LANGS,
  dictionaries,
  type Dictionary,
  type Lang,
} from "./dictionaries";

export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get("lang")?.value;
  return LANGS.includes(value as Lang) ? (value as Lang) : DEFAULT_LANG;
}

export async function getDictionary(): Promise<{ lang: Lang; t: Dictionary }> {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
