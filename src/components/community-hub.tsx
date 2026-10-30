"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSaved } from "./saved-provider";
type Profile = {
  handle: string;
  display_name: string;
  bio: string;
  region: string;
  languages: string[];
  discoverable: boolean;
  accepts_requests: boolean;
  adult_confirmed: boolean;
  guidelines_at: string | null;
};
type Person = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  region: string;
  languages: string[];
  acceptsRequests: boolean;
};
type Thread = {
  id: string;
  status: string;
  outgoing: boolean;
  displayName: string;
  handle: string;
  peerId: string;
  blocked: boolean;
  unread?: number;
};
type Message = { id: string; mine: boolean; body: string; createdAt: string };
async function api(path: string, body?: unknown) {
  const response = await fetch("/api/community/" + path, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? "Please try again.");
  return data;
}
export default function CommunityHub() {
  const { user, loading } = useSaved(),
    [loadedFor, setLoadedFor] = useState(""),
    [isModerator, setIsModerator] = useState(false),
    [tab, setTab] = useState("profile"),
    [profile, setProfile] = useState<Profile | null>(null),
    [people, setPeople] = useState<Person[]>([]),
    [threads, setThreads] = useState<Thread[]>([]),
    [selected, setSelected] = useState<Thread | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [older, setOlder] = useState<string | null>(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [blocked, setBlocked] = useState<Person[]>([]),
    [report, setReport] = useState<Message | null>(null),
    [contact, setContact] = useState<Person | null>(null),
    [confirmBlock, setConfirmBlock] = useState(false),
    [threadLoaded, setThreadLoaded] = useState(false);
  const selectedRef = useRef(selected),
    lastActive = useRef(Date.now()),
    tabRef = useRef(tab),
    activeUserRef = useRef(user?.id),
    messageCursors = useRef(new Map<string, string>()),
    messageLoads = useRef(new Set<string>());
  tabRef.current = tab;
  activeUserRef.current = user?.id;
  selectedRef.current = selected;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    lastActive.current = Date.now();
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const loadThreads = useCallback(async () => {
    const owner = activeUserRef.current;
    const data = await api("conversations");
    if (owner === activeUserRef.current) setThreads(data.conversations);
  }, []);
  const loadMessages = useCallback(async (thread: Thread, before?: string) => {
    if (messageLoads.current.has(thread.id)) return;
    messageLoads.current.add(thread.id);
    try {
      let cursor = before ? undefined : messageCursors.current.get(thread.id);
      do {
        const data = await api(
          "conversations/" +
            thread.id +
            (before ? "?before=" + before : cursor ? "?after=" + cursor : ""),
        );
        if (selectedRef.current?.id !== thread.id) return;
        setMessages((previous) => {
          const map = new Map(previous.map((m) => [m.id, m]));
          for (const m of data.messages) map.set(m.id, m);
          return [...map.values()].sort((a, b) =>
            BigInt(a.id) < BigInt(b.id) ? -1 : 1,
          );
        });
        setStatus(data.status);
        setThreadLoaded(true);
        if (before || !cursor) setOlder(data.older);
        const last = data.messages.at(-1)?.id;
        if (!before && last) messageCursors.current.set(thread.id, last);
        if (
          last &&
          tabRef.current === "messages" &&
          document.visibilityState === "visible"
        ) {
          await api("conversations/" + thread.id, {
            action: "read",
            messageId: last,
          });
          setThreads((t) =>
            t.map((x) => (x.id === thread.id ? { ...x, unread: 0 } : x)),
          );
        }
        cursor = data.moreAfter;
      } while (cursor && !before);
    } finally {
      messageLoads.current.delete(thread.id);
    }
  }, []);
  useEffect(() => {
    setProfile(null);
    setThreads([]);
    setSelected(null);
    setMessages([]);
    setPeople([]);
    setBlocked([]);
    setContact(null);
    setIsModerator(false);
    setNotice("");
    setLoadedFor("");
    messageCursors.current.clear();
    if (!user) return;
    let active = true;
    void api("status")
      .then((d) => {
        if (active) setIsModerator(d.moderator);
      })
      .catch(() => {});
    api("profile")
      .then((d) => {
        if (active) setProfile(d.profile);
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      })
      .finally(() => {
        if (active) setLoadedFor(user.id);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user || !profile?.adult_confirmed || !profile.guidelines_at) return;
    void loadThreads().catch((e) => setNotice(e.message));
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastActive.current < 300000
      ) {
        void loadThreads().catch(() => {});
        if (selectedRef.current && tabRef.current === "messages")
          void loadMessages(selectedRef.current).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [
    user?.id,
    profile?.adult_confirmed,
    profile?.guidelines_at,
    loadThreads,
    loadMessages,
  ]);
  useEffect(() => {
    setMessages([]);
    if (selected) messageCursors.current.delete(selected.id);
    setOlder(null);
    setReport(null);
    setConfirmBlock(false);
    setThreadLoaded(false);
    if (selected)
      void loadMessages(selected).catch((e) => setNotice(e.message));
  }, [selected?.id, loadMessages]);
  if ((loading && !user) || (user && loadedFor !== user.id))
    return <p role="status">Checking sign-in�</p>;
  if (!user)
    return (
      <div className="stack">
        <h1>A place to connect</h1>
        <p>
          Create a private account to set up a profile and connect with other
          adults in the recovery community. Browsing resources is always
          available without an account.
        </p>
        <Link className="primary" href="/account">
          Sign in or create an account
        </Link>
        <CommunityGuidelines />
      </div>
    );
  const messaging = !!profile?.adult_confirmed && !!profile.guidelines_at;
  return (
    <div className="community-hub">
      <h1>Your community space</h1>
      {isModerator ? (
        <Link className="secondary" href="/moderation">
          Open moderation inbox
        </Link>
      ) : null}
      <p className="muted">
        Share only what feels right. Profiles are hidden until you choose
        otherwise.
      </p>
      <div
        className="account-tabs"
        role="navigation"
        aria-label="Community sections"
      >
        {[
          ["profile", "My profile"],
          ["people", "Find peers"],
          ["messages", "Messages"],
          ["safety", "Safety & privacy"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setNotice("");
              lastActive.current = Date.now();
              if (id === "safety")
                void api("safety")
                  .then((d) => setBlocked(d.blocked))
                  .catch((e) => setNotice(e.message));
            }}
          >
            {label}
            {id === "messages" && threads.some((t) => (t.unread ?? 0) > 0)
              ? " � unread"
              : ""}
            {id === "messages" &&
            threads.some((t) => t.status === "pending" && !t.outgoing)
              ? " � request"
              : ""}
          </button>
        ))}
      </div>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      {tab === "profile" ? (
        <form
          className="stack profile-form"
          key={profile?.handle ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const d = await api("profile", {
                displayName: String(f.get("displayName")),
                bio: String(f.get("bio")),
                region: String(f.get("region")),
                languages: String(f.get("languages"))
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                discoverable: f.get("discoverable") === "on",
                acceptsRequests: f.get("acceptsRequests") === "on",
                adultConfirmed: f.get("adultConfirmed") === "on",
                guidelinesAccepted: f.get("guidelines") === "on",
              });
              setProfile(d.profile);
              setNotice(
                "Profile saved. Your visibility choices are in effect.",
              );
            });
          }}
        >
          <p>
            Your handle: <strong>@{profile?.handle ?? user.name}</strong>. Use
            this when connecting with someone you know.
          </p>
          <label>
            Display name
            <input
              name="displayName"
              defaultValue={profile?.display_name ?? user.name}
              minLength={2}
              maxLength={60}
              required
              autoComplete="nickname"
            />
          </label>
          <label>
            A little about you (optional)
            <textarea
              name="bio"
              defaultValue={profile?.bio ?? ""}
              maxLength={500}
              rows={3}
            />
          </label>
          <p className="small muted">
            Avoid addresses, phone numbers, treatment records or anything you
            would not want another member to see.
          </p>
          <label>
            Broad region (optional)
            <input
              name="region"
              defaultValue={profile?.region ?? ""}
              maxLength={80}
              placeholder="For example, Greater Boston"
            />
          </label>
          <label>
            Languages, separated by commas
            <input
              name="languages"
              defaultValue={profile?.languages.join(", ") ?? "English"}
              maxLength={200}
              required
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              name="adultConfirmed"
              defaultChecked={profile?.adult_confirmed ?? false}
            />
            I am 18 or older. Peer messaging is for adults.
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              name="guidelines"
              defaultChecked={!!profile?.guidelines_at}
            />
            I agree to the community guidelines below.
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              name="discoverable"
              defaultChecked={profile?.discoverable ?? false}
            />
            Let signed-in adult members find my handle and profile.
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              name="acceptsRequests"
              defaultChecked={profile?.accepts_requests ?? false}
            />
            Accept new message requests. I choose which requests to accept.
          </label>
          <button className="primary" disabled={busy}>
            Save profile
          </button>
          <CommunityGuidelines />
        </form>
      ) : null}
      {tab === "people" ? (
        <section className="stack">
          <h2>Find someone by handle</h2>
          {!messaging ? (
            <p className="notice">
              Complete your profile�s adult confirmation and community
              guidelines before connecting.
            </p>
          ) : (
            <>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = String(new FormData(e.currentTarget).get("q"));
                  void run(async () => {
                    const data = await api("people?q=" + encodeURIComponent(q));
                    setPeople(data.people);
                    setNotice(
                      data.people.length
                        ? ""
                        : "No matching discoverable members. Ask your peer for their handle.",
                    );
                  });
                }}
              >
                <label>
                  Handle or its first letters
                  <input
                    name="q"
                    minLength={3}
                    maxLength={30}
                    required
                    autoComplete="off"
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  Find peers
                </button>
              </form>
              {people.map((p) => (
                <article className="peer-card" key={p.id}>
                  <h3>{p.displayName}</h3>
                  <p>
                    @{p.handle}
                    {p.region ? " � " + p.region : ""}
                  </p>
                  <p>{p.bio}</p>
                  <p className="muted">{p.languages.join(", ")}</p>
                  {p.acceptsRequests ? (
                    <button className="secondary" onClick={() => setContact(p)}>
                      Request a conversation
                    </button>
                  ) : (
                    <p className="small muted">Not accepting new requests</p>
                  )}
                </article>
              ))}
            </>
          )}
        </section>
      ) : null}
      {contact ? (
        <section className="peer-card stack">
          <h2>Introduce yourself to {contact.displayName}</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const intro = String(new FormData(e.currentTarget).get("intro"));
              void run(async () => {
                const d = await api("conversations", {
                  recipient: contact.id,
                  intro,
                });
                setSelected({
                  id: d.id,
                  status: d.status,
                  outgoing: true,
                  displayName: contact.displayName,
                  handle: contact.handle,
                  peerId: contact.id,
                  blocked: false,
                });
                setContact(null);
                setTab("messages");
                await loadThreads();
                setNotice(
                  "Request sent. You can continue after it is accepted.",
                );
              });
            }}
          >
            <label>
              Short introduction
              <textarea name="intro" maxLength={400} rows={3} required />
            </label>
            <p className="small muted">
              No links in first requests. Never send money or private documents
              to a peer.
            </p>
            <button className="primary" disabled={busy}>
              Send request
            </button>
            <button
              className="text-link"
              type="button"
              onClick={() => setContact(null)}
            >
              Cancel
            </button>
          </form>
        </section>
      ) : null}
      {tab === "messages" ? (
        <div className="message-layout">
          <aside>
            <h2>Conversations</h2>
            <button className="text-link" onClick={() => run(loadThreads)}>
              Refresh conversations
            </button>
            {!messaging ? (
              <p>Enable messaging in your profile first.</p>
            ) : !threads.length ? (
              <p>
                No conversations yet. Find a peer by handle to send a request.
              </p>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  className={
                    "thread-choice " + (selected?.id === t.id ? "active" : "")
                  }
                  onClick={() => {
                    setSelected(t);
                    lastActive.current = Date.now();
                  }}
                >
                  <strong>
                    {t.displayName}
                    {t.unread ? ` � ${t.unread} unread` : ""}
                  </strong>
                  <span>
                    @{t.handle} �{" "}
                    {t.blocked
                      ? "blocked"
                      : t.status === "pending"
                        ? t.outgoing
                          ? "request sent"
                          : "new request"
                        : t.status}
                  </span>
                </button>
              ))
            )}
          </aside>
          <section aria-label="Conversation">
            {selected ? (
              <>
                <h2>{selected.displayName}</h2>
                <p className="small muted">
                  @{selected.handle} � {status || selected.status}
                </p>
                {selected.blocked ? (
                  <p className="notice">
                    This conversation is blocked. Manage your own blocks in
                    Safety & privacy.
                  </p>
                ) : (
                  <>
                    <div className="thread-actions">
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => run(() => loadMessages(selected))}
                      >
                        Refresh messages
                      </button>
                      <button
                        className="text-link"
                        onClick={() => setConfirmBlock(true)}
                      >
                        Block this member�
                      </button>
                    </div>
                    {confirmBlock ? (
                      <div className="notice">
                        <p>
                          Block this member? Neither of you will be able to
                          message the other.
                        </p>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api("safety", {
                                action: "block",
                                userId: selected.peerId,
                                blocked: true,
                              });
                              setSelected({ ...selected, blocked: true });
                              setMessages([]);
                              setConfirmBlock(false);
                              await loadThreads();
                              setNotice("Member blocked.");
                            })
                          }
                        >
                          Confirm block
                        </button>
                        <button
                          className="text-link"
                          onClick={() => setConfirmBlock(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                    {older ? (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => run(() => loadMessages(selected, older))}
                      >
                        Older messages
                      </button>
                    ) : null}
                    <div
                      className="message-history"
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                    >
                      {!threadLoaded ? (
                        <p>Loading messages�</p>
                      ) : (
                        messages.map((m) => (
                          <article
                            key={m.id}
                            className={"chat-message " + (m.mine ? "mine" : "")}
                          >
                            <p>{m.body}</p>
                            <small>
                              {m.mine ? "You" : selected.displayName} �{" "}
                              {new Date(m.createdAt).toLocaleString()}
                            </small>
                            {!m.mine ? (
                              <button
                                className="text-link"
                                onClick={() => setReport(m)}
                              >
                                Report message
                              </button>
                            ) : null}
                          </article>
                        ))
                      )}
                    </div>
                    {status === "pending" && !selected.outgoing ? (
                      <div className="notice">
                        <p>Accept this request to open the conversation?</p>
                        {[true, false].map((accept) => (
                          <button
                            key={String(accept)}
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api("conversations/" + selected.id, {
                                  action: "respond",
                                  accept,
                                });
                                setStatus(accept ? "accepted" : "declined");
                                await loadThreads();
                              })
                            }
                          >
                            {accept ? "Accept request" : "Decline request"}
                          </button>
                        ))}
                      </div>
                    ) : status === "pending" ? (
                      <p className="notice">
                        Waiting for this request to be accepted. No more
                        messages can be sent yet.
                      </p>
                    ) : status === "declined" ? (
                      <p className="notice">This request was declined.</p>
                    ) : status === "accepted" ? (
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget,
                            body = String(new FormData(form).get("body"));
                          void run(async () => {
                            await api("conversations/" + selected.id, {
                              action: "message",
                              body,
                            });
                            form.reset();
                            await loadMessages(selected);
                            await loadThreads();
                          });
                        }}
                      >
                        <label>
                          Message
                          <textarea
                            name="body"
                            rows={3}
                            minLength={1}
                            maxLength={2000}
                            required
                            onChange={() => {
                              lastActive.current = Date.now();
                            }}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          Send message
                        </button>
                      </form>
                    ) : null}
                  </>
                )}
                {report ? (
                  <form
                    className="stack notice"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reason = String(
                        new FormData(e.currentTarget).get("reason"),
                      );
                      void run(async () => {
                        await api("safety", {
                          action: "report",
                          conversationId: selected.id,
                          messageId: report.id,
                          reason,
                        });
                        setReport(null);
                        setNotice(
                          "Report sent to the moderation inbox. Block the member if you do not want further contact.",
                        );
                      });
                    }}
                  >
                    <h3>Report this message</h3>
                    <p>
                      Only this selected message and your reason will be shared
                      with moderators.
                    </p>
                    <label>
                      What happened?
                      <textarea
                        name="reason"
                        minLength={5}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <button className="secondary" disabled={busy}>
                      Submit report
                    </button>
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => setReport(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <p>Select a conversation to read messages.</p>
            )}
          </section>
        </div>
      ) : null}
      {tab === "safety" ? (
        <div className="stack">
          <CommunityGuidelines />
          <h2>Blocked members</h2>
          {blocked.length ? (
            blocked.map((p) => (
              <div className="peer-card" key={p.id}>
                <p>
                  {p.displayName ?? "Member"} @{p.handle ?? ""}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("safety", {
                        action: "block",
                        userId: p.id,
                        blocked: false,
                      });
                      setBlocked((b) => b.filter((x) => x.id !== p.id));
                      setNotice("Member unblocked.");
                    })
                  }
                >
                  Unblock member
                </button>
              </div>
            ))
          ) : (
            <p>You have not blocked anyone.</p>
          )}
          <p>
            Messages are encrypted in storage and during transfer. They are not
            end-to-end encrypted. Reported messages can be read by moderators.
            This is peer conversation, not a monitored clinical or emergency
            service.
          </p>
          <p>
            Messages are removed after 180 days. Pending requests expire after
            30 days. Deleting an account removes its conversations for both
            participants. Report evidence may be retained for up to 90 days for
            moderation.
          </p>
          <Link className="text-link" href="/account">
            Account settings and deletion
          </Link>
        </div>
      ) : null}
    </div>
  );
}
export function CommunityGuidelines() {
  return (
    <details className="community-guidelines">
      <summary>Community guidelines</summary>
      <ul>
        <li>
          Be respectful, support different recovery paths, and honor another
          person�s boundaries.
        </li>
        <li>
          No harassment, threats, sexual solicitation, drug sales, paid
          referrals, recruitment or requests for money.
        </li>
        <li>
          Do not share someone else�s personal information. Avoid posting your
          own private contact or treatment details.
        </li>
        <li>
          Peers are not verified clinicians or crisis responders. Use the app�s
          Help now resources for urgent professional support.
        </li>
        <li>
          Messaging is for adults aged 18 and over. Browsing resources remains
          available to everyone.
        </li>
        <li>
          Use report and block when needed. Moderators review reported content;
          the inbox is not monitored continuously.
        </li>
      </ul>
    </details>
  );
}
