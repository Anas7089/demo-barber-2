export const business = {
  name: process.env.NEXT_PUBLIC_SHOP_NAME ?? "Atelier 27 Barbers",
  country: process.env.NEXT_PUBLIC_SHOP_COUNTRY ?? "DE",
  currency: process.env.NEXT_PUBLIC_SHOP_CURRENCY ?? "EUR",
  timezone: process.env.NEXT_PUBLIC_SHOP_TIMEZONE ?? "Europe/Berlin",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "de",
  supportedLocales: (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "de,en")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean)
} as const;
