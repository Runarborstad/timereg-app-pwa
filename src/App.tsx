import React, { useEffect, useMemo, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/** Timeregistrering – mørkt tema som matcher PlanControl */

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

// ── Design tokens matching PlanControl ──────────────────────────────────────
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
    --warn:      #f59e0b;
    --radius:    6px;
    --font-ui:   'Syne', sans-serif;
    --font-mono: 'DM Mono', monospace;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  input, select, textarea {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius);
    padding: 6px 10px;
    font-family: var(--font-ui);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }
  input:focus, select:focus { border-color: var(--accent); }
  input:disabled { opacity: 0.4; cursor: not-allowed; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }

  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--radius);
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    letter-spacing: 0.03em;
    text-decoration: none;
    white-space: nowrap;
  }
  .btn-accent  { background: var(--accent);  color: #111; }
  .btn-accent:hover  { background: #d4f55a; }
  .btn-green   { background: var(--accent2); color: #111; }
  .btn-green:hover   { background: #22c55e; }
  .btn-danger  { background: transparent; border: 1px solid var(--danger); color: var(--danger); }
  .btn-danger:hover  { background: rgba(239,68,68,0.1); }
  .btn-ghost   { background: transparent; border: 1px solid var(--border); color: var(--muted); }
  .btn-ghost:hover   { border-color: var(--accent); color: var(--accent); }
  .btn-red     { background: var(--danger); color: #fff; }
  .btn-red:hover     { background: #dc2626; }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
  }

  .card-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 12px;
  }

  .tab {
    padding: 5px 12px;
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
  }
  .tab:hover { color: var(--text); border-color: var(--muted); }
  .tab.active { background: var(--accent); color: #111; border-color: var(--accent); }

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
  }
  td input:hover { border-color: var(--border); background: var(--surface2); }
  td input:focus { border-color: var(--accent); background: var(--surface2); }

  .mono { font-family: var(--font-mono); }
  .muted { color: var(--muted); }
  .accent { color: var(--accent); }
  .right { text-align: right; }

  .timer-display {
    font-family: var(--font-mono);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .dagssum td {
    background: rgba(200,241,53,0.04);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    font-weight: 600;
    border-bottom: 2px solid var(--border);
  }

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

  .summary-chip {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 14px;
    min-width: 100px;
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
    margin-top: 2px;
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
      .subscribe((status) => { if (status === "SUBSCRIBED") setChannelJoined(true); });
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
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) console.warn(error.message);
    }
  }

  async function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    if (supabase && session?.user) {
      const current = entries.find(e => e.id === id);
      if (!current) return;
      const { error } = await supabase.from("time_entries").update(toDbUpdate({ ...current, ...patch })).eq("id", id);
      if (error) console.warn(error.message);
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
      const { error } = await supabase.from("time_entries").insert(toDbRow(entry, session.user.id));
      setSaving(false);
      if (error) console.warn(error.message);
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
  async function signOut() { await supabase?.auth.signOut(); }

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

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

        {/* HEADER */}
        <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

              {/* Logo */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
                <div style={{ width: 28, height: 28, background: "var(--accent)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>T</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.04em" }}>TIMEREG</span>
              </div>

              {saving && <span className="muted pulse" style={{ fontSize: 11 }}>● lagrer…</span>}

              {!session?.user ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="email" style={{ width: 220 }} placeholder="E‑post for skylagring" value={email}
                    onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMagicLink()} />
                  <button className="btn btn-ghost" onClick={sendMagicLink}>Send innloggingslenke</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span className="muted">Innlogget som</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{session.user.email}</span>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={signOut}>Logg ut</button>
                </div>
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" onClick={exportXLSX}>↓ Excel</button>
                <button className="btn btn-danger" style={{ padding: "5px 12px", fontSize: 12 }} onClick={clearLocal}>Tøm lokalt</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <a href="#/" className={`tab ${!isAdminRoute ? "active" : ""}`}>Registrering</a>
              {isAdmin && <a href="#/admin" className={`tab ${isAdminRoute ? "active" : ""}`}>Admin</a>}
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px", display: "grid", gap: 12 }}>
          {isAdminRoute ? (
            isAdmin ? <AdminPanel entries={entries} /> : (
              <div className="card"><p style={{ color: "var(--danger)" }}>Ingen tilgang – du må være admin.</p></div>
            )
          ) : (
            <>
              <TimerCard running={running} onStart={startTimer} onStop={stopTimer} projects={projects} />
              <ManualEntryCard projects={projects} onAdd={addManualEntry} />

              <div className="card">
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    <div>
                      <label>Visning</label>
                      <select value={view} onChange={e => setView(e.target.value as any)} style={{ width: 100 }}>
                        <option value="day">Dag</option>
                        <option value="week">Uke</option>
                        <option value="all">Alle</option>
                      </select>
                    </div>
                    {view !== "all" && (
                      <div>
                        <label>Dato</label>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 150 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <div className="summary-chip">
                      <div className="val">{formatHM(grandTotal)}</div>
                      <div className="lbl">Totalt</div>
                    </div>
                  </div>
                </div>

                <TableEditable entries={filtered} projects={projects} totals={totals} onUpdate={updateEntry} onDelete={deleteEntry} />

                {filtered.length === 0 && (
                  <p style={{ textAlign: "center", color: "var(--muted)", padding: "32px 0", fontSize: 13 }}>
                    Ingen registreringer for valgt periode.
                  </p>
                )}
              </div>

              {session?.user && <ImportBox onImported={loadCloudEntries} />}
            </>
          )}
        </main>
      </div>
    </>
  );
}

/* ─── TimerCard ─────────────────────────────────────────────────────────── */
function TimerCard({ running, onStart, onStop, projects }: {
  running: { id: string; project: string; activity?: string; notes?: string; startTs: number } | null;
  onStart: (p: string, a?: string, n?: string) => void;
  onStop: () => void;
  projects: string[];
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (running) { setProject(running.project); setActivity(running.activity || ""); setNotes(running.notes || ""); } }, [running]);

  const elapsedMs = useElapsed(running?.startTs ?? null);
  const elapsedMin = elapsedMs !== null ? Math.floor(elapsedMs / 60000) : null;

  return (
    <div className="card">
      <div className="card-title">⏱ Timer</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 160px" }}>
          <label>Arbeidssted</label>
          <input value={project} onChange={e => setProject(e.target.value)} list="timer-projects" placeholder="Skriv eller velg" disabled={!!running} />
          <datalist id="timer-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label>Ordrenr</label>
          <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
        </div>
        <div style={{ flex: "2 1 200px" }}>
          <label>Notater</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" disabled={!!running} />
        </div>
        <div style={{ textAlign: "center", minWidth: 90 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>Tid</div>
          <div className="timer-display" style={{ color: running ? "var(--accent)" : "var(--border)" }}>
            {elapsedMin !== null ? formatHM(elapsedMin) : "--:--"}
          </div>
        </div>
        {!running
          ? <button className="btn btn-green" onClick={() => onStart(project, activity, notes)}>▶ Start</button>
          : <button className="btn btn-red" onClick={onStop}>■ Stopp &amp; lagre</button>
        }
      </div>
      {running && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>
          <span className="tag">kjører</span>{" "}
          Startet {formatTime(new Date(running.startTs))} · {running.project}{running.activity ? ` · ${running.activity}` : ""}
        </div>
      )}
    </div>
  );
}

/* ─── ManualEntryCard ───────────────────────────────────────────────────── */
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

  return (
    <div className="card">
      <div className="card-title">+ Legg inn manuelt</div>
      {/* FIX: auto-fill grid – ingen overflow */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, alignItems: "end" }}>
        <div>
          <label>Dato</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label>Arbeidssted</label>
          <input value={project} onChange={e => setProject(e.target.value)} list="manual-projects" placeholder="Skriv eller velg" />
          <datalist id="manual-projects">{projects.map(p => <option value={p} key={p} />)}</datalist>
        </div>
        <div>
          <label>Ordrenr</label>
          <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>Notater</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div>
          <label>Start</label>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div>
          <label>Slutt</label>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        <div>
          <label>Minutter</label>
          <input type="number" min={0} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Auto" />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button className="btn btn-accent"
            onClick={() => onAdd({ date, project, activity, notes, start, end, minutes: minutes ? Number(minutes) : 0 })}>
            Legg til
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TableEditable ─────────────────────────────────────────────────────── */
function TableEditable({ entries, projects, totals, onUpdate, onDelete }: {
  entries: Entry[];
  projects: string[];
  totals: Record<string, number>;
  onUpdate: (id: string, patch: Partial<Entry>) => void;
  onDelete: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) { const arr = map.get(e.date) ?? []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Dato</th><th>Arbeidssted</th><th>Ordrenr</th><th>Notater</th>
            <th>Start</th><th>Slutt</th>
            <th className="right">Min</th><th className="right">Timer</th><th></th>
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
                  <td><input type="text" value={e.notes || ""} onChange={ev => onUpdate(e.id, { notes: ev.target.value })} style={{ width: 200 }} /></td>
                  <td>
                    <input type="time" value={e.start || ""} style={{ width: 90 }}
                      onChange={ev => { const s = ev.target.value; const m = s && e.end ? diffMinutes(s, e.end) : e.minutes; onUpdate(e.id, { start: s, minutes: m }); }} />
                  </td>
                  <td>
                    <input type="time" value={e.end || ""} style={{ width: 90 }}
                      onChange={ev => { const en = ev.target.value; const m = e.start && en ? diffMinutes(e.start, en) : e.minutes; onUpdate(e.id, { end: en, minutes: m }); }} />
                  </td>
                  <td className="right">
                    <input type="number" value={e.minutes} min={0} step={5} style={{ width: 70, textAlign: "right" }}
                      onChange={ev => onUpdate(e.id, { minutes: Number(ev.target.value) })} />
                  </td>
                  <td className="right mono muted">{(e.minutes / 60).toFixed(2)}</td>
                  <td className="right">
                    <button className="btn btn-danger" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => onDelete(e.id)}>Slett</button>
                  </td>
                </tr>
              ))}
              {dayEntries.length > 1 && (
                <tr className="dagssum">
                  <td>{date}</td>
                  <td colSpan={5} style={{ color: "var(--muted)", fontStyle: "italic" }}>Dagssum</td>
                  <td className="right">{totals[date] ?? 0}</td>
                  <td className="right">{((totals[date] ?? 0) / 60).toFixed(2)}</td>
                  <td></td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── AdminPanel ────────────────────────────────────────────────────────── */
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
              <div className="lbl">{(mins / 60).toFixed(1)} timer</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-title">Pr. uke / ansatt</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Ansatt</th><th>Uke</th><th className="right">Timer</th><th className="right">Min</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((r, i) => (
                <tr key={i}>
                  <td className="mono muted" style={{ fontSize: 11 }}>{shortId(r.userId)}</td>
                  <td><span className="tag">{r.yearWeek}</span></td>
                  <td className="right mono" style={{ color: "var(--accent)" }}>{formatHM(r.minutes)}</td>
                  <td className="right mono muted">{r.minutes}</td>
                </tr>
              ))}
              {grouped.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>Ingen data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── ImportBox ─────────────────────────────────────────────────────────── */
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} disabled={busy} style={{ width: "auto" }} />
        {busy
          ? <span className="muted pulse" style={{ fontSize: 12 }}>Importerer…</span>
          : info && <span style={{ fontSize: 12, color: isError ? "var(--danger)" : "var(--accent2)" }}>{info}</span>
        }
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Kolonner: Dato, Arbeidssted, Ordrenr, Notater, Start, Slutt, Minutter.</p>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
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
  return elapsed; // millisekunder
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
