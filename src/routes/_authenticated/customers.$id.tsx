import { createFileRoute } from "@tanstack/react-router";
import { PartyDetail } from "@/components/party-page";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({
    meta: [
      { title: "پرونده مشتری — احمدی" },
      { name: "description", content: "دفتر معین مشتری، فاکتورهای فروش و مرجوعی." },
      { property: "og:title", content: "پرونده مشتری — احمدی" },
      { property: "og:description", content: "دفتر معین و تاریخچه فاکتورهای مشتری." },
    ],
  }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  return <PartyDetail table="customers" id={id} />;
}
