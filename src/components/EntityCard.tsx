import Link from "next/link";

export function EntityCard({
  href,
  title,
  subtitle,
  imageUrl,
  editing,
  actions,
}: {
  href: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  editing?: boolean;
  actions?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="aspect-[16/9] overflow-hidden rounded-t-3xl bg-gradient-to-br from-navy to-[#000066]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" draggable={false} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-5xl text-white/70">
            {title.trim().charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="flex items-center justify-between font-semibold text-navy">
          {title}
          <span className="arrow-chip">{editing ? "⠿" : "→"}</span>
        </h3>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        {editing && actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </>
  );
  const cls = "group card card-link !p-0";
  return editing ? (
    <div className={`${cls} cursor-grab active:cursor-grabbing`}>{body}</div>
  ) : (
    <Link href={href} className={cls}>{body}</Link>
  );
}
