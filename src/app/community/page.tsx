import Link from "next/link";
import CommunityHub from "@/components/community-hub";
export const metadata = {
  title: "Your community � Recovery Atlas",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="community-page">
      <Link className="text-link" href="/">
        ? Explore Recovery Atlas
      </Link>
      <CommunityHub />
    </main>
  );
}
