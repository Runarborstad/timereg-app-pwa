import React, { useEffect, useMemo, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/** Timeregistrering – med Supabase (auth + skylagring) + Admin-panel + Realtime + Import */

type Entry = {
  id: string;
  date: string;      // YYYY-MM-DD
  project: string;   // Arbeidssted
  activity?: string; // Ordrenr
  notes?: string;
  start?: string;    // HH:MM
  end?: string;      // HH:MM
  minutes: number;
  createdAt: number;
  userId?: string;   // for admin-visning
};

type DbRow = {
  id: string;
  user_id: string;
  date: string;
  project: string;
  activity: string | null;
  notes: string | null;
  start: string | null;   // HH:MM:SS
  end: string | null;     // HH:MM:SS
  minutes: number;
  created_at: string;
};

type Profile = { user_id: string; email: string | null; is_admin: boolean };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries());
  const [projects, setProjects] = useState<string[]>(() => loadProjects());
  const [running, setRunning] = useState<{ id: string; project: string; activity?: string; notes?: string; startTs: number } | null>(() => loadTimer());

  const [view, setView] = useState<"day" | "week" | "all">("day");
  const [filterDate, setFilterDate] = useState<string>(() => todayISO());

  // Auth & admin
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const isAdmin = !!profile?.is_admin;

  // Realtime channel (hold referanse for unsubscribe)
  const [channelJoined, setChannelJoined] = useState(false);

  // UI faner
  const [tab, setTab] = useState<"registrering" | "admin">("registrering");

  useInterval(running ? 1000 : null);

  // Persist lokalt
  useEffect(() => { localStorage.setItem("tt_entries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("tt_projects", JSON.stringify(projects)); }, [projects]);
  useEffect(() => {
    if (running) localStorage.setItem("tt_running", JSON.stringify(running));
    else localStorage.removeItem("tt_running");
  }, [running]);

  // Init auth
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { sub?.subscription?.unsubscribe(); };
  }, []);

  // Hent profil når innlogget
  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); return; }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,is_admin")
        .eq("user_id", session.user.id)
        .single();
      if (!error && data) setProfile(data as Profile);
    })();
  }, [session?.user?.id]);

  // Hent registreringer fra sky (admin: alle, ellers bare egne)
  async function loadCloudEntries() {
    if (!supabase || !session?.user) return;
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .order("date", { ascending: false })
      .limit(10000);
    if (error) { console.warn("Kunne ikke hente time_entries:", error.message); return; }

    const rows = (data ?? []) as DbRow[];
    const mapped: Entry[] = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      date: row.date,
      project: row.project,
      activity: row.activity ?? "",
      notes: row.notes ?? "",
      start: (row.start ?? "").slice(0, 5) || "",
      end: (row.end ?? "").slice(0, 5) || "",
      minutes: row.minutes,
      createdAt: new Date(row.created_at).getTime(),
    }));

    setEntries(mapped);
    const uniqueProjects = Array.from(new Set(mapped.map(e => e.project))).sort((a, b) => a.localeCompare(b));
    setProjects(uniqueProjects);
  }

  // Hent data når innlogget (og hver gang admin-status endres)
  useEffect(() => {
    if (!supabase || !session?.user) return;
    loadCloudEntries();
  }, [session?.user?.id, isAdmin]);

  // Realtime: lytt på endringer i time_entries og refetch
  useEffect(() => {
    if (!supabase || !session?.user || channelJoined) return;
    const ch = supabase
      .channel("time_entries_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, () => {
        loadCloudEntries();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setChannelJoined(true);
      });
    return () => { supabase.removeChannel(ch); setChannelJoined(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, channelJoined]);

  // Avledede summer
  const filtered = useMemo(() => filterEntries(entries, view, filterDate), [entries, view, filterDate]);
  const totals = useMemo(() => sumMinutesByDate(filtered), [filtered]);
  const grandTotal = useMemo(() => filtered.reduce((a, e) => a + e.minutes, 0), [filtered]);

  // CRUD (lokal + sky)
  function addProject(name: string) {
    const n = name.trim();
    if (!n) return;
    if (!projects.includes(n)) setProjects([...projects, n].sort((a, b) => a.localeCompare(b)));
  }

  async function addManualEntry(data: Partial<Entry>) {
    const id = cryptoRandomId();
    const date = data.date || todayISO();
    const project = (data.project || "").trim();
    if (!project) return alert("Velg/skriv et arbeidssted");

    const start = data.start?.trim();
    const end = data.end?.trim();

    let minutes = Number(data.minutes) || 0;
    if (!minutes && start && end) {
      minutes = diffMinutes(start, end);
      if (minutes <= 0) return alert("Sluttid må være etter starttid");
    }
    if (!minutes) return alert("Oppgi varighet eller start/slutt");

    const entry: Entry = {
      id, date, project,
      activity: data.activity?.trim() || "",
      notes: data.notes?.trim() || "",
      start: start || "", end: end || "",
      minutes, createdAt: Date.now(), userId: session?.user?.id,
    };
    setEntries((prev) => [entry, ...prev]);
    addProject(project);

    if (supabase && session?.user) {
      const { error } = await supabase.from("time_entries").insert(toDbRow(entry, session.user.id));
      if (error) console.warn("Lagring i sky feilet:", error.message);
    }
  }

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (supabase && session?.user) {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) console.warn("Sletting i sky feilet:", error.message);
    }
  }

  async function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (supabase && session?.user) {
      const current = entries.find(e => e.id === id);
      const merged = current ? { ...current, ...patch } : undefined;
      if (!merged) return;
      const { error } = await supabase.from("time_entries").update(toDbUpdate(merged)).eq("id", id);
      if (error) console.warn("Oppdatering i sky feilet:", error.message);
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
      id: cryptoRandomId(),
      date: todayISO(),
      project: running.project,
      activity: running.activity || "",
      notes: running.notes || "",
      start: formatTime(new Date(start)),
      end: formatTime(new Date(end)),
      minutes,
      createdAt: Date.now(),
      userId: session?.user?.id,
    };
    setEntries(prev => [entry, ...prev]);
    setRunning(null);

    if (supabase && session?.user) {
      const { error } = await supabase.from("time_entries").insert(toDbRow(entry, session.user.id));
      if (error) console.warn("Lagring i sky feilet:", error.message);
    }
  }

  function clearLocal() {
    if (!confirm("Slette alle lokale registreringer? (Skydata påvirkes ikke)")) return;
    setEntries([]);
    setRunning(null);
  }

  // Auth
  async function sendMagicLink() {
    if (!supabase) return alert("Supabase er ikke konfigurert.");
    if (!email.trim()) return alert("Skriv inn e‑postadresse");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) return alert("Kunne ikke sende innloggingslenke: " + error.message);
    alert("Sjekk e‑posten for innloggingslenke.");
  }
  async function signOut() { await supabase?.auth.signOut(); }

  // Eksport XLSX
  function exportXLSX() {
    const header = ["Dato", "Arbeidssted", "Ordrenr", "Notater", "Start", "Slutt", "Minutter", "Timer"];
    const rows = [
      header,
      ...entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => [
        e.date, e.project, e.activity || "", (e.notes || "").replace(/\r?\n/g, " "),
        e.start || "", e.end || "", e.minutes, (e.minutes / 60).toFixed(2),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Timer");
    XLSX.writeFile(wb, `timereg-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* TOPP */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold mr-4">Timeregistrering</h1>

          {!session?.user ? (
            <div className="flex items-center gap-2">
              <input type="email" className="border rounded-xl px-3 py-2" placeholder="E‑post for skylagring" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button onClick={sendMagicLink} className="px-3 py-2 rounded-2xl border hover:bg-gray-50">Send innloggingslenke</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              Innlogget som <span className="font-medium">{session.user.email}</span>
              <button onClick={signOut} className="px-2 py-1 rounded-lg border hover:bg-gray-50">Logg ut</button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportXLSX} className="px-3 py-2 rounded-2xl border hover:bg-gray-50">Eksporter Excel</button>
            <button onClick={clearLocal} className="px-3 py-2 rounded-2xl border hover:bg-red-50">Tøm lokalt</button>
          </div>

          {/* Faner */}
          <div className="w-full flex gap-2 mt-2">
            <button onClick={() => setTab("registrering")} className={`px-3 py-1 rounded-xl border ${tab === "registrering" ? "bg-gray-100" : ""}`}>Registrering</button>
            {isAdmin && (
              <button onClick={() => setTab("admin")} className={`px-3 py-1 rounded-xl border ${tab === "admin" ? "bg-gray-100" : ""}`}>Admin</button>
            )}
          </div>
        </div>
      </header>

      {/* INNHOLD */}
      <main className="max-w-6xl mx-auto p-4 grid gap-4">
        {tab === "registrering" ? (
          <>
            <TimerCard running={running} onStart={startTimer} onStop={stopTimer} projects={projects} />
            <ManualEntryCard projects={projects} onAdd={addManualEntry} onCreateProject={addProject} />

            <section className="bg-white rounded-2xl shadow p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="text-sm">Visning</label>
                  <select value={view} onChange={(e) => setView(e.target.value as any)} className="border rounded-xl px-3 py-2">
                    <option value="day">Dag</option>
                    <option value="week">Uke</option>
                    <option value="all">Alle</option>
                  </select>
                </div>
                {view !== "all" && (
                  <div className="flex flex-col">
                    <label className="text-sm">Dato</label>
                    <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="border rounded-xl px-3 py-2" />
                  </div>
                )}
                <div className="ml-auto text-right">
                  <div className="text-sm text-gray-500">Totalt</div>
                  <div className="text-2xl font-semibold">{formatHM(grandTotal)}</div>
                </div>
              </div>

              <TableEditable
                entries={filtered}
                projects={projects}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            </section>
          </>
        ) : (
          <AdminPanel entries={entries} />
        )}
      </main>

      {/* Import (vises i begge faner) */}
      {session?.user && (
        <section className="max-w-6xl mx-auto p-4">
          <ImportBox onImported={loadCloudEntries} />
        </section>
      )}
    </div>
  );
}

/*** ----------- Komponenter ----------- ***/

function TimerCard({ running, onStart, onStop, projects }: {
  running: { id: string; project: string; activity?: string; notes?: string; startTs: number } | null;
  onStart: (project: string, activity?: string, notes?: string) => void;
  onStop: () => void;
  projects: string[];
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (running) { setProject(running.project); setActivity(running.activity || ""); setNotes(running.notes || ""); } }, [running]);
  const elapsed = useElapsed(running?.startTs ?? null);
  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-40">
          <label className="text-sm">Arbeidssted</label>
          <input className="w-full border rounded-xl px-3 py-2" value={project} onChange={(e) => setProject(e.target.value)} list="project-list" placeholder="Skriv eller velg arbeidssted" />
          <datalist id="project-list">{projects.map((p) => (<option value={p} key={p} />))}</datalist>
        </div>
        <div className="flex-1 min-w-40">
          <label className="text-sm">Ordrenr (valgfritt)</label>
          <input className="w-full border rounded-xl px-3 py-2" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Skriv eller velg ordrenr" />
        </div>
        <div className="flex-[2] min-w-60">
          <label className="text-sm">Notater (valgfritt)</label>
          <input className="w-full border rounded-xl px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="ml-auto text-center">
          <div className="text-sm text-gray-500">Tid</div>
          <div className="text-3xl font-semibold tabular-nums">{formatHM(Math.floor((elapsed ?? 0) / 60))}</div>
        </div>
        {!running ? (
          <button onClick={() => onStart(project, activity, notes)} className="px-4 py-2 rounded-2xl border bg-green-600 text-white">Start</button>
        ) : (
          <button onClick={onStop} className="px-4 py-2 rounded-2xl border bg-red-600 text-white">Stopp & lagre</button>
        )}
      </div>
    </section>
  );
}

function ManualEntryCard({ projects, onAdd, onCreateProject }: {
  projects: string[];
  onAdd: (data: any) => void;
  onCreateProject: (name: string) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [minutes, setMinutes] = useState<number>(0);
  useEffect(() => { if (start && end) setMinutes(diffMinutes(start, end)); }, [start, end]);

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold mb-2">Legg inn manuelt</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div><label className="text-sm">Dato</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="text-sm">Arbeidssted</label><input type="text" className="w-full border rounded-xl px-3 py-2" value={project} onChange={(e) => setProject(e.target.value)} list="project-list" placeholder="Skriv eller velg arbeidssted" /></div>
        <div><label className="text-sm">Ordrenr</label><input type="text" className="w-full border rounded-xl px-3 py-2" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Skriv eller velg ordrenr" /></div>
        <div className="lg:col-span-2"><label className="text-sm">Notater</label><input type="text" className="w-full border rounded-xl px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-sm">Start</label><input type="time" className="w-full border rounded-xl px-3 py-2" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="flex-1"><label className="text-sm">Slutt</label><input type="time" className="w-full border rounded-xl px-3 py-2" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div><label className="text-sm">Minutter</label><input type="number" min={0} step={5} className="w-full border rounded-xl px-3 py-2" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} placeholder="eller beregnes fra start/slutt" /></div>
        <div className="lg:col-span-6 flex items-center gap-2">
          <button onClick={() => onAdd({ date, project, activity, notes, start, end, minutes })} className="px-4 py-2 rounded-2xl border bg-blue-600 text-white">Legg til</button>
          <button onClick={() => onCreateProject(project)} className="px-3 py-2 rounded-2xl border">Legg til nytt arbeidssted</button>
        </div>
      </div>
    </section>
  );
}

function TableEditable({ entries, projects, onUpdate, onDelete }: {
  entries: Entry[];
  projects: string[];
  onUpdate: (id: string, patch: Partial<Entry>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-2">Dato</th>
            <th className="py-2 pr-2">Arbeidssted</th>
            <th className="py-2 pr-2">Ordrenr</th>
            <th className="py-2 pr-2">Notater</th>
            <th className="py-2 pr-2">Start</th>
            <th className="py-2 pr-2">Slutt</th>
            <th className="py-2 pr-2 text-right">Min</th>
            <th className="py-2 pr-2 text-right">Timer</th>
            <th className="py-2 pr-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b hover:bg-gray-50">
              <td className="py-2 pr-2">
                <input
                  type="date"
                  value={e.date}
                  onChange={(ev) => onUpdate(e.id, { date: ev.target.value })}
                  className="border rounded-lg px-2 py-1"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  value={e.project}
                  onChange={(ev) => onUpdate(e.id, { project: ev.target.value })}
                  className="border rounded-lg px-2 py-1 w-40"
                  list="project-list"
                />
                <datalist id="project-list">
                  {projects.map((p) => (
                    <option value={p} key={p} />
                  ))}
                </datalist>
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  value={e.activity || ""}
                  onChange={(ev) => onUpdate(e.id, { activity: ev.target.value })}
                  className="border rounded-lg px-2 py-1 w-40"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  value={e.notes || ""}
                  onChange={(ev) => onUpdate(e.id, { notes: ev.target.value })}
                  className="border rounded-lg px-2 py-1 w-64"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="time"
                  value={e.start || ""}
                  onChange={(ev) => {
                    const start = ev.target.value;
                    const end = e.end;
                    let minutes = e.minutes;
                    if (start && end) minutes = diffMinutes(start, end);
                    onUpdate(e.id, { start, minutes });
                  }}
                  className="border rounded-lg px-2 py-1 w-24"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="time"
                  value={e.end || ""}
                  onChange={(ev) => {
                    const end = ev.target.value;
                    const start = e.start;
                    let minutes = e.minutes;
                    if (start && end) minutes = diffMinutes(start, end);
                    onUpdate(e.id, { end, minutes });
                  }}
                  className="border rounded-lg px-2 py-1 w-24"
                />
              </td>
              <td className="py-2 pr-2 text-right">
                <input
                  type="number"
                  value={e.minutes}
                  min={0}
                  step={5}
                  onChange={(ev) => onUpdate(e.id, { minutes: Number(ev.target.value) })}
                  className="border rounded-lg px-2 py-1 w-20 text-right"
                />
              </td>
              <td className="py-2 pr-2 text-right">{(e.minutes / 60).toFixed(2)}</td>
              <td className="py-2 pr-2 text-right">
                <button
                  onClick={() => onDelete(e.id)}
                  className="px-2 py-1 rounded-lg border hover:bg-red-50"
                >
                  Slett
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ---------------- Admin-panel (uke/ansatt) ---------------- */
function AdminPanel({ entries }: { entries: Entry[] }) {
  // Grupper per userId + uke
  const grouped = useMemo(() => {
    const map = new Map<string, number>(); // key: `${userId}|${year}-W${week}`
    for (const e of entries) {
      const keyUser = e.userId || "ukjent";
      const { year, week } = getISOWeek(e.date);
      const key = `${keyUser}|${year}-W${String(week).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + e.minutes);
    }
    // til array
    const rows = Array.from(map.entries()).map(([k, mins]) => {
      const [userId, yw] = k.split("|");
      return { userId, yearWeek: yw, minutes: mins };
    });
    // sorter nyeste uke først
    rows.sort((a, b) => (a.yearWeek < b.yearWeek ? 1 : a.yearWeek > b.yearWeek ? -1 : 0));
    return rows;
  }, [entries]);

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold mb-3">Admin – summering pr. uke / ansatt</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Ansatt (userId)</th>
              <th className="py-2 pr-4">Uke</th>
              <th className="py-2 pr-4 text-right">Minutter</th>
              <th className="py-2 pr-4 text-right">Timer</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((r, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">{r.userId}</td>
                <td className="py-2 pr-4">{r.yearWeek}</td>
                <td className="py-2 pr-4 text-right">{r.minutes}</td>
                <td className="py-2 pr-4 text-right">{(r.minutes / 60).toFixed(2)}</td>
              </tr>
            ))}
            {grouped.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-gray-500">Ingen data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** ---------------- Import fra CSV/XLSX til sky ---------------- */
function ImportBox({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string>("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setInfo("");

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      // Støtter både norske og store overskrifter
      // Forventede kolonner: Dato, Arbeidssted, Ordrenr, Notater, Start, Slutt, Minutter, Timer
      const toEntry = (r: any): Omit<Entry, "id" | "createdAt"> | null => {
        const date = normalizeDate(r.Dato || r.dato || r.Date);
        const project = (r.Arbeidssted || r.prosjekt || r.Project || "").toString().trim();
        const activity = (r.Ordrenr || r.ordrenr || r.Activity || "").toString().trim();
        const notes = (r.Notater || r.notater || r.Notes || "").toString();
        const start = normalizeTime(r.Start || r.start);
        const end = normalizeTime(r.Slutt || r.slutt || r.End);
        let minutes = Number(r.Minutter || r.minutter || r.Minutes || 0);
        if (!minutes && start && end) minutes = diffMinutes(start, end);
        if (!date || !project || !minutes) return null;

        return { date, project, activity, notes, start, end, minutes } as any;
      };

      const list = rows.map(toEntry).filter(Boolean) as any[];
      if (!list.length) {
        setInfo("Fant ingen gyldige rader i filen.");
        setBusy(false);
        return;
      }

      if (!supabase) throw new Error("Supabase ikke konfigurert.");
      const { data: s } = await supabase.auth.getSession();
      const userId = s?.session?.user?.id;
      if (!userId) throw new Error("Du må være innlogget for å importere.");

      // Batch-innsett (100 og 100)
      const chunks: any[][] = [];
      for (let i = 0; i < list.length; i += 100) chunks.push(list.slice(i, i + 100));

      let inserted = 0;
      for (const chunk of chunks) {
        const payload = chunk.map((e) => toDbRow({ id: cryptoRandomId(), createdAt: Date.now(), ...e }, userId));
        const { error, count } = await supabase
          .from("time_entries")
          .insert(payload, { count: "exact" });
        if (error) throw error;
        inserted += count || payload.length;
      }

      setInfo(`Importert ${inserted} rader.`);
      onImported();
    } catch (err: any) {
      setInfo("Import feilet: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
      (e.target as HTMLInputElement).value = "";
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="font-semibold mb-2">Importér til sky (CSV/XLSX)</h3>
      <div className="flex items-center gap-3">
        <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
               onChange={handleFile} disabled={busy}/>
        {busy ? <span>Importerer…</span> : <span className="text-gray-500 text-sm">{info}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Støtter kolonnene: Dato, Arbeidssted, Ordrenr, Notater, Start, Slutt, Minutter (Timer er valgfritt).
      </p>
    </div>
  );
}

/** ---------------- HJELPERE ---------------- */
function getISOWeek(dateISO: string) {
  const d = new Date(dateISO);
  // Torsdag i inneværende uke
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: target.getFullYear(), week };
}

function normalizeDate(v: string) {
  if (!v) return "";
  // aksepter dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

function normalizeTime(v: string) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return "";
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${hh}:${mm}`;
}

/** ------- Manglende hjelpere: ID + DB-mapping ------- */
function cryptoRandomId() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function toDbRow(e: Entry, userId: string) {
  // Konverterer en Entry til format for INSERT i Supabase
  return {
    id: e.id,
    user_id: userId,
    date: e.date, // 'YYYY-MM-DD'
    project: e.project,
    activity: e.activity || null,
    notes: e.notes || null,
    start: e.start ? `${e.start}:00` : null, // 'HH:MM:SS' eller null
    end: e.end ? `${e.end}:00` : null,
    minutes: e.minutes,
    created_at: new Date(e.createdAt).toISOString(),
  };
}

function toDbUpdate(e: Entry) {
  // Felt brukt ved UPDATE (uten id/user_id)
  return {
    date: e.date,
    project: e.project,
    activity: e.activity || null,
    notes: e.notes || null,
    start: e.start ? `${e.start}:00` : null,
    end: e.end ? `${e.end}:00` : null,
    minutes: e.minutes,
  };
}

/** ------- Hjelpehooks og formateringsfunksjoner ------- */

// Ticker som brukes til å vise medgått tid mens timeren kjører
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

// Dagens dato i lokal tid som YYYY-MM-DD
function todayISO() {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

// Forskjell i minutter mellom "HH:MM" → "HH:MM"
function diffMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return e - s;
}

// Formater Date → "HH:MM"
function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Formater minutter til "HH:MM"
function formatHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
