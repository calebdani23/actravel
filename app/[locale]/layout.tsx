import { notFound } from "next/navigation";
import Script from "next/script";
import { getMetaPixelId } from "@/lib/analytics/meta-pixel";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { PublicShell } from "@/components/public/public-shell";
import { isLocale, type Locale } from "@/lib/i18n/config";

export function generateStaticParams() {
  return [{ locale: "es" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const metaPixelId = getMetaPixelId();

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <>
      {metaPixelId ? (
        <>
          <Script
            id="meta-pixel-base"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');`,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}
      <LocaleHtmlLang />
      <PublicShell locale={locale as Locale}>{children}</PublicShell>
    </>
  );
}
