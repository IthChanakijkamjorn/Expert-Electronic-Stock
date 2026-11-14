import { setLang } from "./actions";
import type { Lang } from "./dictionaries";

export function LangSwitch({ current, dark = true }: { current: Lang; dark?: boolean }) {
  return (
    <div
      className={`flex gap-1 rounded-full p-1 text-xs font-semibold ${
        dark ? "bg-white/10" : "bg-navy/10"
      }`}
    >
      {(["th", "en"] as const).map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button
            className={`rounded-full px-3 py-1 tracking-widest ${
              current === l
                ? dark
                  ? "bg-white text-navy"
                  : "bg-navy text-white"
                : dark
                  ? "text-white/70"
                  : "text-navy/70"
            }`}
          >
            {l === "th" ? "TH" : "EN"}
          </button>
        </form>
      ))}
    </div>
  );
}
