const MAX_TERROR_LEVEL = 5;

type SkullRatingProps = {
  level: number;
};

export function SkullRating({ level }: SkullRatingProps) {
  const clampedLevel = Math.min(Math.max(level, 0), MAX_TERROR_LEVEL);

  return (
    <div
      role="img"
      aria-label={`Livello di terrore: ${clampedLevel} su ${MAX_TERROR_LEVEL}`}
      className="flex items-center gap-1"
    >
      {Array.from({ length: MAX_TERROR_LEVEL }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={
            index < clampedLevel
              ? "text-blood-bright"
              : "text-void-mist"
          }
        >
          💀
        </span>
      ))}
    </div>
  );
}
