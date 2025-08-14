import React, { useEffect, useMemo, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/**
 * Timeregistrering – PWA med Supabase skylagring
 * - Innlogging via e-post (magic link)
 * - Hvis innlogget: henter/lagrer timer i Supabase (per bruker)
 * - Hvis ikke innlogget: alt lagres lokalt (localStorage)
 * - Eksport til Excel (.xlsx)
 *
 * Feltnavn i UI:
 *  - project  => "Arbeidssted"
 *  - activity => "Ordrenr"
 */

type Entry = {
  id: string;
  date: string;     // ISO yyyy-mm-dd
  project: string;  // Arbeidssted
  activity?: string; // Ordrenr
  notes?: string;
  start?: string;   // HH:mm
  end?: string;     // HH:mm
  minutes: number;
  createdAt: number; // client-side ts (brukes lokalt)
};

type DbRow = {
  id: string;
  user_id: string;
  date: string;     // 'YYYY-MM-DD' (date)
  project: string;
  activity: string | null;
  notes: string | null;
  start: string | null; // 'HH:MM:SS'
  end: string | null;   // 'HH:MM:SS'
  minutes: number;
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function TimeTrackerApp() {
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries());
  const [projects, setProjects] = useState<string[]>(() => loadProjects());
  const [running, setRunning] = useState<{ id: string; project: string; activity?: string; notes?: string; startTs: number } | null>(() => loadTimer());

  const [view, setView] = useState<"day" | "week" | "all">("day");
  const [filterDate, setFilterDate] = useState<string>(() => todayISO());

  // Auth
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState<string>("");
  const loggedIn = !!session?.user;

  // re-render klokke mens timer kjører
  useInterval(running ? 1000 : null);

  // Persist local state
  useEffect(() => { localStorage.setItem("tt_entries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("tt_projects", JSON.stringify(projects)); }, [projects]);
  useEffect(() => {
    if (running) localStorage.setItem("tt_running", JSON.stringify(running));
    else localStorage.removeItem("tt_running");
  }, [running]);

  // Init Supabase session & subscription
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    return () => { sub?.subscription?.unsubscribe(); };
  }, []);

  // Når vi logger inn: hent sky-data og slå sammen med lokal cache (enkel strategi: sky vinner)
  useEffect(() => {
    if (!supabase || !loggedIn) return;

    (async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("date", { ascending: false })
        .limit(2000);

      if (error) {
        console.warn("Kunne ikke hente data fra Supabase:", error.message);
        return;
      }

      const rows = (data ?? []) as DbRow[];
      const mapped: Entry[] = rows.map(row => ({
        id: row.id,
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
      // Oppdater forslag til arbeidssteder
      const uniqueProjects = Array.from(new Set(mapped.map(e => e.project))).sort((a, b) => a.localeCompare(b));
      setProjects(uniqueProjects);
    })();
  }, [loggedIn]);

  // Avledede data
  const filtered = useMemo(() => filterEntries(entries, view, filterDate), [entries, view, filterDate]);
  const totals = useMemo(() => sumMinutesByDate(filtered), [filtered]);
  const grandTotal = useMemo(() => filtered.reduce((a, e) => a + e.minutes, 0), [filtered]);

  // ---- UI handlers ----
  function addProject(name: string) {
    const n = (name ?? "").trim();
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
      id,
      date,
      project,
      activity: data.activity?.trim() || "",
      notes: data.notes?.trim() || "",
      start: start || "",
      end: end || "",
      minutes,
      createdAt: Date.now(),
    };

    setEntries(prev => [entry, ...prev]);
    addProject(project);

    // sky-lagring hvis innlogget
    if (supabase && loggedIn && session?.user) {
      const payload = toDbRow(entry, session.user.id);
      const { error } = await supabase.from("time_entries").insert(payload);
      if (error) console.warn("Kunne ikke lagre til sky:", error.message);
    }
  }

  async function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));

    if (supabase && loggedIn) {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) console.warn("Sletting i sky feilet:", error.message);
    }
  }

  async function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));

    if (supabase && loggedIn) {
      // Finn ny versjon i minnet
      const after = entries.find(e => e.id === id);
      const merged: Entry | undefined = after ? { ...after, ...patch } : undefined;
      if (!merged || !session?.user) return;

      const payload = toDbUpdate(merged);
      const { error } = await supabase.from("time_entries").update(payload).eq("id", id);
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
    };
    setEntries(prev => [entry, ...prev]);
    setRunning(null);

    if (supabase && loggedIn && session?.user) {
      const payload = toDbRow(entry, session.user.id);
      const { error } = await supabase.from("time_entries").insert(payload);
      if (error) console.warn("Kunne ikke lagre stoppet timer til sky:", error.message);
    }
  }

  function clearAll() {
    if (!confirm("Slette alle registreringer lokalt? (Skydata påvirkes ikke)")) return;
    setEntries([]);
    setRunning(null);
  }

  // ---- Auth ----
  async function sendMagicLink() {
    if (!supabase) return alert("Supabase er ikke konfigurert.");
    if (!email.trim()) return alert("Skriv inn e‑postadresse");

    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) return alert("Kunne ikke sende innloggingslenke: " + error.message);
    alert("Sjekk e‑posten din for innloggingslenke.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  // ---- Export XLSX ----
  function exportXLSX() {
    const header = ["Dato", "Arbeidssted", "Ordrenr", "Notater", "Start", "Slutt", "Minutter", "Timer"];
    const rows = [
      header,
      ...entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => [
        e.date,
        e.project,
        e.activity || "",
        (e.notes || "").replace(/\r?\n/g, " "),
        e.start || "",
        e.end || "",
        e.minutes,
        (e.minutes / 60).toFixed(2),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)["!cols"] = [
      { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 40 },
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timer");
    const filename = `timeregistrering-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-2xl font-bold">Timeregistrering</h1>

            {/* Auth UI */}
            {!loggedIn ? (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  className="border rounded-xl px-3 py-2"
                  placeholder="E‑post for skylagring"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button onClick={sendMagicLink} className="px-3 py-2 rounded-2xl shadow-sm border hover:bg-gray-50">
                  Send innloggingslenke
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                Innlogget som <span className="font-medium">{session!.user.email}</span>
                <button onClick={signOut} className="px-2 py-1 rounded-lg border hover:bg-gray-50">Logg ut</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportXLSX} className="px-3 py-2 rounded-2xl shadow-sm border hover:bg-gray-50">Eksporter Excel</button>
            <button onClick={clearAll} className="px-3 py-2 rounded-2xl shadow-sm border hover:bg-red-50">Tøm lokalt</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid gap-4">
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
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-2">
                      <input type="date" value={e.date} onChange={(ev) => updateEntry(e.id, { date: ev.target.value })} className="border rounded-lg px-2 py-1" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" value={e.project} onChange={(ev) => updateEntry(e.id, { project: ev.target.value })} className="border rounded-lg px-2 py-1 w-40" list="project-list" />
                      <datalist id="project-list">
                        {projects.map((p) => (<option value={p} key={p} />))}
                      </datalist>
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" value={e.activity || ""} onChange={(ev) => updateEntry(e.id, { activity: ev.target.value })} className="border rounded-lg px-2 py-1 w-40" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" value={e.notes || ""} onChange={(ev) => updateEntry(e.id, { notes: ev.target.value })} className="border rounded-lg px-2 py-1 w-64" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="time" value={e.start || ""} onChange={(ev) => {
                        const start = ev.target.value; const end = e.end; let minutes = e.minutes;
                        if (start && end) minutes = diffMinutes(start, end);
                        updateEntry(e.id, { start, minutes });
                      }} className="border rounded-lg px-2 py-1 w-24" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="time" value={e.end || ""} onChange={(ev) => {
                        const end = ev.target.value; const start = e.start; let minutes = e.minutes;
                        if (start && end) minutes = diffMinutes(start, end);
                        updateEntry(e.id, { end, minutes });
                      }} className="border rounded-lg px-2 py-1 w-24" />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input type="number" value={e.minutes} min={0} step={5} onChange={(ev) => updateEntry(e.id, { minutes: Number(ev.target.value) })} className="border rounded-lg px-2 py-1 w-20 text-right" />
                    </td>
                    <td className="py-2 pr-2 text-right">{(e.minutes / 60).toFixed(2)}</td>
                    <td className="py-2 pr-2 text-right">
                      <button onClick={() => deleteEntry(e.id)} className="px-2 py-1 rounded-lg border hover:bg-red-50">Slett</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {Object.keys(totals).length > 1 && (
                  <tr>
                    <td colSpan={9} className="pt-3">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.entries(totals).map(([date, mins]) => (
                          <div key={date} className="border rounded-xl p-2 flex items-center justify-between">
                            <span className="font-medium">{date}</span>
                            <span className="tabular-nums">{formatHM(mins)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------------- TimerCard ---------------- */
function TimerCard({ running, onStart, onStop, projects }: {
  running: { id: string; project: string; activity?: string; notes?: string; startTs: number } | null;
  onStart: (project: string, activity?: string, notes?: string) => void;
  onStop: () => void;
  projects: string[];
}) {
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (running) {
      setProject(running.project);
      setActivity(running.activity || "");
      setNotes(running.notes || "");
    }
  }, [running]);

  const elapsed = useElapsed(running?.startTs ?? null);

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-40">
          <label className="text-sm">Arbeidssted</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            list="project-list"
            placeholder="Skriv eller velg arbeidssted"
          />
          <datalist id="project-list">
            {projects.map((p) => (<option value={p} key={p} />))}
          </datalist>
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
          <button onClick={() => onStart(project, activity, notes)} className="px-4 py-2 rounded-2xl shadow-sm border bg-green-600 text-white hover:opacity-90">
            Start
          </button>
        ) : (
          <button onClick={onStop} className="px-4 py-2 rounded-2xl shadow-sm border bg-red-600 text-white hover:opacity-90">
            Stopp & lagre
          </button>
        )}
      </div>
    </section>
  );
}

/* -------------- ManualEntryCard -------------- */
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
        <div>
          <label className="text-sm">Dato</label>
          <input type="date" className="w-full border rounded-xl px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Arbeidssted</label>
          <input type="text" className="w-full border rounded-xl px-3 py-2" value={project} onChange={(e) => setProject(e.target.value)} list="project-list" placeholder="Skriv eller velg arbeidssted" />
        </div>
        <div>
          <label className="text-sm">Ordrenr</label>
          <input type="text" className="w-full border rounded-xl px-3 py-2" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Skriv eller velg ordrenr" />
        </div>
        <div className="lg:col-span-2">
          <label className="text-sm">Notater</label>
          <input type="text" className="w-full border rounded-xl px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm">Start</label>
            <input type="time" className="w-full border rounded-xl px-3 py-2" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-sm">Slutt</label>
            <input type="time" className="w-full border rounded-xl px-3 py-2" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm">Minutter</label>
          <input
            type="number"
            min={0}
            step={5}
            className="w-full border rounded-xl px-3 py-2"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            placeholder="eller beregnes fra start/slutt"
          />
        </div>
        <div className="lg:col-span-6 flex items-center gap-2">
          <button onClick={() => onAdd({ date, project, activity, notes, start, end, minutes })} className="px-4 py-2 rounded-2xl shadow-sm border bg-blue-600 text-white hover:opacity-90">
            Legg til
          </button>
          <button onClick={() => onCreateProject(project)} className="px-3 py-2 rounded-2xl shadow-sm border hover:bg-gray-50">
            Legg til nytt arbeidssted
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Utils ---------------- */
function useInterval(delay: number | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => setTick((x) => x + 1), delay);
    return () => clearInterval(id);
  }, [delay]);
  return null;
}

function useElapsed(startTs: number | null) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    if (!startTs) { setElapsed(null); return; }
    const update = () => setElapsed(Date.now() - startTs);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTs]);
  return elapsed;
}

function todayISO() {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function diffMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return e - s;
}

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sumMinutesByDate(list: any[]) {
  return list.reduce((acc: Record<string, number>, e: any) => {
    acc[e.date] = (acc[e.date] || 0) + e.minutes;
    return acc;
  }, {} as Record<string, number>);
}

function filterEntries(entries: any[], view: "day" | "week" | "all", baseDateISO: string) {
  if (view === "all") return entries;
  const base = new Date(baseDateISO);
  const start = new Date(base);
  const end = new Date(base);
  if (view === "week") {
    const day = (base.getDay() + 6) % 7;
    start.setDate(base.getDate() - day);
    end.setDate(start.getDate() + 6);
  }
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= startISO && e.date <= endISO);
}

function loadEntries() {
  try {
    const raw = localStorage.getItem("tt_entries");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch { return []; }
}

function loadProjects() {
  try {
    const raw = localStorage.getItem("tt_projects");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch { return []; }
}

function loadTimer() {
  try {
    const raw = localStorage.getItem("tt_running");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.startTs) return null;
    return obj;
  } catch { return null; }
}

function cryptoRandomId() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2);
}

function toDbRow(e: Entry, userId: string) {
  // Konverterer Entry til rad for INSERT
  return {
    id: e.id,
    user_id: userId,
    date: e.date, // 'YYYY-MM-DD'
    project: e.project,
    activity: e.activity || null,
    notes: e.notes || null,
    start: e.start ? `${e.start}:00` : null,
    end: e.end ? `${e.end}:00` : null,
    minutes: e.minutes,
    created_at: new Date(e.createdAt).toISOString(),
  };
}

function toDbUpdate(e: Entry) {
  // Felt for UPDATE (uten user_id/id)
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
