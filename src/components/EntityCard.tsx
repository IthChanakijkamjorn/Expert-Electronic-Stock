import Link from "next/link";

export function EntityCard({
  href,
  title,
  subtitle,
  imageUrl,
}: {
  href: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}) {
  return (
    <Link
      href={href}
      className="group card-link overflow-hidden !p-0"
    >
      <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-navy to-[#000066]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-5xl text-white/70">
            {title.trim().charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="flex items-center justify-between font-semibold text-navy">
          {title}
          <span className="transition group-hover:translate-x-1">→</span>
        </h3>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
    </Link>
  );
}
