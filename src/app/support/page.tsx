import Link from "next/link";
import SupportHub from "@/components/support-hub";
export const metadata = {
  title: "Support for daily life · Recovery Atlas",
  description:
    "Explore official recovery housing, family, peer, employment and practical support resources.",
};
export default function Page() {
  return (
    <main className="community-page">
      <Link className="text-link" href="/">
        ← Explore Recovery Atlas
      </Link>
      <SupportHub />
    </main>
  );
}
