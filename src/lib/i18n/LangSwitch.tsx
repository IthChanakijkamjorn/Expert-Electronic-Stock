import { setLang } from "./actions";
import type { Lang } from "./dictionaries";

export function LangSwitch({ current }: { current: Lang }) {
  return (
    <div className="flex gap-1 text-sm">
      {(["th", "en"] as const).map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button
            className={`rounded px-2 py-1 ${
              current === l
                ? "bg-zinc-900 text-white"
                : "bg-zinc-200 text-zinc-800"
            }`}
          >
            {l === "th" ? "ไทย" : "EN"}
          </button>
        </form>
      ))}
    </div>
  );
}
