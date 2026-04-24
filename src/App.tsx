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
  }

  html {
    -webkit-text-size-adjust: 100%;
    overflow-x: hidden;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
    overflow-x: hidden;
    width: 100%;
  }

  input, select, textarea {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius);
    padding: 10px 12px;
    font-family: var(--font-ui);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    min-height: 44px;
    -webkit-appearance: none;
    max-width: 100%;
  }
  input:focus, select:focus { border-color: var(--accent); }
  input:disabled { opacity: 0.4; cursor: not-allowed; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }

  label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 5px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 16px;
    height: 44px;
    border-radius: var(--radius);
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: opacity 0.1s;
    letter-spacing: 0.03em;
    text-decoration: none;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    flex-shrink: 0;
  }
  .btn:active { opacity: 0.75; }
  .btn-accent  { background: var(--accent);  color: #111; }
  .btn-green   { background: var(--accent2); color: #111; }
  .btn-danger  { background: transparent; border: 1px solid var(--danger); color: var(--danger); }
  .btn-ghost   { background: transparent; border: 1px solid var(--border); color: var(--muted); }
  .btn-red     { background: var(--danger); color: #fff; }
  .btn-full    { width: 100%; }

  .btn-timer {
    height: 56px;
    font-size: 15px;
    border-radius: 10px;
    width: 100%;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    width: 100%;
    min-width: 0;
  }
  .card-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--muted);
    margin-bottom: 12px;
  }

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
    white-space: nowrap;
  }
  .tab.active { background: var(--accent); color: #111; border-color: var(--accent); }

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

  .summary-chip {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px 12px;
    flex-shrink: 0;
  }
  .summary-chip .val {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 500;
    color: var(--accent);
  }
  .summary-chip .lbl {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .timer-display {
    font-family: var(--font-mono);
    font-size: 48px;
    font-weight: 500;
    letter-spacing: 0.04em;
    line-height: 1;
    width: 100%;
    text-align: center;
  }

  .entry-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 11px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
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
    font-size: 15px;
    font-weight: 500;
    color: var(--accent);
    flex-shrink: 0;
  }
  .entry-card-delete {
    background: transparent;
    border: none;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
    line-height: 1;
    min-width: 28px;
    text-align: center;
  }
  .entry-card-delete:active { color: var(--danger); }

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
    white-space: nowrap;
  }
  th.right { text-align: right; }
  td { padding: 4px 6px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  td input {
    padding: 4px 6px;
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

  .mono  { font-family: var(--font-mono); }
  .muted { color: var(--muted); }
  .right { text-align: right; }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }

  .desktop-only { display: none !important; }
  .mobile-only  { display: block; }

  @media (min-width: 640px) {
    .desktop-only { display: block !important; }
    .mobile-only  { display: none !important; }
    input, select { font-size: 13px; min-height: unset; padding: 6px 10px; }
    .btn { height: 36px; font-size: 12px; padding: 0 14px; }
    .btn-timer { height: 38px; font-size: 13px; border-radius: var(--radius); width: auto; padding: 0 20px; }
  }

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
    padding: 9px 0 7px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    border: none;
    background: transparent;
    gap: 3px;
    min-height: 52px;
  }
  .bottom-nav-item.active { color: var(--accent); }
  .bottom-nav-icon { font-size: 19px; line-height: 1; }

  @media (min-width: 640px) {
    .bottom-nav { display: none; }
  }

  .main-content {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 12px;
    padding-bottom: calc(60px + env(safe-area-inset-bottom) + 12px);
    display: grid;
    gap: 10px;
    overflow-x: hidden;
  }
  @media (min-width: 640px) {
    .main-content { padding: 16px; padding-bottom: 16px; }
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
  const [mobileTab, setMobileTab] = useState<"timer" | "manual" | "list" | "admin">("timer");
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
  const elapsedMs = useElapsed(running?.startTs ?? null);
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
      await supabase.from("time_entries").insert(toDbRow(entry, session.user.id));
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Slette denne registreringen?")) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    if (supabase && session?.user) await supabase.from("time_entries").delete().eq("id", id);
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
    if (!email.trim()) return alert("Skriv inn e-postadresse");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) return alert("Feil: " + error.message);
    alert("Sjekk e-posten for innloggingslenke.");
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

  const totalSec = elapsedMs !== null ? Math.floor(elapsedMs / 1000) : null;
  const dispH = totalSec !== null ? String(Math.floor(totalSec / 3600)).padStart(2, "0") : "--";
  const dispM = totalSec !== null ? String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0") : "--";
  const dispS = totalSec !== null ? String(totalSec % 60).padStart(2, "0") : "--";
  const elapsedMin = totalSec !== null ? Math.floor(totalSec / 60) : null;

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)", width: "100%", overflowX: "hidden" }}>
        <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10, width: "100%" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{ width: 26, height: 26, background: "var(--accent)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>T</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.05em" }}>TIMEREG</span>
              </div>
              {running && <span className="tag tag-running pulse" style={{ fontSize: 10 }}>● kjører</span>}
              {saving && <span style={{ fontSize: 11, color: "var(--muted)" }} className="pulse">lagrer…</span>}
              <div className="desktop-only" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                {!session?.user ? (
                  <>
                    <input type="email" style={{ width: 200 }} placeholder="E-post" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMagicLink()} />
                    <button className="btn btn-ghost" onClick={sendMagicLink}>Logg inn</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{session.user.email}</span>
                    <button className="btn btn-ghost" style={{ height: 30, fontSize: 11, padding: "0 10px" }} onClick={signOut}>Logg ut</button>
                    <button className="btn btn-ghost" style={{ height: 30, fontSize: 11, padding: "0 10px" }} onClick={exportXLSX}>↓ Excel</button>
                    <button className="btn btn-danger" style={{ height: 30, fontSize: 11, padding: "0 10px" }} onClick={clearLocal}>Tøm</button>
                  </>
                )}
              </div>
              <div className="mobile-only" style={{ marginLeft: "auto" }}>
                <button className="btn btn-ghost" style={{ padding: "0 12px", height: 36, fontSize: 18 }} onClick={() => setMenuOpen(!menuOpen)}>
                  {menuOpen ? "✕" : "☰"}
                </button>
              </div>
            </div>
            {menuOpen && (
              <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                {!session?.user ? (
                  <>
                    <input type="email" placeholder="E-post for skylagring" value={email} onChange={e => setEmail(e.target.value)} />
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
            <div className="desktop-only" style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <a href="#/" className={`tab ${!isAdminRoute ? "active" : ""}`}>Registrering</a>
              {isAdmin && <a href="#/admin" className={`tab ${isAdminRoute ? "active" : ""}`}>Admin</a>}
            </div>
          </div>
        </header>

        <div className="desktop-only">
          <main className="main-content">
            {isAdminRoute && isAdmin ? <AdminPanel entries={entries} /> :
             isAdminRoute ? <div className="card"><p style={{ color: "var(--danger)" }}>Ingen tilgang.</p></div> : (
              <>
                <TimerCardDesktop running={running} onStart={startTimer} onStop={stopTimer} projects={projects} elapsedMin={elapsedMin} />
                <ManualEntryCard projects={projects} onAdd={addManualEntry} onDone={() => {}} />
                <FilterAndTable view={view} setView={setView} filterDate={filterDate} setFilterDate={setFilterDate}
                  filtered={filtered} totals={totals} grandTotal={grandTotal} projects={projects} onUpdate={updateEntry} onDelete={deleteEntry} />
                {session?.user && <ImportBox onImported={loadCloudEntries} />}
              </>
            )}
          </main>
        </div>

        <div className="mobile-only">
          <main className="main-content">
            {mobileTab === "timer" && (
              <MobileTimerTab running={running} onStart={startTimer} onStop={stopTimer}
                projects={projects} dispH={dispH} dispM={dispM} dispS={dispS} />
            )}
            {mobileTab === "manual" && (
              <ManualEntryCard projects={projects} onAdd={(d) => { addManualEntry(d); setMobileTab("list"); }} onDone={() => setMobileTab("list")} />
            )}
            {mobileTab === "list" && (
              <MobileListTab view={view} setView={setView} filterDate={filterDate} setFilterDate={setFilterDate}
                filtered={filtered} totals={totals} grandTotal={grandTotal} onDelete={deleteEntry} />
            )}
            {mobileTab === "admin" && (isAdmin ? <AdminPanel entries={entries} /> : <div className="card"><p style={{ color: "var(--danger)" }}>Ingen tilgang.</p></div>)}
          </main>
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

function MobileTimerTab({ running, onStart, onStop, projects, dispH, dispM, dispS }: {
  running: any; onStart: (p: string, a?: string, n?: string) => void; onStop: () => void;
  projects: string[]; dispH: string; dispM: string; dispS: string;
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (running) { setProject(running.project); setActivity(running.activity || ""); setNotes(running.notes || ""); }
  }, [running?.project]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ textAlign: "center", padding: "24px 12px" }}>
        <div className="timer-display" style={{ color: running ? "var(--accent)" : "var(--border)" }}>
          {dispH}:{dispM}<span style={{ fontSize: 28, opacity: 0.7 }}>:{dispS}</span>
        </div>
        {running && (
          <>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {running.project}{running.activity ? ` · ${running.activity}` : ""}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Startet {formatTime(new Date(running.startTs))}
            </div>
          </>
        )}
      </div>
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
      {!running
        ? <button className="btn btn-green btn-timer" onClick={() => onStart(project, activity, notes)}>▶ Start timer</button>
        : <button className="btn btn-red btn-timer" onClick={onStop}>■ Stopp og lagre</button>
      }
    </div>
  );
}

function TimerCardDesktop({ running, onStart, onStop, projects, elapsedMin }: {
  running: any; onStart: (p: string, a?: string, n?: string) => void; onStop: () => void;
  projects: string[]; elapsedMin: number | null;
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (running) { setProject(running.project); setActivity(running.activity || ""); setNotes(running.notes || ""); }
  }, [running?.project]);

  return (
    <div className="card">
      <div className="card-title">⏱ Timer</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 150px" }}>
          <label>Arbeidssted</label>
          <input value={project} onChange={e => setProject(e.target.value)} list="d-timer-projects" placeholder="Skriv eller velg" disabled={!!running} />
          <datalist id="d-timer-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label>Ordrenr</label>
          <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
        </div>
        <div style={{ flex: "2 1 180px" }}>
          <label>Notater</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
        </div>
        <div style={{ textAlign: "center", minWidth: 76 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>Tid</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: running ? "var(--accent)" : "var(--border)" }}>
            {elapsedMin !== null ? formatHM(elapsedMin) : "--:--"}
          </div>
        </div>
        {!running
          ? <button className="btn btn-green btn-timer" onClick={() => onStart(project, activity, notes)}>▶ Start</button>
          : <button className="btn btn-red btn-timer" onClick={onStop}>■ Stopp &amp; lagre</button>
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

function ManualEntryCard({ projects, onAdd, onDone }: {
  projects: string[]; onAdd: (d: any) => void; onDone: () => void;
}) {
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
    setProject(""); setActivity(""); setNotes(""); setStart(""); setEnd(""); setMinutes("");
  }
  return (
    <div className="card">
      <div className="card-title">+ Legg inn manuelt</div>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field-row">
          <div><label>Dato</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div>
            <label>Arbeidssted</label>
            <input value={project} onChange={e => setProject(e.target.value)} list="manual-projects" placeholder="Skriv eller velg" />
            <datalist id="manual-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
          </div>
        </div>
        <div className="field-row">
          <div><label>Ordrenr</label><input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" /></div>
          <div><label>Notater</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" /></div>
        </div>
        <div className="field-row">
          <div><label>Start</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label>Slutt</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div><label>Minutter</label><input type="number" min={0} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Beregnes auto" /></div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn btn-accent btn-full" onClick={handleAdd}>Legg til</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileListTab({ view, setView, filterDate, setFilterDate, filtered, totals, grandTotal, onDelete }: {
  view: "day" | "week" | "all"; setView: (v: any) => void;
  filterDate: string; setFilterDate: (d: string) => void;
  filtered: Entry[]; totals: Record<string, number>; grandTotal: number;
  onDelete: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) { const arr = map.get(e.date) ?? []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div style={{ display: "grid", gap: 10, width: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", width: "100%" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label>Visning</label>
          <select value={view} onChange={e => setView(e.target.value)}>
            <option value="day">Dag</option><option value="week">Uke</option><option value="all">Alle</option>
          </select>
        </div>
        {view !== "all" && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <label>Dato</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
        )}
        <div className="summary-chip">
          <div className="val">{formatHM(grandTotal)}</div>
          <div className="lbl">Totalt</div>
        </div>
      </div>
      {byDate.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: "28px 0" }}>Ingen registreringer for valgt periode.</div>
      )}
      {byDate.map(([date, dayEntries]) => (
        <div key={date} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 2px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{formatDateNO(date)}</span>
            {dayEntries.length > 1 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>{formatHM(totals[date] ?? 0)}</span>}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {dayEntries.map(e => (
              <div key={e.id} className="entry-card">
                <div className="entry-card-main">
                  <div className="entry-card-project">{e.project}</div>
                  <div className="entry-card-meta">{[e.activity, e.start && e.end ? `${e.start}–${e.end}` : null, e.notes].filter(Boolean).join(" · ")}</div>
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

function FilterAndTable({ view, setView, filterDate, setFilterDate, filtered, totals, grandTotal, projects, onUpdate, onDelete }: {
  view: "day" | "week" | "all"; setView: (v: any) => void;
  filterDate: string; setFilterDate: (d: string) => void;
  filtered: Entry[]; totals: Record<string, number>; grandTotal: number;
  projects: string[]; onUpdate: (id: string, patch: Partial<Entry>) => void; onDelete: (id: string) => void;
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
        <div style={{ marginLeft: "auto" }}><div className="summary-chip"><div className="val">{formatHM(grandTotal)}</div><div className="lbl">Totalt</div></div></div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Dato</th><th>Arbeidssted</th><th>Ordrenr</th><th>Notater</th><th>Start</th><th>Slutt</th><th className="right">Min</th><th className="right">Timer</th><th></th></tr>
          </thead>
          <tbody>
            {byDate.map(([date, dayEntries]) => (
              <React.Fragment key={date}>
                {dayEntries.map(e => (
                  <tr key={e.id}>
                    <td><input type="date" value={e.date} onChange={ev => onUpdate(e.id, { date: ev.target.value })} style={{ width: 128 }} /></td>
                    <td>
                      <input type="text" value={e.project} onChange={ev => onUpdate(e.id, { project: ev.target.value })} list="table-projects" style={{ width: 128 }} />
                      <datalist id="table-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
                    </td>
                    <td><input type="text" value={e.activity || ""} onChange={ev => onUpdate(e.id, { activity: ev.target.value })} style={{ width: 96 }} /></td>
                    <td><input type="text" value={e.notes || ""} onChange={ev => onUpdate(e.id, { notes: ev.target.value })} style={{ width: 176 }} /></td>
                    <td><input type="time" value={e.start || ""} style={{ width: 86 }} onChange={ev => { const s = ev.target.value; const m = s && e.end ? diffMinutes(s, e.end) : e.minutes; onUpdate(e.id, { start: s, minutes: m }); }} /></td>
                    <td><input type="time" value={e.end || ""} style={{ width: 86 }} onChange={ev => { const en = ev.target.value; const m = e.start && en ? diffMinutes(e.start, en) : e.minutes; onUpdate(e.id, { end: en, minutes: m }); }} /></td>
                    <td className="right"><input type="number" value={e.minutes} min={0} step={5} style={{ width: 62, textAlign: "right" }} onChange={ev => onUpdate(e.id, { minutes: Number(ev.target.value) })} /></td>
                    <td className="right mono muted">{(e.minutes / 60).toFixed(2)}</td>
                    <td className="right"><button className="btn btn-danger" style={{ height: 28, padding: "0 8px", fontSize: 11 }} onClick={() => onDelete(e.id)}>Slett</button></td>
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
        {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>Ingen registreringer for valgt periode.</p>}
      </div>
    </div>
  );
}

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
    if (startTs === null) { setElapsed(null); return; }
    const update = () => setElapsed(Date.now() - startTs);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTs]);
  return elapsed;
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
