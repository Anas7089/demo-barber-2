import { redirect } from "next/navigation";
import { business } from "@/config/business";

export default function RootPage() {
  redirect(`/${business.defaultLocale}`);
}
