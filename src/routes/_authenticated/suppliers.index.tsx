import { createFileRoute } from "@tanstack/react-router";
import { PartyList } from "@/components/party-page";

export const Route = createFileRoute("/_authenticated/suppliers/")({
  head: () => ({
    meta: [
      { title: "تأمین‌کنندگان — احمدی" },
      { name: "description", content: "پرونده تأمین‌کنندگان، دفتر معین و مانده حساب." },
      { property: "og:title", content: "تأمین‌کنندگان — احمدی" },
      { property: "og:description", content: "مدیریت تأمین‌کنندگان قطعات و مانده حساب آن‌ها." },
    ],
  }),
  component: () => <PartyList table="suppliers" />,
});
