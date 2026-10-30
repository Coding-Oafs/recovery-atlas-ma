import Link from "next/link";
import { AccountPanel } from "@/components/account-panel";
export const metadata = {
  title: "Your private account · Recovery Atlas",
  robots: { index: false, follow: false },
};
export default function AccountPage() {
  return (
    <main className="account-page">
      <Link className="text-link" href="/">
        ← Explore Recovery Atlas
      </Link>
      <h1>Your Recovery Atlas account</h1>
      <AccountPanel />
    </main>
  );
}
