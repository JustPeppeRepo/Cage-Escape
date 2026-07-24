type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  /** Default h2: usa h1 solo come titolo principale di pagina (es. /rooms). */
  as?: "h1" | "h2";
};

export function SectionHeading({
  eyebrow,
  title,
  as: Tag = "h2",
}: SectionHeadingProps) {
  return (
    <div className="mb-10 flex flex-col items-center gap-2 text-center">
      {eyebrow ? (
        <span className="text-xs uppercase tracking-[0.3em] text-ectoplasm/80">
          {eyebrow}
        </span>
      ) : null}
      <Tag className="relative font-heading text-3xl text-blood-bright sm:text-4xl">
        {title}
        <span
          aria-hidden="true"
          className="absolute -bottom-2 left-1/2 h-[2px] w-24 -translate-x-1/2 bg-blood"
        />
      </Tag>
    </div>
  );
}
