import React, { useEffect, useMemo, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type Entry = {
  id: string;
  date: string;
  project: string;
  activity?: string;
  notes?: string;
  start?: string;
  end?: string;
  minutes: number;
  createdAt: number;
  userId?: string;
};

type DbRow = {
  id: string;
  user_id: string;
  date: string;
  project: string;
  activity: string | null;
  notes: string | null;
  start: string | null;
  end: string | null;
  minutes: number;
  created_at: string;
};

type Profile = { user_id: string; email: string | null; is_admin: boolean };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ── Global CSS ─────────────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #111213;
    --surface:   #1a1b1e;
    --surface2:  #222428;
    --border:    #2e3035;
    --accent:    #c8f135;
    --accent2:   #4ade80;
    --text:      #e8e9ea;
    --muted:     #6b7280;
    --danger:    #ef4444;
    --radius:    6px;
    --font-ui:   'Syne', sans-serif;
    --font-mono: 'DM Mono', monospace;
    --tap:       44px; /* minimum tap target */
  }

  html { -webkit-text-size-adjust: 100%; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }

  /* ── Inputs ── */
  input, select, textarea {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius);
    padding: 10px 12px;
    font-family: var(--font-ui);
    font-size: 15px; /* 16px prevents iOS zoom, 15px is fine */
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    min-height: var(--tap);
    -webkit-appearance: none;
  }
  input:focus, select:focus { border-color: var(--accent); }
  input:disabled { opacity: 0.4; cursor: not-allowed; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
  /* prevent iOS zoom on focus – font-size >= 16px handles it, but also set explicitly */
  input[type="date"], input[type="time"] { font-size: 15px; }

  label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 5px;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 18px;
    height: var(--tap);
    border-radius: var(--radius);
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    letter-spacing: 0.03em;
    text-decoration: none;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .btn-accent  { background: var(--accent);  color: #111; }
  .btn-accent:active  { background: #d4f55a; }
  .btn-green   { background: var(--accent2); color: #111; }
  .btn-green:active   { background: #22c55e; }
  .btn-danger  { background: transparent; border: 1px solid var(--danger); color: var(--danger); }
  .btn-danger:active  { background: rgba(239,68,68,0.15); }
  .btn-ghost   { background: transparent; border: 1px solid var(--border); color: var(--muted); }
  .btn-ghost:active   { border-color: var(--accent); color: var(--accent); }
  .btn-red     { background: var(--danger); color: #fff; }
  .btn-red:active     { background: #dc2626; }
  .btn-full    { width: 100%; }

  /* ── Big timer button on mobile ── */
  .btn-timer {
    height: 64px;
    font-size: 16px;
    border-radius: 10px;
    width: 100%;
  }

  /* ── Cards ── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
  }
  .card-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--muted);
    margin-bottom: 12px;
  }

  /* ── Tabs ── */
  .tab {
    padding: 0 14px;
    height: 34px;
    border-radius: var(--radius);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-decoration: none;
    border: 1px solid var(--border);
    color: var(--muted);
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    -webkit-tap-highlight-color: transparent;
  }
  .tab.active { background: var(--accent); color: #111; border-color: var(--accent); }

  /* ── Tags ── */
  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 700;
    background: rgba(200,241,53,0.12);
    color: var(--accent);
    border: 1px solid rgba(200,241,53,0.25);
  }
  .tag-running {
    background: rgba(74,222,128,0.15);
    color: var(--accent2);
    border-color: rgba(74,222,128,0.3);
  }

  /* ── Summary chip ── */
  .summary-chip {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 14px;
    min-width: 90px;
  }
  .summary-chip .val {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 500;
    color: var(--accent);
  }
  .summary-chip .lbl {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Timer display ── */
  .timer-display {
    font-family: var(--font-mono);
    font-size: 52px;
    font-weight: 500;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  /* ── Entry cards (mobile list) ── */
  .entry-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .entry-card-main { flex: 1; min-width: 0; }
  .entry-card-project {
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .entry-card-meta {
    font-size: 12px;
    color: var(--muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .entry-card-time {
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 500;
    color: var(--accent);
    text-align: right;
    flex-shrink: 0;
  }
  .entry-card-delete {
    background: transparent;
    border: none;
    color: var(--muted);
    font-size: 18px;
    cursor: pointer;
    padding: 4px 6px;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
    line-height: 1;
  }
  .entry-card-delete:active { color: var(--danger); }

  /* ── Desktop table ── */
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }
  th.right { text-align: right; }
  td { padding: 5px 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  td input {
    padding: 4px 7px;
    font-size: 12px;
    font-family: var(--font-mono);
    background: transparent;
    border: 1px solid transparent;
    min-height: unset;
  }
  td input:hover { border-color: var(--border); background: var(--surface2); }
  td input:focus { border-color: var(--accent); background: var(--surface2); }
  .dagssum td {
    background: rgba(200,241,53,0.04);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    font-weight: 600;
    border-bottom: 2px solid var(--border);
  }

  /* ── Utilities ── */
  .mono  { font-family: var(--font-mono); }
  .muted { color: var(--muted); }
  .right { text-align: right; }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  /* ── Responsive breakpoints ── */
  /* Mobile: < 640px → stacked layout, card list, big buttons */
  /* Desktop: >= 640px → grid layout, table */

  .desktop-only { display: none; }
  .mobile-only  { display: block; }

  @media (min-width: 640px) {
    .desktop-only { display: block; }
    .mobile-only  { display: none; }
    input, select { font-size: 13px; min-height: unset; padding: 6px 10px; }
    .btn { height: 36px; font-size: 12px; padding: 0 14px; }
    .btn-timer { height: 40px; font-size: 13px; border-radius: var(--radius); }
  }

  /* ── Bottom nav (mobile only) ── */
  .bottom-nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    z-index: 20;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .bottom-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    border: none;
    background: transparent;
    gap: 3px;
  }
  .bottom-nav-item.active { color: var(--accent); }
  .bottom-nav-icon { font-size: 20px; line-height: 1; }

  @media (min-width: 640px) {
    .bottom-nav { display: none; }
  }

  /* ── Main padding accounts for bottom nav on mobile ── */
  .main-content {
    padding: 12px;
    padding-bottom: calc(70px + env(safe-area-inset-bottom));
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .main-content { padding: 16px; padding-bottom: 16px; }
  }

  /* ── Modal / bottom sheet for mobile manual entry ── */
  .sheet-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 30;
    display: flex;
    align-items: flex-end;
  }
  .sheet {
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-radius: 14px 14px 0 0;
    padding: 16px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    display: grid;
    gap: 12px;
  }
  .sheet-handle {
    width: 36px; height: 4px;
    background: var(--border);
    border-radius: 99px;
    margin: 0 auto 12px;
  }

  /* ── Field row for two fields side by side ── */
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
`;

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries());
  const [projects, setProjects] = useState<string[]>(() => loadProjects());
  const [running, setRunning] = useState<{ id: string; project: string; activity?: string; notes?: string; startTs: number } | null>(() => loadTimer());

  const [view, setView] = useState<"day" | "week" | "all">("day");
  const [filterDate, setFilterDate] = useState<string>(() => todayISO());

  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const isAdmin = !!profile?.is_admin;

  // Mobile tabs: "timer" | "manual" | "list" | "admin"
  const [mobileTab, setMobileTab] = useState<"timer" | "manual" | "list" | "admin">("timer");

  // Desktop hash routing
  const [routeKey, setRouteKey] = useState<string>(location.hash || "#/");
  useEffect(() => {
    const onChange = () => setRouteKey(location.hash || "#/");
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => { window.removeEventListener("hashchange", onChange); window.removeEventListener("popstate", onChange); };
  }, []);
  const isAdminRoute = routeKey === "#/admin";

  const [channelJoined, setChannelJoined] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useInterval(running ? 1000 : null);

  useEffect(() => { localStorage.setItem("tt_entries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("tt_projects", JSON.stringify(projects)); }, [projects]);
  useEffect(() => {
    if (running) localStorage.setItem("tt_running", JSON.stringify(running));
    else localStorage.removeItem("tt_running");
  }, [running]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { sub?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); return; }
    (async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,email,is_admin").eq("user_id", session.user.id).single();
      if (!error && data) setProfile(data as Profile);
    })();
  }, [session?.user?.id]);

  async function loadCloudEntries() {
    if (!supabase || !session?.user) return;
    const { data, error } = await supabase.from("time_entries").select("*").order("date", { ascending: false }).limit(10000);
    if (error) { console.warn(error.message); return; }
    const rows = (data ?? []) as DbRow[];
    const mapped: Entry[] = rows.map(row => ({
      id: row.id, userId: row.user_id, date: row.date, project: row.project,
      activity: row.activity ?? "", notes: row.notes ?? "",
      start: (row.start ?? "").slice(0, 5) || "", end: (row.end ?? "").slice(0, 5) || "",
      minutes: row.minutes, createdAt: new Date(row.created_at).getTime(),
    }));
    setEntries(mapped);
    setProjects(Array.from(new Set(mapped.map(e => e.project))).sort((a, b) => a.localeCompare(b)));
  }

  useEffect(() => { if (supabase && session?.user) loadCloudEntries(); }, [session?.user?.id, isAdmin]);

  useEffect(() => {
    if (!supabase || !session?.user || channelJoined) return;
    const ch = supabase.channel("time_entries_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, () => loadCloudEntries())
      .subscribe(status => { if (status === "SUBSCRIBED") setChannelJoined(true); });
    return () => { supabase.removeChannel(ch); setChannelJoined(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, channelJoined]);

  const filtered = useMemo(() => filterEntries(entries, view, filterDate), [entries, view, filterDate]);
  const totals = useMemo(() => sumMinutesByDate(filtered), [filtered]);
  const grandTotal = useMemo(() => filtered.reduce((a: number, e: Entry) => a + e.minutes, 0), [filtered]);

  function addProject(name: string) {
    const n = name.trim();
    if (!n || projects.includes(n)) return;
    setProjects([...projects, n].sort((a, b) => a.localeCompare(b)));
  }

  async function addManualEntry(data: Partial<Entry>) {
    const id = cryptoRandomId();
    const date = data.date || todayISO();
    const project = (data.project || "").trim();
    if (!project) return alert("Velg/skriv et arbeidssted");
    const start = data.start?.trim();
    const end = data.end?.trim();
    let minutes = Number(data.minutes) || 0;
    if (!minutes && start && end) { minutes = diffMinutes(start, end); if (minutes <= 0) return alert("Sluttid må være etter starttid"); }
    if (!minutes) return alert("Oppgi varighet eller start/slutt");
    const entry: Entry = { id, date, project, activity: data.activity?.trim() || "", notes: data.notes?.trim() || "", start: start || "", end: end || "", minutes, createdAt: Date.now(), userId: session?.user?.id };
    setEntries(prev => [entry, ...prev]);
    addProject(project);
    if (supabase && session?.user) {
      setSaving(true);
      const { error } = await supabase.from("time_entries").insert(toDbRow(entry, session.user.id));
      setSaving(false);
      if (error) console.warn(error.message);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Slette denne registreringen?")) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    if (supabase && session?.user) {
      await supabase.from("time_entries").delete().eq("id", id);
    }
  }

  async function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    if (supabase && session?.user) {
      const current = entries.find(e => e.id === id);
      if (!current) return;
      await supabase.from("time_entries").update(toDbUpdate({ ...current, ...patch })).eq("id", id);
    }
  }

  function startTimer(project: string, activity?: string, notes?: string) {
    if (!project.trim()) return alert("Skriv inn arbeidssted først");
    if (running) return alert("En timer kjører allerede. Stopp den først.");
    setRunning({ id: cryptoRandomId(), project: project.trim(), activity: activity?.trim(), notes: notes?.trim(), startTs: Date.now() });
    addProject(project.trim());
  }

  async function stopTimer() {
    if (!running) return;
    const start = running.startTs;
    const end = Date.now();
    const minutes = Math.max(1, Math.round((end - start) / 60000));
    const entry: Entry = {
      id: cryptoRandomId(), date: todayISO(), project: running.project,
      activity: running.activity || "", notes: running.notes || "",
      start: formatTime(new Date(start)), end: formatTime(new Date(end)),
      minutes, createdAt: Date.now(), userId: session?.user?.id,
    };
    setEntries(prev => [entry, ...prev]);
    setRunning(null);
    if (supabase && session?.user) {
      setSaving(true);
      await supabase.from("time_entries").insert(toDbRow(entry, session.user.id));
      setSaving(false);
    }
  }

  function clearLocal() {
    if (!confirm("Slette alle lokale registreringer? (Skydata påvirkes ikke)")) return;
    setEntries([]); setRunning(null);
  }

  async function sendMagicLink() {
    if (!supabase) return alert("Supabase er ikke konfigurert.");
    if (!email.trim()) return alert("Skriv inn e‑postadresse");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) return alert("Feil: " + error.message);
    alert("Sjekk e‑posten for innloggingslenke.");
  }
  async function signOut() { await supabase?.auth.signOut(); setMenuOpen(false); }

  function exportXLSX() {
    const header = ["Dato", "Arbeidssted", "Ordrenr", "Notater", "Start", "Slutt", "Minutter", "Timer"];
    const rows = [header, ...entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => [
      e.date, e.project, e.activity || "", (e.notes || "").replace(/\r?\n/g, " "),
      e.start || "", e.end || "", e.minutes, (e.minutes / 60).toFixed(2),
    ])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Timer");
    XLSX.writeFile(wb, `timereg-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const elapsedMs = useElapsed(running?.startTs ?? null);
  const elapsedMin = elapsedMs !== null ? Math.floor(elapsedMs / 60000) : null;
  const elapsedSec = elapsedMs !== null ? Math.floor((elapsedMs % 60000) / 1000) : null;

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

        {/* ── HEADER ── */}
        <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

              {/* Logo */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, background: "var(--accent)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>T</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.05em" }}>TIMEREG</span>
              </div>

              {running && (
                <span className="tag tag-running pulse" style={{ fontSize: 10 }}>● kjører</span>
              )}
              {saving && <span style={{ fontSize: 11, color: "var(--muted)" }} className="pulse">lagrer…</span>}

              {/* Desktop auth */}
              <div className="desktop-only" style={{ display: "none", marginLeft: "auto" }}>
                {!session?.user ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="email" style={{ width: 200 }} placeholder="E‑post" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMagicLink()} />
                    <button className="btn btn-ghost" onClick={sendMagicLink}>Logg inn</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)" }}>{session.user.email}</span>
                    <button className="btn btn-ghost" style={{ padding: "0 10px", height: 30, fontSize: 11 }} onClick={signOut}>Logg ut</button>
                    <button className="btn btn-ghost" style={{ padding: "0 10px", height: 30, fontSize: 11 }} onClick={exportXLSX}>↓ Excel</button>
                    <button className="btn btn-danger" style={{ padding: "0 10px", height: 30, fontSize: 11 }} onClick={clearLocal}>Tøm</button>
                  </div>
                )}
              </div>

              {/* Mobile: hamburger menu */}
              <div className="mobile-only" style={{ marginLeft: "auto" }}>
                <button className="btn btn-ghost" style={{ padding: "0 12px", height: 36, fontSize: 18 }} onClick={() => setMenuOpen(!menuOpen)}>
                  {menuOpen ? "✕" : "☰"}
                </button>
              </div>
            </div>

            {/* Mobile dropdown menu */}
            {menuOpen && (
              <div style={{ marginTop: 10, padding: "12px 0", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                {!session?.user ? (
                  <>
                    <input type="email" placeholder="E‑post for skylagring" value={email} onChange={e => setEmail(e.target.value)} />
                    <button className="btn btn-ghost btn-full" onClick={() => { sendMagicLink(); setMenuOpen(false); }}>Send innloggingslenke</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Innlogget: <span style={{ color: "var(--accent)" }}>{session.user.email}</span></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => { exportXLSX(); setMenuOpen(false); }}>↓ Excel</button>
                      <button className="btn btn-danger" onClick={() => { clearLocal(); setMenuOpen(false); }}>Tøm</button>
                      <button className="btn btn-ghost" onClick={signOut}>Logg ut</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Desktop tabs */}
            <div className="desktop-only" style={{ display: "none", gap: 6, marginTop: 10 }}>
              <a href="#/" className={`tab ${!isAdminRoute ? "active" : ""}`}>Registrering</a>
              {isAdmin && <a href="#/admin" className={`tab ${isAdminRoute ? "active" : ""}`}>Admin</a>}
            </div>
          </div>
        </header>

        {/* ── DESKTOP LAYOUT ── */}
        <div className="desktop-only">
          <main className="main-content">
            {isAdminRoute && isAdmin ? (
              <AdminPanel entries={entries} />
            ) : isAdminRoute ? (
              <div className="card"><p style={{ color: "var(--danger)" }}>Ingen tilgang.</p></div>
            ) : (
              <>
                <TimerCardDesktop running={running} onStart={startTimer} onStop={stopTimer} projects={projects} elapsedMin={elapsedMin} />
                <ManualEntryCard projects={projects} onAdd={addManualEntry} />
                <FilterAndTable
                  view={view} setView={setView} filterDate={filterDate} setFilterDate={setFilterDate}
                  filtered={filtered} totals={totals} grandTotal={grandTotal}
                  projects={projects} onUpdate={updateEntry} onDelete={deleteEntry}
                />
                {session?.user && <ImportBox onImported={loadCloudEntries} />}
              </>
            )}
          </main>
        </div>

        {/* ── MOBILE LAYOUT ── */}
        <div className="mobile-only">
          <main className="main-content">
            {mobileTab === "timer" && (
              <MobileTimerTab
                running={running} onStart={startTimer} onStop={stopTimer}
                projects={projects} elapsedMin={elapsedMin} elapsedSec={elapsedSec}
              />
            )}
            {mobileTab === "manual" && (
              <ManualEntryCard projects={projects} onAdd={(d) => { addManualEntry(d); setMobileTab("list"); }} />
            )}
            {mobileTab === "list" && (
              <MobileListTab
                view={view} setView={setView} filterDate={filterDate} setFilterDate={setFilterDate}
                filtered={filtered} totals={totals} grandTotal={grandTotal} onDelete={deleteEntry}
              />
            )}
            {mobileTab === "admin" && isAdmin && <AdminPanel entries={entries} />}
            {mobileTab === "admin" && !isAdmin && (
              <div className="card"><p style={{ color: "var(--danger)" }}>Ingen tilgang.</p></div>
            )}
          </main>

          {/* Bottom navigation */}
          <nav className="bottom-nav">
            <button className={`bottom-nav-item ${mobileTab === "timer" ? "active" : ""}`} onClick={() => setMobileTab("timer")}>
              <span className="bottom-nav-icon">⏱</span>Timer
            </button>
            <button className={`bottom-nav-item ${mobileTab === "manual" ? "active" : ""}`} onClick={() => setMobileTab("manual")}>
              <span className="bottom-nav-icon">✚</span>Manuelt
            </button>
            <button className={`bottom-nav-item ${mobileTab === "list" ? "active" : ""}`} onClick={() => setMobileTab("list")}>
              <span className="bottom-nav-icon">☰</span>Oversikt
            </button>
            {isAdmin && (
              <button className={`bottom-nav-item ${mobileTab === "admin" ? "active" : ""}`} onClick={() => setMobileTab("admin")}>
                <span className="bottom-nav-icon">⚙</span>Admin
              </button>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}

/* ── Mobile Timer Tab ───────────────────────────────────────────────────── */
function MobileTimerTab({ running, onStart, onStop, projects, elapsedMin, elapsedSec }: {
  running: any; onStart: (p: string, a?: string, n?: string) => void; onStop: () => void;
  projects: string[]; elapsedMin: number | null; elapsedSec: number | null;
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (running) { setProject(running.project); setActivity(running.activity || ""); setNotes(running.notes || ""); } }, [running]);

  const hh = elapsedMin !== null ? String(Math.floor(elapsedMin / 60)).padStart(2, "0") : "--";
  const mm = elapsedMin !== null ? String(elapsedMin % 60).padStart(2, "0") : "--";
  const ss = elapsedSec !== null ? String(elapsedSec).padStart(2, "0") : "--";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Big timer display */}
      <div className="card" style={{ textAlign: "center", padding: "28px 16px" }}>
        <div className="timer-display" style={{ color: running ? "var(--accent)" : "var(--border)" }}>
          {hh}:{mm}<span style={{ fontSize: 24, opacity: 0.6 }}>:{ss}</span>
        </div>
        {running && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            <span className="tag tag-running">● kjører</span>{" "}
            {running.project}{running.activity ? ` · ${running.activity}` : ""}
          </div>
        )}
        {running && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Startet {formatTime(new Date(running.startTs))}
          </div>
        )}
      </div>

      {/* Fields – disabled while running */}
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div>
          <label>Arbeidssted</label>
          <input value={project} onChange={e => setProject(e.target.value)} list="m-timer-projects" placeholder="Skriv eller velg" disabled={!!running} />
          <datalist id="m-timer-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
        </div>
        <div className="field-row">
          <div>
            <label>Ordrenr</label>
            <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
          </div>
          <div>
            <label>Notater</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
          </div>
        </div>
      </div>

      {/* Big action button */}
      {!running ? (
        <button className="btn btn-green btn-timer" onClick={() => onStart(project, activity, notes)}>
          ▶ Start timer
        </button>
      ) : (
        <button className="btn btn-red btn-timer" onClick={onStop}>
          ■ Stopp og lagre
        </button>
      )}
    </div>
  );
}

/* ── Desktop Timer Card ─────────────────────────────────────────────────── */
function TimerCardDesktop({ running, onStart, onStop, projects, elapsedMin }: {
  running: any; onStart: (p: string, a?: string, n?: string) => void; onStop: () => void;
  projects: string[]; elapsedMin: number | null;
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (running) { setProject(running.project); setActivity(running.activity || ""); setNotes(running.notes || ""); } }, [running]);

  return (
    <div className="card">
      <div className="card-title">⏱ Timer</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 160px" }}>
          <label>Arbeidssted</label>
          <input value={project} onChange={e => setProject(e.target.value)} list="d-timer-projects" placeholder="Skriv eller velg" disabled={!!running} />
          <datalist id="d-timer-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label>Ordrenr</label>
          <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
        </div>
        <div style={{ flex: "2 1 200px" }}>
          <label>Notater</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
        </div>
        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>Tid</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 500, color: running ? "var(--accent)" : "var(--border)" }}>
            {elapsedMin !== null ? formatHM(elapsedMin) : "--:--"}
          </div>
        </div>
        {!running
          ? <button className="btn btn-green btn-timer" style={{ width: "auto", padding: "0 20px" }} onClick={() => onStart(project, activity, notes)}>▶ Start</button>
          : <button className="btn btn-red btn-timer" style={{ width: "auto", padding: "0 20px" }} onClick={onStop}>■ Stopp &amp; lagre</button>
        }
      </div>
      {running && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          <span className="tag tag-running">kjører</span>{" "}
          Startet {formatTime(new Date(running.startTs))} · {running.project}{running.activity ? ` · ${running.activity}` : ""}
        </div>
      )}
    </div>
  );
}

/* ── ManualEntryCard (shared mobile + desktop) ──────────────────────────── */
function ManualEntryCard({ projects, onAdd }: { projects: string[]; onAdd: (d: any) => void }) {
  const [date, setDate] = useState(todayISO());
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    if (start && end) { const d = diffMinutes(start, end); if (d > 0) setMinutes(String(d)); }
  }, [start, end]);

  function handleAdd() {
    onAdd({ date, project, activity, notes, start, end, minutes: minutes ? Number(minutes) : 0 });
    // Reset after submit
    setProject(""); setActivity(""); setNotes(""); setStart(""); setEnd(""); setMinutes("");
  }

  return (
    <div className="card">
      <div className="card-title">+ Legg inn manuelt</div>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field-row">
          <div>
            <label>Dato</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label>Arbeidssted</label>
            <input value={project} onChange={e => setProject(e.target.value)} list="manual-projects" placeholder="Skriv eller velg" />
            <datalist id="manual-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
          </div>
        </div>
        <div className="field-row">
          <div>
            <label>Ordrenr</label>
            <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" />
          </div>
          <div>
            <label>Notater</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" />
          </div>
        </div>
        <div className="field-row">
          <div>
            <label>Start</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label>Slutt</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div>
            <label>Minutter</label>
            <input type="number" min={0} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Beregnes auto" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn btn-accent btn-full" onClick={handleAdd}>Legg til</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile List Tab ────────────────────────────────────────────────────── */
function MobileListTab({ view, setView, filterDate, setFilterDate, filtered, totals, grandTotal, onDelete }: {
  view: "day" | "week" | "all";
  setView: (v: "day" | "week" | "all") => void;
  filterDate: string;
  setFilterDate: (d: string) => void;
  filtered: Entry[];
  totals: Record<string, number>;
  grandTotal: number;
  onDelete: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) { const arr = map.get(e.date) ?? []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label>Visning</label>
          <select value={view} onChange={e => setView(e.target.value as any)}>
            <option value="day">Dag</option>
            <option value="week">Uke</option>
            <option value="all">Alle</option>
          </select>
        </div>
        {view !== "all" && (
          <div style={{ flex: 1 }}>
            <label>Dato</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
        )}
        <div className="summary-chip" style={{ flexShrink: 0 }}>
          <div className="val">{formatHM(grandTotal)}</div>
          <div className="lbl">Totalt</div>
        </div>
      </div>

      {/* Entry cards grouped by date */}
      {byDate.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: "32px 0" }}>
          Ingen registreringer for valgt periode.
        </div>
      )}
      {byDate.map(([date, dayEntries]) => (
        <div key={date}>
          {/* Date header with day total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 2px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {formatDateNO(date)}
            </span>
            {dayEntries.length > 1 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>
                {formatHM(totals[date] ?? 0)}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {dayEntries.map(e => (
              <div key={e.id} className="entry-card">
                <div className="entry-card-main">
                  <div className="entry-card-project">{e.project}</div>
                  <div className="entry-card-meta">
                    {[e.activity, e.start && e.end ? `${e.start}–${e.end}` : null, e.notes]
                      .filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="entry-card-time">{formatHM(e.minutes)}</div>
                <button className="entry-card-delete" onClick={() => onDelete(e.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── FilterAndTable (desktop) ───────────────────────────────────────────── */
function FilterAndTable({ view, setView, filterDate, setFilterDate, filtered, totals, grandTotal, projects, onUpdate, onDelete }: {
  view: "day" | "week" | "all"; setView: (v: any) => void;
  filterDate: string; setFilterDate: (d: string) => void;
  filtered: Entry[]; totals: Record<string, number>; grandTotal: number;
  projects: string[];
  onUpdate: (id: string, patch: Partial<Entry>) => void;
  onDelete: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) { const arr = map.get(e.date) ?? []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div><label>Visning</label><select value={view} onChange={e => setView(e.target.value)} style={{ width: 100 }}><option value="day">Dag</option><option value="week">Uke</option><option value="all">Alle</option></select></div>
          {view !== "all" && <div><label>Dato</label><input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 150 }} /></div>}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div className="summary-chip"><div className="val">{formatHM(grandTotal)}</div><div className="lbl">Totalt</div></div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Dato</th><th>Arbeidssted</th><th>Ordrenr</th><th>Notater</th>
              <th>Start</th><th>Slutt</th><th className="right">Min</th><th className="right">Timer</th><th></th>
            </tr>
          </thead>
          <tbody>
            {byDate.map(([date, dayEntries]) => (
              <React.Fragment key={date}>
                {dayEntries.map(e => (
                  <tr key={e.id}>
                    <td><input type="date" value={e.date} onChange={ev => onUpdate(e.id, { date: ev.target.value })} style={{ width: 130 }} /></td>
                    <td>
                      <input type="text" value={e.project} onChange={ev => onUpdate(e.id, { project: ev.target.value })} list="table-projects" style={{ width: 130 }} />
                      <datalist id="table-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
                    </td>
                    <td><input type="text" value={e.activity || ""} onChange={ev => onUpdate(e.id, { activity: ev.target.value })} style={{ width: 100 }} /></td>
                    <td><input type="text" value={e.notes || ""} onChange={ev => onUpdate(e.id, { notes: ev.target.value })} style={{ width: 180 }} /></td>
                    <td><input type="time" value={e.start || ""} style={{ width: 88 }} onChange={ev => { const s = ev.target.value; const m = s && e.end ? diffMinutes(s, e.end) : e.minutes; onUpdate(e.id, { start: s, minutes: m }); }} /></td>
                    <td><input type="time" value={e.end || ""} style={{ width: 88 }} onChange={ev => { const en = ev.target.value; const m = e.start && en ? diffMinutes(e.start, en) : e.minutes; onUpdate(e.id, { end: en, minutes: m }); }} /></td>
                    <td className="right"><input type="number" value={e.minutes} min={0} step={5} style={{ width: 64, textAlign: "right" }} onChange={ev => onUpdate(e.id, { minutes: Number(ev.target.value) })} /></td>
                    <td className="right mono muted">{(e.minutes / 60).toFixed(2)}</td>
                    <td className="right"><button className="btn btn-danger" style={{ padding: "0 8px", height: 28, fontSize: 11 }} onClick={() => onDelete(e.id)}>Slett</button></td>
                  </tr>
                ))}
                {dayEntries.length > 1 && (
                  <tr className="dagssum">
                    <td>{date}</td><td colSpan={5} style={{ color: "var(--muted)", fontStyle: "italic" }}>Dagssum</td>
                    <td className="right">{totals[date] ?? 0}</td><td className="right">{((totals[date] ?? 0) / 60).toFixed(2)}</td><td></td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--muted)", padding: "28px 0" }}>Ingen registreringer for valgt periode.</p>}
      </div>
    </div>
  );
}

/* ── AdminPanel ─────────────────────────────────────────────────────────── */
function AdminPanel({ entries }: { entries: Entry[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const { year, week } = getISOWeek(e.date);
      const key = `${e.userId || "ukjent"}|${year}-W${String(week).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + e.minutes);
    }
    return Array.from(map.entries())
      .map(([k, mins]) => { const [userId, yw] = k.split("|"); return { userId, yearWeek: yw, minutes: mins }; })
      .sort((a, b) => b.yearWeek.localeCompare(a.yearWeek));
  }, [entries]);

  const perUser = useMemo(() => {
    const m = new Map<string, number>();
    grouped.forEach(r => m.set(r.userId, (m.get(r.userId) || 0) + r.minutes));
    return m;
  }, [grouped]);

  const shortId = (uid: string) => uid === "ukjent" ? "ukjent" : uid.slice(0, 8) + "…";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card">
        <div className="card-title">Totalt per ansatt</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {Array.from(perUser.entries()).map(([uid, mins]) => (
            <div className="summary-chip" key={uid}>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>{shortId(uid)}</div>
              <div className="val">{formatHM(mins)}</div>
              <div className="lbl">{(mins / 60).toFixed(1)} t</div>
            </div>
          ))}
          {perUser.size === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>Ingen data</p>}
        </div>
      </div>
      <div className="card">
        <div className="card-title">Pr. uke / ansatt</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Ansatt</th><th>Uke</th><th className="right">Timer</th><th className="right">Min</th></tr></thead>
            <tbody>
              {grouped.map((r, i) => (
                <tr key={i}>
                  <td className="mono muted" style={{ fontSize: 11 }}>{shortId(r.userId)}</td>
                  <td><span className="tag">{r.yearWeek}</span></td>
                  <td className="right mono" style={{ color: "var(--accent)" }}>{formatHM(r.minutes)}</td>
                  <td className="right mono muted">{r.minutes}</td>
                </tr>
              ))}
              {grouped.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>Ingen data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── ImportBox ──────────────────────────────────────────────────────────── */
function ImportBox({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setInfo(""); setIsError(false);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      const toEntry = (r: any) => {
        const date = normalizeDate(r.Dato || r.dato || r.Date);
        const project = (r.Arbeidssted || r.prosjekt || r.Project || "").toString().trim();
        const activity = (r.Ordrenr || r.ordrenr || r.Activity || "").toString().trim();
        const notes = (r.Notater || r.notater || r.Notes || "").toString();
        const start = normalizeTime(r.Start || r.start);
        const end = normalizeTime(r.Slutt || r.slutt || r.End);
        let minutes = Number(r.Minutter || r.minutter || r.Minutes || 0);
        if (!minutes && start && end) minutes = diffMinutes(start, end);
        if (!date || !project || !minutes) return null;
        return { date, project, activity, notes, start, end, minutes };
      };
      const list = rows.map(toEntry).filter(Boolean) as any[];
      if (!list.length) { setInfo("Fant ingen gyldige rader."); setIsError(true); setBusy(false); return; }
      if (!supabase) throw new Error("Supabase ikke konfigurert.");
      const { data: s } = await supabase.auth.getSession();
      const userId = s?.session?.user?.id;
      if (!userId) throw new Error("Du må være innlogget.");
      let inserted = 0;
      for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100);
        const payload = chunk.map(e => toDbRow({ id: cryptoRandomId(), createdAt: Date.now(), ...e }, userId));
        const { error, count } = await supabase.from("time_entries").insert(payload, { count: "exact" });
        if (error) throw error;
        inserted += count || payload.length;
      }
      setInfo(`✓ Importert ${inserted} rader.`);
      onImported();
    } catch (err: any) {
      setInfo("Feil: " + (err?.message || String(err))); setIsError(true);
    } finally {
      setBusy(false); (e.target as HTMLInputElement).value = "";
    }
  }

  return (
    <div className="card">
      <div className="card-title">↑ Importer CSV/XLSX</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} disabled={busy} style={{ width: "auto" }} />
        {busy ? <span className="muted pulse" style={{ fontSize: 12 }}>Importerer…</span>
          : info && <span style={{ fontSize: 12, color: isError ? "var(--danger)" : "var(--accent2)" }}>{info}</span>}
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Kolonner: Dato, Arbeidssted, Ordrenr, Notater, Start, Slutt, Minutter.</p>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function getISOWeek(dateISO: string) {
  const d = new Date(dateISO);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThu = new Date(target.getFullYear(), 0, 4);
  const fDayNr = (firstThu.getDay() + 6) % 7;
  firstThu.setDate(firstThu.getDate() - fDayNr + 3);
  return { year: target.getFullYear(), week: 1 + Math.round((target.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000)) };
}

function normalizeDate(v: string) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function normalizeTime(v: string) {
  if (!v) return "";
  const m = String(v).trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2);
}

function toDbRow(e: Entry, userId: string) {
  return {
    id: e.id, user_id: userId, date: e.date, project: e.project,
    activity: e.activity || null, notes: e.notes || null,
    start: e.start ? `${e.start}:00` : null, end: e.end ? `${e.end}:00` : null,
    minutes: e.minutes, created_at: new Date(e.createdAt).toISOString(),
  };
}

function toDbUpdate(e: Entry) {
  return {
    date: e.date, project: e.project, activity: e.activity || null, notes: e.notes || null,
    start: e.start ? `${e.start}:00` : null, end: e.end ? `${e.end}:00` : null, minutes: e.minutes,
  };
}

function useElapsed(startTs: number | null) {
  const [elapsed, setElapsed] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!startTs) { setElapsed(null); return; }
    const update = () => setElapsed(Date.now() - startTs);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTs]);
  return elapsed;
}

function useInterval(delay: number | null) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!delay) return;
    const id = setInterval(() => setTick(x => x + 1), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function diffMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDateNO(iso: string) {
  const [y, m, d] = iso.split("-");
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${Number(d)}. ${months[Number(m) - 1]} ${y}`;
}

function loadEntries(): Entry[] {
  try { const r = localStorage.getItem("tt_entries"); return r ? JSON.parse(r) : []; } catch { return []; }
}
function loadProjects(): string[] {
  try { const r = localStorage.getItem("tt_projects"); return r ? JSON.parse(r) : []; } catch { return []; }
}
function loadTimer() {
  try { const r = localStorage.getItem("tt_running"); const o = r ? JSON.parse(r) : null; return o?.startTs ? o : null; } catch { return null; }
}

function filterEntries(entries: Entry[], view: "day" | "week" | "all", baseDateISO: string): Entry[] {
  if (view === "all") return entries;
  const base = new Date(baseDateISO);
  const start = new Date(base), end = new Date(base);
  if (view === "week") { const day = (base.getDay() + 6) % 7; start.setDate(base.getDate() - day); end.setDate(start.getDate() + 6); }
  return entries.filter(e => e.date >= start.toISOString().slice(0, 10) && e.date <= end.toISOString().slice(0, 10));
}

function sumMinutesByDate(list: Entry[]) {
  return list.reduce<Record<string, number>>((acc, e) => { acc[e.date] = (acc[e.date] || 0) + e.minutes; return acc; }, {});
}
