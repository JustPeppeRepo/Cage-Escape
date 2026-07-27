const MAX_DIFFICULTY_LEVEL = 5;

type StarRatingProps = {
  level: number;
};

export function StarRating({ level }: StarRatingProps) {
  const clampedLevel = Math.min(Math.max(level, 0), MAX_DIFFICULTY_LEVEL);

  return (
    <div
      role="img"
      aria-label={`Difficoltà: ${clampedLevel} su ${MAX_DIFFICULTY_LEVEL}`}
      className="flex items-center gap-1 text-xl leading-none"
    >
      {Array.from({ length: MAX_DIFFICULTY_LEVEL }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={
            index < clampedLevel
              ? "text-blood-bright"
              : "text-void-mist"
          }
        >
          ★
        </span>
      ))}
    </div>
  );
}
