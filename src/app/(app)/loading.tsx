export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="skeleton h-9 w-56" />
      <div className="skeleton h-40 !rounded-3xl" />
      <div className="skeleton h-24 !rounded-3xl opacity-70" />
    </div>
  );
}
