"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Let’s try that again.</h1>
      <p>
        The directory couldn’t load. You can still reach the Massachusetts
        Substance Use Helpline at <a href="tel:8003275050">800-327-5050</a>.
      </p>
      <button className="primary" onClick={reset}>
        Retry the directory
      </button>
    </main>
  );
}
