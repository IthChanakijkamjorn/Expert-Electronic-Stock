export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-zinc-200" />
      <div className="h-40 animate-pulse rounded-3xl bg-zinc-200/70" />
    </div>
  );
}
