import { business } from "@/config/business";

export function money(cents: number, locale = "en-GB") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: business.currency }).format(cents / 100);
}

export function percent(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(value);
}
