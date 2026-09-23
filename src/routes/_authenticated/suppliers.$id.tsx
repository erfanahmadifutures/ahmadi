import { createFileRoute } from "@tanstack/react-router";
import { PartyDetail } from "@/components/party-page";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  head: () => ({
    meta: [
      { title: "پرونده تأمین‌کننده — احمدی" },
      { name: "description", content: "دفتر معین تأمین‌کننده، فاکتورهای تأمین و مرجوعی." },
      { property: "og:title", content: "پرونده تأمین‌کننده — احمدی" },
      { property: "og:description", content: "دفتر معین و تاریخچه فاکتورهای تأمین‌کننده." },
    ],
  }),
  component: SupplierDetail,
});

function SupplierDetail() {
  const { id } = Route.useParams();
  return <PartyDetail table="suppliers" id={id} />;
}
