import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import accounts from "./locales/en/accounts.json" with { type: "json" };
import scene from "./locales/en/scene.json" with { type: "json" };
import tasks from "./locales/en/tasks.json" with { type: "json" };
import workspace from "./locales/en/workspace.json" with { type: "json" };

export { useTranslation } from "react-i18next";

const storageKey = "devlink:language";

function initialLanguage() {
  const browserLanguage = typeof navigator !== "undefined" && navigator.language?.startsWith("en")
    ? "en"
    : "ko";
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "ko" || saved === "en") return saved;
  } catch {
    return browserLanguage;
  }
  return browserLanguage;
}

void i18next.use(initReactI18next).init({
  lng: initialLanguage(),
  fallbackLng: "ko",
  supportedLngs: ["ko", "en"],
  load: "languageOnly",
  resources: {
    ko: { translation: {} },
    en: { translation: { ...accounts, ...scene, ...tasks, ...workspace } },
  },
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  returnEmptyString: true,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function updateDocumentLanguage(language) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language.startsWith("en") ? "en" : "ko";
  }
}

i18next.on("languageChanged", updateDocumentLanguage);
updateDocumentLanguage(i18next.language);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey && (event.newValue === "ko" || event.newValue === "en")) {
      void i18next.changeLanguage(event.newValue);
    }
  });
}

export const t = i18next.t.bind(i18next);

export function getLocale(language = i18next.resolvedLanguage ?? i18next.language) {
  return language.startsWith("en") ? "en-US" : "ko-KR";
}

export async function setLanguage(language) {
  if (language !== "ko" && language !== "en") return;
  await i18next.changeLanguage(language);
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    return;
  }
}
