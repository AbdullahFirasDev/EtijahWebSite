import type { ComponentType, SVGProps } from "react";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/ui/icons";
import { site, type SocialNetwork } from "@/content/site";
import type { Dictionary } from "@/content/types";

const NETWORKS: { id: SocialNetwork; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "instagram", Icon: InstagramIcon },
  { id: "tiktok", Icon: TikTokIcon },
  { id: "facebook", Icon: FacebookIcon },
];

const TONES = {
  light:
    "border-brand-100 bg-white text-brand-700 hover:border-brand-600 hover:bg-brand-600 hover:text-white focus-visible:border-brand-600",
  dark: "border-white/20 text-white/80 hover:border-accent-500 hover:bg-accent-500 hover:text-brand-950",
} as const;

interface SocialLinksProps {
  dict: Dictionary;
  tone?: keyof typeof TONES;
  className?: string;
  /** id of a visible heading that names the list; falls back to an aria-label. */
  labelledBy?: string;
}

/** Instagram, TikTok and Facebook as round icon buttons. */
export function SocialLinks({ dict, tone = "light", className, labelledBy }: SocialLinksProps) {
  return (
    <ul
      role="list"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : dict.social.title}
      className={`flex items-center gap-2.5 ${className ?? ""}`}
    >
      {NETWORKS.map(({ id, Icon }) => (
        <li key={id}>
          <a
            href={site.social[id]}
            target="_blank"
            rel="noopener noreferrer"
            className={`grid size-11 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-300 ease-out-expo motion-safe:hover:-translate-y-0.5 ${TONES[tone]}`}
          >
            <Icon className="size-5" />
            <span className="sr-only">
              {dict.social[id]} {dict.general.opensInNewTab}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
