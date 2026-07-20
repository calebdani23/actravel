import Image from "next/image";
import Link from "next/link";
import { type Locale } from "@/lib/i18n/config";

export function BrandMark({ locale }: Readonly<{ locale: Locale }>) {
  return (
    <Link href={`/${locale}`} className="group inline-flex items-center" aria-label="AC Travel home">
      <span className="overflow-hidden rounded-2xl bg-white/80 px-3 py-2 shadow-sm shadow-orange-900/10 transition-transform group-hover:scale-[1.02]">
        <Image
          src="/brand/ac-travel-logo-original-500x135.png"
          alt="AC Travel"
          width={500}
          height={135}
          className="h-9 w-auto object-contain sm:h-10"
        />
      </span>
    </Link>
  );
}
