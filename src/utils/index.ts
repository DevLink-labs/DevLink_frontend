import { getLocale, t } from "@/lib/i18n";

export async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error(t("복사를 지원하지 않는 환경입니다. 내용을 선택해 직접 복사해주세요."))
  await navigator.clipboard.writeText(value)
}

export function formatDate(value: string | null, locale = getLocale()): string {
  if (!value) return t("기록 없음", { lng: locale })
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t("기록 없음", { lng: locale })
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
