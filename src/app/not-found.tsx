import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>This path ends here.</h1>
      <p>Let’s get you back to finding support.</p>
      <Link className="primary" href="/">
        Explore resources
      </Link>
    </main>
  );
}
