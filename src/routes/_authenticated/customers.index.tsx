import { createFileRoute } from "@tanstack/react-router";
import { PartyList } from "@/components/party-page";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "مشتریان — احمدی" },
      { name: "description", content: "پرونده مشتریان، دفتر معین و مانده بدهی." },
      { property: "og:title", content: "مشتریان — احمدی" },
      { property: "og:description", content: "مدیریت مشتریان و مانده حساب آن‌ها در پنل احمدی." },
    ],
  }),
  component: () => <PartyList table="customers" />,
});
