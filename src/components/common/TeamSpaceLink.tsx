import { useTranslation } from "@/lib/i18n";
import './TeamSpaceLink.css'

export default function TeamSpaceLink({ variant = 'button', className = '', edition = 1 }: { variant?: 'button' | 'navigation' | 'auth'; className?: string; edition?: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const title = edition === 1 ? t("3D 팀 스페이스") : t("3D 팀 스페이스 - {{edition}}", { edition })
  const href = edition === 1 ? '/?preview=agents' : `/?preview=agents-${edition}`
  return <a className={`team-space-link team-space-link-${variant} team-space-link-edition-${edition} ${className}`} href={href} aria-label={t("{{title}} 열기", { title })} title={title}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{edition === 3 ? <><circle cx="5" cy="12" r="3" /><circle cx="18" cy="5" r="3" /><circle cx="18" cy="19" r="3" /><path d="m7.7 10.5 7.6-4M7.7 13.5l7.6 4M18 8v8" /></> : edition === 2 ? <><ellipse cx="10" cy="11" rx="8" ry="4" transform="rotate(-35 10 11)" /><circle cx="10" cy="11" r="3" /><path d="M17 16a2 2 0 0 1 4 0c0 1.5-4 2.3-4 4h4" /></> : <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></>}</svg>
    <span>{title}</span>
  </a>
}
