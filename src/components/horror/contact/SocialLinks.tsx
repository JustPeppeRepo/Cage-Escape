import {
  SOCIAL_LINKS,
  type SocialLinkId,
} from "@/app/_lib/site/social";

const iconClassName = "h-5 w-5";

function SocialIcon({ id }: { id: SocialLinkId }) {
  switch (id) {
    case "instagram":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={iconClassName}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
          <circle cx="12" cy="12" r="4.25" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={iconClassName}
          fill="currentColor"
        >
          <path d="M14 8.5V6.8c0-.8.1-1.2 1.1-1.2H17V3h-2.4C11.9 3 11 4.7 11 7.1V8.5H8v2.8h3V21h3v-9.7h2.6l.4-2.8H14z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={iconClassName}
          fill="currentColor"
        >
          <path d="M16.6 5.82a4.62 4.62 0 0 1 1.4-.23V9.1a7.28 7.28 0 0 1-1.4-.14V5.82zM14.2 4.5h-2.8v11.05a2.65 2.65 0 1 1-2.65-2.65c.18 0 .36.02.53.06v-2.83a5.48 5.48 0 0 0-.53-.03 5.48 5.48 0 1 0 5.48 5.48V9.03a8.18 8.18 0 0 0 4.77 1.52V7.75a4.62 4.62 0 0 1-4.77-3.25z" />
        </svg>
      );
  }
}

export function SocialLinks() {
  return (
    <div className="mt-10">
      <p className="text-sm text-bone/80">Seguici nel buio</p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {SOCIAL_LINKS.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              className="inline-flex h-11 w-11 items-center justify-center rounded border border-void-mist bg-void-deep text-bone/70 transition-colors hover:border-blood/50 hover:text-bone"
            >
              <SocialIcon id={link.id} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
