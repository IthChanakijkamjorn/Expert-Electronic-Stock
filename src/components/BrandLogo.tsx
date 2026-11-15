export function BrandLogo({ name, url, size = 48 }: { name: string; url?: string; size?: number }) {
  const box = { width: size, height: size };
  if (url) {
    return (
      <span style={box} className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#ece8f2] bg-white p-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
      </span>
    );
  }
  return (
    <span style={box} className="flex shrink-0 items-center justify-center rounded-2xl bg-navy font-serif text-xl text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
