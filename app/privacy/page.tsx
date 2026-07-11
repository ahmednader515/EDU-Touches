import { getHomepageSettings } from "@/lib/db";
import { fillMessage } from "@/lib/i18n/interpolate";
import { pickLocalizedText } from "@/lib/i18n/localized-field";
import { getLocaleFromCookie, getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getServerTranslator();
  return {
    title: `${t("privacy.title", "Privacy Policy")} | ${t("footer.defaultTitle", "My Learning Platform")}`,
    description: t(
      "privacy.intro",
      "How we collect, use, and protect your personal information on our educational platform."
    ).replace("{platform}", t("footer.defaultTitle", "My Learning Platform")),
  };
}

const SECTIONS = [
  ["s1Title", "s1Body"],
  ["s2Title", "s2Body"],
  ["s3Title", "s3Body"],
  ["s4Title", "s4Body"],
  ["s5Title", "s5Body"],
  ["s6Title", "s6Body"],
  ["s7Title", "s7Body"],
  ["s8Title", "s8Body"],
  ["s9Title", "s9Body"],
  ["s10Title", "s10Body"],
] as const;

export default async function PrivacyPage() {
  const [t, locale] = await Promise.all([getServerTranslator(), getLocaleFromCookie()]);
  const settings = await getHomepageSettings().catch(() => null);

  const platformName =
    pickLocalizedText(locale, settings?.platformName ?? null, settings?.platformNameEn ?? null)?.trim() ||
    t("footer.defaultTitle", "My Learning Platform");

  const whatsappUrl =
    settings?.whatsappUrl?.trim() ||
    settings?.teamWhatsappUrl?.trim() ||
    null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--color-foreground)]">
          {t("privacy.title", "Privacy Policy")}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {t("privacy.lastUpdated", "Last updated: July 12, 2026")}
        </p>
      </header>

      <div className="space-y-8 leading-relaxed text-[var(--color-foreground)]">
        <p className="text-[var(--color-muted)]">
          {fillMessage(t("privacy.intro", "This Privacy Policy explains how {platform} collects, uses, and protects your personal information."), {
            platform: platformName,
          })}
        </p>

        {SECTIONS.map(([titleKey, bodyKey]) => (
          <section key={titleKey}>
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
              {t(`privacy.${titleKey}`)}
            </h2>
            <p className="mt-2 text-[var(--color-muted)]">{t(`privacy.${bodyKey}`)}</p>
          </section>
        ))}

        {whatsappUrl ? (
          <p className="pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {t("privacy.contactWhatsApp", "Contact via WhatsApp")}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
