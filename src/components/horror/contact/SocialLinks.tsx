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
    case "whatsapp":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={iconClassName}
          fill="currentColor"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
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
