type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
};

export function SectionHeading({ eyebrow, title }: SectionHeadingProps) {
  return (
    <div className="mb-10 flex flex-col items-center gap-2 text-center">
      {eyebrow ? (
        <span className="text-xs uppercase tracking-[0.3em] text-ectoplasm/80">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="relative font-heading text-3xl text-blood-bright sm:text-4xl">
        {title}
        <span
          aria-hidden="true"
          className="absolute -bottom-2 left-1/2 h-[2px] w-24 -translate-x-1/2 bg-blood"
        />
      </h2>
    </div>
  );
}
