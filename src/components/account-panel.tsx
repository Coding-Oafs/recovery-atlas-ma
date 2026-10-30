"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { publicSiteUrl } from "@/lib/site";
import { useSaved } from "./saved-provider";
import SavedActions from "./saved-actions";
import Modal from "./modal";
import { UserRound, KeyRound } from "lucide-react";
type Mode = "sign-in" | "create" | "recover";
export function AccountPanel() {
  const { user, guestSaved, loading, importGuest, refresh, syncing } =
    useSaved();
  const [mode, setMode] = useState<Mode>("sign-in"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [code, setCode] = useState(""),
    [keys, setKeys] = useState<{ id: string; name?: string | null }[]>([]),
    [origin, setOrigin] = useState(""),
    [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => setOrigin(location.origin), []);
  const canonical =
    !!origin &&
    [
      "recovery-atlas-ma-coding-oafs-projects.vercel.app",
      "recovery-atlas-ne.vercel.app",
    ].includes(new URL(origin).hostname);
  async function loadKeys() {
    const r = await authClient.passkey.listUserPasskeys();
    if (r.data) setKeys(r.data);
  }
  useEffect(() => {
    if (!user) setCode("");
    setMessage("");
    setDeleteConfirm(false);
    if (user) void loadKeys();
  }, [user?.id]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      username = String(form.get("username")).trim().toLowerCase(),
      password = String(form.get("password"));
    await run(async () => {
      if (mode === "recover") {
        const r = await fetch("/api/me/recovery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              password,
              code: String(form.get("code")).trim(),
            }),
          }),
          body = await r.json();
        if (!r.ok) throw Error(body.error);
        setMode("sign-in");
        setMessage(
          "Password changed. Sign in with your new password, then create a new recovery code and passkey. Other devices have been signed out.",
        );
        return;
      }
      const result =
        mode === "create"
          ? await authClient.signUp.email({
              email: "unused@accounts.invalid",
              name: username,
              username,
              password,
            })
          : await authClient.signIn.username({ username, password });
      if (result.error)
        throw Error(result.error.message ?? "Could not sign in.");
      await authClient.getSession({ query: { disableCookieCache: true } });
      await refresh();
      if (mode === "create") await generateCode();
    });
  }
  async function generateCode() {
    const r = await fetch("/api/me/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      }),
      data = await r.json();
    if (!r.ok) throw Error(data.error);
    setCode(data.code);
  }
  function downloadCode() {
    const url = URL.createObjectURL(
      new Blob(
        [
          `Recovery Atlas account recovery\n\nUsername: ${user?.name}\nRecovery code: ${code}\n\nSign in at ${publicSiteUrl}/account\nKeep this code private and separate from your password. It can reset your password once. Generating another code invalidates this one.\n`,
        ],
        { type: "text/plain" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-atlas-recovery-code.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  if (canonical)
    return (
      <div className="stack">
        <p>
          Your account uses our shorter address,{" "}
          <strong>recoveryatlas.vercel.app</strong>.
        </p>
        <a
          className="primary"
          href={
            publicSiteUrl +
            "/account" +
            (guestSaved.length
              ? "#import-saves=" +
                encodeURIComponent(JSON.stringify(guestSaved))
              : "")
          }
        >
          {guestSaved.length
            ? "Bring browser saves and continue"
            : "Continue to your account"}
        </a>
        <p className="small muted">
          The shorter address keeps sign-in and passkeys consistent across
          devices. Browser saves can be copied into your account after signing
          in.
        </p>
      </div>
    );
  return (
    <div className="account-panel stack">
      {user ? (
        <>
          <p>
            Signed in as <strong>{user.name}</strong>. Your saved list is
            private.
          </p>
          {guestSaved.length ? (
            <div className="notice">
              <p>
                You have {guestSaved.length} browser-only saves. Copy them into
                this account when you’re ready.
              </p>
              <button
                className="secondary"
                disabled={busy || loading || syncing}
                onClick={() =>
                  run(async () => {
                    await importGuest();
                    setMessage(
                      "Browser saves copied to your account. Existing account saves were preserved.",
                    );
                  })
                }
              >
                Copy browser saves to account
              </button>
            </div>
          ) : null}
          <SavedActions />
          <div className="account-section">
            <h3>Easy sign-in with a passkey</h3>
            <p>
              Use your fingerprint, Face ID, device PIN or security key. Your
              device keeps the private key. You can still use your username and
              password.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await authClient.passkey.addPasskey({
                    name: "Recovery Atlas passkey",
                  });
                  if (r.error)
                    throw Error(
                      r.error.message ?? "Passkey setup was cancelled.",
                    );
                  await loadKeys();
                  setMessage(
                    "Passkey added. You can use it next time you sign in.",
                  );
                })
              }
            >
              <KeyRound size={15} />
              Add a passkey
            </button>
            {keys.length ? (
              <ul className="passkey-list">
                {keys.map((k) => (
                  <li key={k.id}>
                    <span>{k.name || "Passkey"}</span>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const r = await authClient.passkey.deletePasskey({
                            id: k.id,
                          });
                          if (r.error) throw Error(r.error.message);
                          await loadKeys();
                          setMessage("Passkey removed.");
                        })
                      }
                    >
                      Remove passkey
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="account-section">
            <h3>Keep a recovery code</h3>
            <p>
              If you forget your password, this code lets you recover your
              account. We don’t collect an email address, so there is no email
              reset.
            </p>
            {code ? (
              <>
                <p className="notice">
                  Save this code now. It is shown only here, and creating
                  another code replaces it.
                </p>
                <output
                  className="recovery-code"
                  aria-label="Your recovery code"
                >
                  {code}
                </output>
                <button className="secondary" onClick={downloadCode}>
                  Download recovery code
                </button>
              </>
            ) : (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => run(generateCode)}
              >
                Create / replace recovery code
              </button>
            )}
          </div>
          <details className="account-section">
            <summary>Change password</summary>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const r = await authClient.changePassword({
                    currentPassword: String(f.get("currentPassword")),
                    newPassword: String(f.get("newPassword")),
                    revokeOtherSessions: true,
                  });
                  if (r.error) throw Error(r.error.message);
                  setMessage(
                    "Password changed. Other sessions were signed out.",
                  );
                });
              }}
            >
              <label>
                Current password
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
              <label>
                New password
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={15}
                  maxLength={128}
                />
              </label>
              <button className="secondary" disabled={busy}>
                Change password
              </button>
            </form>
          </details>
          <button
            className="secondary"
            disabled={busy || syncing}
            onClick={() =>
              run(async () => {
                const r = await authClient.signOut();
                if (r.error) throw Error(r.error.message);
                setCode("");
                setMode("sign-in");
                setMessage(
                  "Signed out. Account saves stay private and are available when you sign in again.",
                );
              })
            }
          >
            Sign out
          </button>
          <details className="account-section">
            <summary>Delete account</summary>
            <p>
              This permanently removes this account, its saved list, passkeys
              and recovery code. Browser-only saves are separate. Download your
              saved list first if you want to keep a copy.
            </p>
            {!deleteConfirm ? (
              <button
                className="text-link"
                onClick={() => setDeleteConfirm(true)}
              >
                Delete my account…
              </button>
            ) : (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const r = await authClient.deleteUser({
                      password: String(f.get("password")),
                    });
                    if (r.error) throw Error(r.error.message);
                    setMessage("Account deleted.");
                  });
                }}
              >
                <label>
                  Confirm your password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  Permanently delete my account
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </button>
              </form>
            )}
          </details>
        </>
      ) : (
        <>
          <p>
            Keep your saved meetings and resources available across devices.
            Choose a private username; no real name or email is needed.
          </p>
          <div className="account-tabs">
            {(["sign-in", "create", "recover"] as const).map((m) => (
              <button
                className={mode === m ? "active" : ""}
                key={m}
                onClick={() => {
                  setMode(m);
                  setMessage("");
                }}
              >
                {m === "sign-in"
                  ? "Sign in"
                  : m === "create"
                    ? "Create account"
                    : "Recover account"}
              </button>
            ))}
          </div>
          {mode === "sign-in" ? (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await authClient.signIn.passkey();
                  if (r.error)
                    throw Error(
                      r.error.message ??
                        "No passkey was selected. You can sign in with your username and password.",
                    );
                  await authClient.getSession();
                })
              }
            >
              <KeyRound size={15} />
              Sign in with a passkey
            </button>
          ) : null}
          <form className="stack" onSubmit={submit}>
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
              />
            </label>
            {mode === "recover" ? (
              <>
                <label>
                  Recovery code
                  <input
                    name="code"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                  />
                </label>
                <p className="small muted">
                  Recovery signs out all devices and removes existing passkeys.
                  Add a new passkey after signing in.
                </p>
              </>
            ) : null}
            <label>
              {mode === "recover" ? "New password" : "Password"}
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "sign-in" ? 1 : 15}
                maxLength={128}
              />
            </label>
            {mode !== "sign-in" ? (
              <p className="small muted">
                Use at least 15 characters. A few unrelated words can be easier
                to remember. Keep your recovery code somewhere safe.
              </p>
            ) : null}
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "create"
                  ? "Create my private account"
                  : mode === "recover"
                    ? "Recover my account"
                    : "Sign in"}
            </button>
          </form>
        </>
      )}
      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
export default function AccountButton() {
  const [open, setOpen] = useState(false);
  const { user } = useSaved();
  return (
    <>
      <button className="account-nav" onClick={() => setOpen(true)}>
        <UserRound size={16} />
        {user ? "Your account" : "Sign in"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Your Recovery Atlas account"
      >
        <AccountPanel />
      </Modal>
    </>
  );
}
