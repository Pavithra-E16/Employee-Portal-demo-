"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import loginIllustration from "./assets/login-illustration.png";
import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  HeartPulse,
  Hourglass,
  House,
  Inbox,
  LayoutDashboard,
  Mail,
  Plane,
  UserCheck,
  Users,
} from "lucide-react";

import { USERS, TABS, STAFF, HOUSES, CANDS, houseOf } from "../lib/data";
import {
  calcHours as calcHrs,
  checkSwap,
  timesheetChecks,
  hoursLedger,
  tillToday,
  initialsOf,
  LEAVE_TYPES,
  balances,
} from "../lib/hrm";
import {
  todayISO,
  fmtShort,
  fmtDay,
  fmtFull,
  fmtStamp,
  to12,
  to24,
  toMin,
  nowMinutes,
  periodRange,
  relDay,
  MONTHS,
  parseISO,
} from "../lib/dates";

// ---------- helpers ----------
// Only two roles exist: Employee and Admin. There is no Manager anywhere in this file.
const tabsOf = (w) => TABS[w] || [];
const cls = {
  Pending: "a",
  Approved: "g",
  Denied: "r",
  "Training required": "a",
  Sick: "a",
  Vacation: "a",
  Bereavement: "a",
  Incomplete: "r",
  Completed: "g",
  Active: "g",
  Inactive: "r",
};
const Pl = ({ t, c }) => (
  <span className={"pl " + (c ?? cls[t] ?? "")}>{t}</span>
);
const T = ({ head, children }) => (
  <div className="ov">
    <table>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
const KPI_ICONS = {
  "Hours today": Clock,
  "Hours this week": CalendarDays,
  "Hours this month": CalendarCheck,
  "Vacation remaining": Plane,
  "Sick remaining": HeartPulse,
  "Requests pending": Bell,
  "Active Jobs": Briefcase,
  "Total Candidates": Users,
  "Total Applications": ClipboardList,
  "New Today": Bell,
  "Interviews Scheduled": CalendarCheck,
  "Hired This Month": UserCheck,
  "Hours worked": Clock,
  "Employees worked": Users,
  "Completed timesheets": ClipboardCheck,
  "Incomplete timesheets": CircleAlert,
};
const KpiCard = ({ value, label }) => {
  const Icon = KPI_ICONS[label] || LayoutDashboard;
  return (
    <div className="card kpi">
      <div>
        <b>{value}</b>
        <span>{label}</span>
      </div>
      <div className="chip">
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      </div>
    </div>
  );
};
const byTime = (a, b) =>
  a.date.localeCompare(b.date) || toMin(a.s) - toMin(b.s);
const shiftText = (x) => `${fmtDay(x.date)} · ${x.s}–${x.e} · ${x.house}`;
const mmss = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
// Accounts listed on the login screen. The other seeded employees still exist and can sign in.
const DEMO_LOGINS = [
  "pavithra@starcare.demo",
  "chaitanya@starcare.demo",
  "amrutha@starcare.demo",
];
const PERIODS = ["Day", "Week", "Month", "Year"];
const OPEN_SWAP = ["Pending", "Training required"];
const emptyEmpForm = {
  editingId: "",
  name: "",
  email: "",
  empId: "",
  dob: "",
  pin: "",
  position: "",
  house: HOUSES[0],
};
const TAB_ICONS = {
  Dashboard: LayoutDashboard,
  "My Schedule": CalendarDays,
  "House Schedule": House,
  Leave: ClipboardList,
  "Shift Swap": ArrowLeftRight,
  Timesheets: ClipboardCheck,
  "My Hours": Clock,
  "Leave Requests": ClipboardList,
  "Swap Requests": ArrowLeftRight,
  Jobs: Briefcase,
  Candidates: Users,
  Pipeline: GitBranch,
  Interviews: CalendarCheck,
  Emails: Mail,
  Templates: FileText,
};

const SESSION_KEY = "starcare-session";

export default function Page() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [wb, setWb] = useState("");
  const [tab, setTab] = useState("");
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [seen, setSeen] = useState(0);
  const [toast, setToast] = useState("");
  const [hsel, setHsel] = useState("");
  const [past, setPast] = useState(false);
  const [house, setHouse] = useState("All");
  // server data (filled after sign-in; nothing is hardcoded in the browser)
  const [reqs, setReqs] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [sched, setSched] = useState([]);
  const [todo, setTodo] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [tsExp, setTsExp] = useState(0);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => new Date()); // the machine's local clock, ticking
  const [uemail, setUemail] = useState("");
  const [item, setItem] = useState(null);
  const [ts, setTs] = useState({
    date: "",
    start: "",
    end: "",
    house: "",
    initials: "",
    notes: "",
    signoff: false,
    override: false,
  });
  const [myDob, setMyDob] = useState(""); // DOB on this user's Employee Management record (timesheet sign-in)
  const [pinF, setPinF] = useState({ dob: "", pin: "" });
  const [ack, setAck] = useState({ answer: "Confirm", acknowledged: false });
  const [lf, setLf] = useState({
    lt: "Vacation",
    lf: "",
    lr: "",
    half: false,
    hs: "08:00",
    he: "12:00",
    reason: "",
  });
  const [lfOpen, setLfOpen] = useState(false); // Leave screen: right panel shows the New Request form vs. guidance
  const [sw, setSw] = useState({ shift: "", with: "", back: "", reason: "" });
  const [swOpen, setSwOpen] = useState(false); // Shift Swap screen: right panel shows the New Swap form vs. guidance
  const [remarks, setRemarks] = useState({});
  const [per, setPer] = useState("Month");
  const [anchor, setAnchor] = useState("");
  const [aud, setAud] = useState({ emp: "All", from: "", to: "" });
  const [repFilter, setRepFilter] = useState({
    emp: "All",
    month: "All",
    year: String(new Date().getFullYear()),
  });
  const [empForm, setEmpForm] = useState(emptyEmpForm);
  const [empOpen, setEmpOpen] = useState(false); // Employee screen: right panel shows the Add/Edit form vs. guidance
  const [ready, setReady] = useState(false); // true once a saved session (if any) has been restored after a refresh

  const say = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const apply = (d) => {
    setReqs(d.reqs);
    setSwaps(d.swaps);
    setSched(d.sched);
    setTodo(d.todo);
    setTimesheets(d.timesheets);
    setNotifs(d.notifications);
    setEmployees(d.employees || []);
    setAuditLog(d.auditLog || []);
    setMyDob(d.myDob || "");
    setTsExp(Object.values(d.tsSessions || {})[0] || 0);
    setSkew((d.serverNow || Date.now()) - Date.now());
  };
  const call = async (path, method, body, okMsg) => {
    const r = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-user-email": uemail },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) {
      say(d.error);
      return false;
    }
    apply(d.state);
    say(okMsg);
    return true;
  };

  // load the server data after sign-in, then keep it fresh so a swap approved by the Admin shows up for both employees
  useEffect(() => {
    if (!uemail) return undefined;
    const load = () =>
      fetch("/api/hrm", { headers: { "x-user-email": uemail } })
        .then((r) => r.json())
        .then((d) => d.reqs && apply(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [uemail]); // eslint-disable-line react-hooks/exhaustive-deps
  // local clock: every second on the timesheet screen (countdown + timestamp), otherwise every 20s
  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date()),
      tab === "Timesheets" ? 1000 : 20000,
    );
    return () => clearInterval(id);
  }, [tab]);

  // Keep the signed-in user on the same workspace and page across a browser refresh.
  // sessionStorage is per browser tab, so closing the tab (or Sign out) still ends the session.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      const u = saved && USERS[saved.email];
      if (u) {
        const w = u.wb.includes(saved.wb) ? saved.wb : u.wb[0];
        const tabs = tabsOf(w);
        setUemail(saved.email);
        setUser(u);
        setWb(w);
        setTab(tabs.includes(saved.tab) ? saved.tab : tabs[0] || "");
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (uemail)
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ email: uemail, wb, tab }),
        );
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }, [ready, uemail, wb, tab]);

  const doLogin = () => {
    const key = email.trim().toLowerCase();
    const u = USERS[key];
    if (!u || u.pw !== pw)
      return setErr(
        "Email or password is not correct. Use one of the demo accounts below.",
      );
    setUemail(key);
    setSeen(0);
    setErr("");
    setUser(u);
    setWb(u.wb[0]);
    setTab(tabsOf(u.wb[0])[0] || "");
  };
  const pick = (w, t) => {
    setWb(w);
    setTab(t || tabsOf(w)[0] || "");
    setMenu(false);
  };
  const signOut = () => {
    setUser(null);
    setUemail("");
    setMenu(false);
    setBell(false);
    setPw("");
    setTsExp(0);
    setSched([]);
  };

  if (!ready) return null; // avoid flashing the login screen while a saved session is restored

  // ---------- LOGIN ----------
  if (!user) {
    return (
      <div className="login">
        <div className="login-card">
          <div className="login-brand">
            <img
              className="login-logo"
              src="/starcare_logo.gif"
              alt="StarCare of Tennessee"
            />
            <div>
              <b>Starcare HRM</b>
              <span>Next Gen HRM</span>
            </div>
          </div>
          <h1 className="login-title">Welcome Back</h1>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@starcare.demo"
          />
          <label>Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
          <button className="btn w login-ms" onClick={doLogin}>
            <span className="ms">
              <i></i>Sign In with Microsoft
            </span>
          </button>
          <div className="err">{err}</div>
          <div className="demo">
            <b>Demo logins (click to fill)</b>
            {DEMO_LOGINS.map((e) => (
              <div
                key={e}
                onClick={() => {
                  setEmail(e);
                  setPw(USERS[e].pw);
                }}
              >
                <span>{e}</span>
                <span>
                  {USERS[e].pw} · <b>{USERS[e].role}</b>
                </span>
              </div>
            ))}
          </div>
          <p className="login-foot">Secure single sign-on access</p>
        </div>
        <div className="login-hero">
          <Image
            src={loginIllustration}
            alt="Starcare HRM workspace"
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>
      </div>
    );
  }

  const n = user.name;
  const today = todayISO(now); // local system date, recalculated as the clock ticks
  const nowMin = nowMinutes(now);
  // Strictly future dates only (today excluded) — used by Shift Swap so employees
  // can never pick a shift that has already started or already happened.
  const upcoming = (list) => list.filter((x) => x.date > today).sort(byTime);
  // Employee state is privacy-filtered (only their own timesheets/leave), so scope the Incomplete-
  // Timesheet computation to just them; Admin's state is the full picture, so use every employee.
  const ledger = hoursLedger(
    { timesheets, reqs, todo, sched },
    now,
    user.role === "Admin" ? undefined : [n],
  );
  const inPeriod = (rows, kind, a) => {
    const [f, t] = periodRange(a, kind);
    return rows.filter((r) => r.date >= f && r.date <= t);
  };
  const go = (t) => {
    if (t === "Timesheets") openTs();
    setTab(t);
    setBell(false);
  };

  const startFor = (date) =>
    to24(sched.find((x) => x.emp === n && x.date === date)?.s);
  const openTs = (date) => {
    const d =
      date ||
      todo.find((t) => t.emp === n && t.kind === "timesheet" && !t.done)
        ?.date ||
      today;
    setTs({
      date: d,
      start: startFor(d),
      end: "",
      house: "",
      initials: initialsOf(n),
      notes: "",
      signoff: false,
      override: false,
    });
  };
  const openItem = (x) => {
    if (x.kind === "leave") return setTab("Leave");
    if (x.kind === "timesheet") {
      openTs(x.date);
      return setTab("Timesheets");
    }
    setItem(x.id);
    setTab("Complete");
  };

  // ---------- EMPLOYEE PORTAL ----------
  const dash = () => {
    const b = balances(reqs, n),
      pend =
        reqs.filter((r) => r.emp === n && r.st === "Pending").length +
        swaps.filter(
          (s) => (s.from === n || s.with === n) && OPEN_SWAP.includes(s.st),
        ).length;
    // Today's shift (if any) is shown separately as "Today's shift" - it is NOT the "Next shift".
    // "Next shift" always looks strictly beyond today, so an employee currently on shift today
    // sees tomorrow's (or whichever is soonest after today) shift there instead of the one they're in now.
    const todayShift = sched.find((s) => s.emp === n && s.date === today);
    const workingNow =
      todayShift &&
      toMin(todayShift.s) <= nowMin &&
      nowMin < toMin(todayShift.e);
    const mine = sched
      .filter((s) => s.emp === n && s.date > today)
      .sort(byTime)[0];
    const mineTodo = todo.filter(
      (t) => t.emp === n && !t.done && t.kind !== "shift",
    );
    const [ms, me] = periodRange(today, "Month");
    const [ws, we] = periodRange(today, "Week");
    // Completed timesheet hours (leave/incomplete rows carry 0 hours) roll straight into all three
    // totals below - there is no separate "awaiting approval" bucket to exclude anymore.
    const todayHrs = ledger
      .filter((r) => r.emp === n && r.date === today)
      .reduce((a, r) => a + r.hours, 0);
    const weekHrs = ledger
      .filter((r) => r.emp === n && r.date >= ws && r.date <= we)
      .reduce((a, r) => a + r.hours, 0);
    const monthHrs = ledger
      .filter((r) => r.emp === n && r.date >= ms && r.date <= me)
      .reduce((a, r) => a + r.hours, 0);
    return (
      <>
        <div className="page-head">
          <div>
            <span className="page-eyebrow">Employee workspace</span>
            <h1 className="db-page-title">Dashboard</h1>
            <p>
              Welcome back, {n.split(" ")[0]}. Here is what needs your
              attention.
            </p>
          </div>
          <div className="dash-date">
            <CalendarDays size={18} />
            <div>
              <b>{fmtDay(today)}</b>
              <small>{user.house || "All Houses"}</small>
            </div>
          </div>
        </div>
        <div className="grid">
          {[
            [todayHrs.toFixed(1), "Hours today"],
            [weekHrs.toFixed(1), "Hours this week"],
            [monthHrs.toFixed(1), "Hours this month"],
            [pend, "Requests pending"],
          ].map((k) => (
            <KpiCard key={k[1]} value={k[0]} label={k[1]} />
          ))}
        </div>
        <div className="dash-grid">
          <div className="dash-col">
            <div className="card">
              <div className="req-head">
                <span className="req-icon">
                  <ClipboardCheck size={22} />
                </span>
                <div className="req-title">
                  <h2>Outstanding items</h2>
                  <small>
                    {mineTodo.length
                      ? `${mineTodo.length} item${mineTodo.length === 1 ? "" : "s"} to complete`
                      : "Nothing waiting on you"}
                  </small>
                </div>
              </div>
              {mineTodo.length ? (
                <div className="dash-list">
                  {mineTodo.map((x) => {
                    const Ico = x.kind === "timesheet" ? Clock : FileText;
                    return (
                      <div className="dash-item" key={x.id}>
                        <span className={"dash-item-ico " + x.kind}>
                          <Ico size={18} />
                        </span>
                        <div className="dash-item-text">
                          <b>{x.title}</b>
                          <small>{x.sub}</small>
                        </div>
                        <Pl t={x.label} c={x.tone} />
                        <button className="btn" onClick={() => openItem(x)}>
                          {x.kind === "timesheet"
                            ? "Submit Timesheet"
                            : "Complete now"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="req-empty">
                  <CircleCheck size={28} />
                  You are all caught up.
                </div>
              )}
            </div>
            <div className="card">
              <h2>Quick actions</h2>
              <div className="qa-grid">
                {[
                  [
                    Plane,
                    "Request time off",
                    "Vacation, sick or bereavement",
                    "Leave",
                  ],
                  [
                    ArrowLeftRight,
                    "Ask for shift cover",
                    "Swap with a colleague",
                    "Shift Swap",
                  ],
                  [
                    ClipboardCheck,
                    "Complete timesheet",
                    "Log the hours you worked",
                    "Timesheets",
                  ],
                ].map(([Ico, t, d, to]) => (
                  <button key={t} className="qa-tile" onClick={() => go(to)}>
                    <span className="qa-ico">
                      <Ico size={20} />
                    </span>
                    <span className="qa-text">
                      <b>{t}</b>
                      <small>{d}</small>
                    </span>
                    <ChevronRight size={18} className="qa-arrow" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="dash-col">
            <div className="card">
              <div className="req-head">
                <span className="req-icon">
                  <CalendarDays size={22} />
                </span>
                <div className="req-title">
                  <h2>My shifts</h2>
                  <small>Today and what is coming up</small>
                </div>
              </div>
              <div className="shift-block today">
                <div className="shift-label">
                  Today
                  {workingNow && <span className="pl g">Working now</span>}
                </div>
                {todayShift ? (
                  <>
                    <div className="shift-time">
                      {todayShift.s} – {todayShift.e}
                    </div>
                    <small>
                      {fmtDay(todayShift.date)} · {todayShift.house} ·{" "}
                      {todayShift.pos}
                    </small>
                  </>
                ) : (
                  <small>No shift scheduled today</small>
                )}
              </div>
              <div className="shift-block">
                <div className="shift-label">
                  Next shift
                  {mine && relDay(mine.date, today) && (
                    <span className="pl">{relDay(mine.date, today)}</span>
                  )}
                </div>
                {mine ? (
                  <>
                    <div className="shift-time">
                      {mine.s} – {mine.e}
                    </div>
                    <small>
                      {fmtDay(mine.date)} · {mine.house} · {mine.pos}
                    </small>
                  </>
                ) : (
                  <small>No upcoming shift</small>
                )}
              </div>
              <button className="btn w" onClick={() => go("My Schedule")}>
                View my schedule
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const schedule = () => {
    // "My Schedule" is the logged-in employee's own shifts. "House Schedule" is the complete
    // schedule for their assigned House. An Admin can pick any of the three Houses.
    const mode = tab === "House Schedule" ? "House" : "My";
    const houses =
      user.role === "Admin" ? HOUSES : [user.house].filter(Boolean);
    const h = houses.includes(hsel) ? hsel : houses[0];
    const rows = sched
      .filter(
        (r) =>
          (mode === "House" ? r.house === h : r.emp === n) &&
          (past || r.date >= today),
      )
      .sort(byTime);
    return (
      <>
        <h1 className="db-page-title">
          {mode === "House" ? "House schedule" : "My schedule"}
        </h1>
        <div className="card" style={{ marginTop: 16 }}>
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {mode === "House" && houses.length > 1 && (
              <select
                style={{ width: "auto" }}
                value={h || ""}
                onChange={(e) => setHsel(e.target.value)}
              >
                {houses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            )}
            <label
              style={{
                margin: "0 0 0 auto",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={past}
                onChange={(e) => setPast(e.target.checked)}
              />{" "}
              Show past shifts
            </label>
          </div>
          <T head={["Date", "Employee", "House", "Start", "End", "Position"]}>
            {rows.length ? (
              rows.map((r) => (
                <tr
                  key={r.id}
                  style={r.date < today ? { opacity: 0.55 } : undefined}
                >
                  <td>
                    <b>{fmtDay(r.date)}</b>{" "}
                    {relDay(r.date, today) && (
                      <span className="pl g">{relDay(r.date, today)}</span>
                    )}
                  </td>
                  <td>{r.emp === n ? <b>{r.emp} (you)</b> : r.emp}</td>
                  <td>{r.house}</td>
                  <td>{r.s}</td>
                  <td>{r.e}</td>
                  <td>{r.pos}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No shifts assigned.</td>
              </tr>
            )}
          </T>
        </div>
      </>
    );
  };

  const leave = () => {
    const bl = balances(reqs, n),
      mine = reqs
        .filter((r) => r.emp === n)
        .slice()
        .reverse();
    const from = lf.lf || today,
      to = lf.lr || from;
    const type = lf.half ? "Half day" : lf.lt;
    // Standard leave hours come from the employee's ACTUAL scheduled shift hours across From-To
    // (falls back to a standard 8h/day only if the schedule doesn't reach that far out yet).
    const v = calcHrs({
      half: lf.half,
      hs: lf.hs,
      he: lf.he,
      from,
      to,
      sched,
      name: n,
    });
    const capRow = bl.find((x) => x[0] === type); // undefined for Half day / Work excuse: no capped balance
    const errs = [];
    if (!lf.half && to < from)
      errs.push("The From date cannot be after the To date.");
    if (lf.half && (!lf.hs || !lf.he))
      errs.push("Choose a Start Time and an End Time for half-day leave.");
    else if (lf.half && lf.he <= lf.hs)
      errs.push("End Time must be after Start Time.");
    else if (!v || v <= 0)
      errs.push(
        "Check your dates or times — the requested leave works out to 0 hours.",
      );
    if (!errs.length && capRow && v > capRow[1])
      errs.push(
        `This request (${v.toFixed(1)}h) exceeds your remaining ${type.toLowerCase()} balance of ${capRow[1]}h.`,
      );
    const set = (k) => (e) =>
      setLf({
        ...lf,
        [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
      });
    const submit = () =>
      call(
        "/api/leave",
        "POST",
        {
          type,
          from,
          to,
          half: lf.half,
          hs: lf.hs,
          he: lf.he,
          reason: lf.reason,
        },
        "Request sent. Admin has been notified.",
      ).then((ok) => {
        if (ok) {
          setLf({ ...lf, reason: "" });
          setLfOpen(false);
        }
      });
    return (
      <>
        <div className="page-head">
          <div>
            <span className="page-eyebrow">Leave management</span>
            <h1 className="db-page-title">Leave and time off</h1>
          </div>
        </div>
        <div className="grid">
          {bl.map((x) => (
            <div className="card" key={x[0]}>
              <p>{x[0]}</p>
              <b style={{ fontSize: 30 }}>{x[1]}h</b>{" "}
              <span style={{ color: "var(--mute)" }}>remaining</span>
              <div className="bar">
                <i style={{ width: (x[1] / x[2]) * 100 + "%" }}></i>
              </div>
              <small style={{ color: "var(--mute)" }}>
                Available {x[2]}h · Used {x[3]}h
              </small>
            </div>
          ))}
        </div>
        <div className="split">
          <div className="card">
            <div className="req-head">
              <span className="req-icon">
                <ClipboardList size={22} />
              </span>
              <div className="req-title">
                <h2>My requests</h2>
                <small>
                  {mine.length} request{mine.length === 1 ? "" : "s"} in total
                </small>
              </div>
              <div className="req-stats">
                {[
                  ["Pending", Hourglass, "p"],
                  ["Approved", CircleCheck, "a"],
                  ["Denied", CircleX, "d"],
                ].map(([st, Ico, c]) => (
                  <span key={st} className={"req-stat " + c} title={st}>
                    <Ico size={14} />
                    {mine.filter((r) => r.st === st).length} {st}
                  </span>
                ))}
              </div>
            </div>
            <T
              head={[
                "Type",
                "From",
                "Return",
                "Hours",
                "Reason",
                "Status",
                "Decided by",
                "Remarks",
              ]}
            >
              {mine.length ? (
                mine.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.type}</b>
                    </td>
                    <td>{fmtShort(r.from)}</td>
                    <td>{fmtShort(r.to)}</td>
                    <td>{r.hrs.toFixed(1)}h</td>
                    <td>{r.reason || "—"}</td>
                    <td>
                      <Pl t={r.st} />
                    </td>
                    <td>{r.by || "—"}</td>
                    <td>{r.cm || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="req-empty">
                      <Inbox size={28} />
                      No requests yet. Use "+ New Leave Request" to add one.
                    </div>
                  </td>
                </tr>
              )}
            </T>
          </div>
          {lfOpen ? (
            <div className="card">
              <div className="panel-head">
                <h2>New leave request</h2>
                <button className="btn" onClick={() => setLfOpen(false)}>
                  Cancel
                </button>
              </div>
              <label>Leave type</label>
              <select value={lf.lt} onChange={set("lt")}>
                {LEAVE_TYPES.filter((x) => x !== "Half day").map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <div className="f2">
                <div>
                  <label>From</label>
                  <input type="date" value={from} onChange={set("lf")} />
                </div>
                <div>
                  <label>Return</label>
                  <input
                    type="date"
                    min={from}
                    value={to}
                    onChange={set("lr")}
                  />
                </div>
              </div>
              <label>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={lf.half}
                  onChange={set("half")}
                />{" "}
                Half day
              </label>
              {lf.half && (
                <div className="f2">
                  <div>
                    <label>Start time</label>
                    <input type="time" value={lf.hs} onChange={set("hs")} />
                  </div>
                  <div>
                    <label>End time</label>
                    <input
                      type="time"
                      min={lf.hs || undefined}
                      value={lf.he}
                      onChange={set("he")}
                    />
                  </div>
                </div>
              )}
              <div className="pl g" style={{ marginTop: 12 }}>
                Total requested: {v.toFixed(1)} hours
              </div>
              {errs.length > 0 && (
                <div className="warn" style={{ marginTop: 12 }}>
                  <b>Fix these before submitting</b>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {errs.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <label>Reason</label>
              <textarea
                rows={2}
                value={lf.reason}
                onChange={set("reason")}
                placeholder="e.g. Attending a family function"
              />
              <button
                className="btn b w"
                disabled={errs.length > 0}
                onClick={submit}
              >
                Submit request
              </button>
              <p style={{ textAlign: "center", fontSize: 12 }}>
                Your Admin is notified when you submit.
              </p>
            </div>
          ) : (
            <div className="card panel-empty">
              <button className="btn" onClick={() => setLfOpen(true)}>
                + New Leave Request
              </button>
              <h2>Leave Actions</h2>
              <p>
                Click "+ New Leave Request" to request time off. Your requests
                and their status appear on the left.
              </p>
              <ul>
                <li>Requests cannot exceed your remaining balance</li>
                <li>Half-day leave needs a Start Time and an End Time</li>
                <li>A reason is optional but helps your Admin decide</li>
                <li>Your Admin is notified as soon as you submit</li>
              </ul>
            </div>
          )}
        </div>
      </>
    );
  };

  const swap = () => {
    const shifts = upcoming(sched.filter((s) => s.emp === n));
    const shiftId = shifts.some((x) => x.id === Number(sw.shift))
      ? Number(sw.shift)
      : shifts[0]?.id;
    // Only colleagues assigned to the SAME House show up as valid cover: swaps stay within a House.
    const others = STAFF.filter((x) => x !== n && houseOf(x) === user.house);
    const cover = others.includes(sw.with) ? sw.with : others[0];
    const theirs = upcoming(sched.filter((s) => s.emp === cover));
    const back = theirs.some((x) => x.id === Number(sw.back))
      ? Number(sw.back)
      : "";
    const chk = shiftId
      ? checkSwap(
          { sched, swaps, reqs },
          { shiftId, cover, returnShiftId: back },
          n,
          today,
        )
      : { error: { error: "No upcoming eligible shifts available for swap." } };
    const yourShift = sched.find((x) => x.id === shiftId);
    // What the cover is doing right now, same date as your shift (for the Current-Schedule column) -
    // this is empty ("Off") whenever the request is a valid Cover-Only; a busy co-worker without a
    // return shift is blocked by chk.error before it ever reaches this preview.
    const coverCurrent = back
      ? sched.find((x) => x.id === back)
      : sched.find(
          (x) => x.emp === cover && yourShift && x.date === yourShift.date,
        );
    const mine = swaps
      .filter((s) => s.from === n || s.with === n)
      .slice()
      .reverse();
    const set = (k) => (e) => setSw({ ...sw, [k]: e.target.value });
    const submit = () =>
      call(
        "/api/swaps",
        "POST",
        { shiftId, cover, returnShiftId: back || null, reason: sw.reason },
        "Swap request sent to Admin",
      ).then((ok) => {
        if (ok) {
          setSw({ ...sw, reason: "" });
          setSwOpen(false);
        }
      });
    const form = (
      <div className="card">
        <div className="panel-head">
          <h2>New swap request</h2>
          <button className="btn" onClick={() => setSwOpen(false)}>
            Cancel
          </button>
        </div>
        <label>Your shift (future dates only)</label>
        <select value={shiftId || ""} onChange={set("shift")}>
          {shifts.length ? (
            shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {shiftText(s)}
              </option>
            ))
          ) : (
            <option value="">
              No upcoming eligible shifts available for swap.
            </option>
          )}
        </select>
        <label>Swap with (same House)</label>
        <select
          value={cover || ""}
          onChange={(e) => setSw({ ...sw, with: e.target.value, back: "" })}
        >
          {others.length ? (
            others.map((x) => <option key={x}>{x}</option>)
          ) : (
            <option value="">No colleagues in your House</option>
          )}
        </select>
        <label>Their shift I will take in return</label>
        <select value={back} onChange={set("back")}>
          <option value="">
            None: Cover-Only ({cover} must be off that day)
          </option>
          {theirs.map((s) => (
            <option key={s.id} value={s.id}>
              {shiftText(s)}
            </option>
          ))}
        </select>
        <label>Reason for request</label>
        <textarea rows={2} value={sw.reason} onChange={set("reason")} />
        {chk.error ? (
          <div className="warn" style={{ marginTop: 12 }}>
            <b>Cannot request this swap</b>
            <br />
            {chk.error.error}
          </div>
        ) : (
          shiftId && (
            <div style={{ marginTop: 12 }}>
              <b>Current Schedule vs Proposed Schedule</b>
              <div className="two" style={{ marginTop: 8 }}>
                <div className="okbox">
                  <b>Current</b>
                  <div style={{ marginTop: 4 }}>
                    {n}: {yourShift ? shiftText(yourShift) : "—"}
                  </div>
                  <div>
                    {cover}:{" "}
                    {coverCurrent ? shiftText(coverCurrent) : "Off that day"}
                  </div>
                </div>
                <div className="okbox">
                  <b>Proposed (if approved)</b>
                  <div style={{ marginTop: 4 }}>
                    {cover}: {chk.sh ? shiftText(chk.sh) : "—"}
                  </div>
                  <div>
                    {n}:{" "}
                    {chk.back
                      ? shiftText(chk.back)
                      : "Released from that shift"}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
        <button
          className="btn b w"
          style={{ marginTop: 12 }}
          disabled={!!chk.error}
          onClick={submit}
        >
          Submit swap request
        </button>
      </div>
    );
    return (
      <>
        <div className="page-head">
          <div>
            <span className="page-eyebrow">Shift swap</span>
            <h1 className="db-page-title">Shift swap and coverage</h1>
          </div>
        </div>
        <div className="split">
          <div className="card">
            <div className="req-head">
              <span className="req-icon">
                <ArrowLeftRight size={22} />
              </span>
              <div className="req-title">
                <h2>My swap requests</h2>
                <small>
                  {mine.length} request{mine.length === 1 ? "" : "s"} in total
                </small>
              </div>
              <div className="req-stats">
                {[
                  ["Pending", Hourglass, "p"],
                  ["Approved", CircleCheck, "a"],
                  ["Denied", CircleX, "d"],
                ].map(([st, Ico, c]) => (
                  <span key={st} className={"req-stat " + c} title={st}>
                    <Ico size={14} />
                    {mine.filter((r) => r.st === st).length} {st}
                  </span>
                ))}
              </div>
            </div>
            <T
              head={[
                "Requested by",
                "Covering",
                "Gives up",
                "Takes in return",
                "Status",
                "Note",
              ]}
            >
              {mine.length ? (
                mine.map((s) => (
                  <tr key={s.id}>
                    <td>{s.from === n ? "You" : s.from}</td>
                    <td>{s.with === n ? "You" : s.with}</td>
                    <td>{shiftText(s.orig)}</td>
                    <td>{s.repl ? shiftText(s.repl) : "Cover only"}</td>
                    <td>
                      <Pl t={s.st} />
                    </td>
                    <td>
                      {s.st === "Training required" ? (
                        <span className="tx">
                          Individual specific training required before approval
                        </span>
                      ) : s.st === "Approved" ? (
                        `Schedule updated for ${s.from} and ${s.with}`
                      ) : s.by ? (
                        "By " + s.by
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="req-empty">
                      <Inbox size={28} />
                      No swap requests yet. Use "+ New Swap Request" to add one.
                    </div>
                  </td>
                </tr>
              )}
            </T>
          </div>
          {swOpen ? (
            form
          ) : (
            <div className="card panel-empty">
              <button className="btn" onClick={() => setSwOpen(true)}>
                + New Swap Request
              </button>
              <h2>Swap Actions</h2>
              <p>
                Click "+ New Swap Request" to ask a colleague to swap or cover
                one of your shifts. Your requests and their status appear on the
                left.
              </p>
              <ul>
                <li>Only future shifts can be swapped</li>
                <li>You can only swap with colleagues in your House</li>
                <li>
                  Cover-only requests need your colleague to be off that day
                </li>
                <li>An Admin approves it and both schedules update</li>
              </ul>
            </div>
          )}
        </div>
      </>
    );
  };

  // ---------- TIMESHEET (Date of Birth + PIN, then the form) ----------
  const timesheet = () => {
    const remain = tsExp - (now.getTime() + skew);
    if (remain <= 0) {
      const verify = () =>
        call(
          "/api/timesheets/verify",
          "POST",
          { dob: pinF.dob, pin: pinF.pin },
          "Identity verified",
        ).then((ok) => ok && setPinF({ dob: "", pin: "" }));
      return (
        <>
          <h1 className="db-page-title">Timesheets</h1>
          <div className="card" style={{ marginTop: 16, maxWidth: 440 }}>
            <h2>Verify it&apos;s you</h2>
            <label>Date of Birth</label>
            <input
              type="date"
              max={today}
              value={pinF.dob}
              onChange={(e) => setPinF({ ...pinF, dob: e.target.value })}
            />
            <label>PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pinF.pin}
              onChange={(e) => setPinF({ ...pinF, pin: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="4-digit PIN"
            />
            <button className="btn b w" onClick={verify}>
              Verify and continue
            </button>
            <p style={{ fontSize: 12, marginTop: 10 }}>
              Demo only: your Date of Birth is{" "}
              {myDob ? fmtFull(myDob) : "not set yet (ask your Admin)"} and your
              PIN is {user.pin}. The verified session lasts 10 minutes.
            </p>
          </div>
        </>
      );
    }
    const chk = timesheetChecks({ sched, reqs, timesheets }, user, ts, now);
    const st = (k) => (e) =>
      setTs({
        ...ts,
        [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
      });
    const setDate = (e) =>
      setTs({ ...ts, date: e.target.value, start: startFor(e.target.value) });
    const out = todo.filter(
      (t) => t.emp === n && t.kind === "timesheet" && !t.done,
    );
    const submit = () =>
      call(
        "/api/timesheets",
        "POST",
        ts,
        `Timesheet for ${fmtShort(ts.date)} submitted`,
      ).then((ok) => {
        if (ok) {
          openTs();
          setTab("My Hours");
        }
      });
    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="db-page-title">Complete timesheet</h1>
            <p>
              Verified with your Date of Birth and PIN · session ends in{" "}
              {mmss(remain)}
            </p>
          </div>
          <span className="pl g">Identity verified</span>
        </div>
        {out.length > 0 && (
          <div
            className="card"
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <b>Outstanding timesheets:</b>
            {out.map((t) => (
              <button
                key={t.id}
                className={"btn " + (ts.date === t.date ? "b" : "")}
                onClick={() => openTs(t.date)}
              >
                {fmtDay(t.date)}
              </button>
            ))}
          </div>
        )}
        <div className="tsgrid" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="f3">
              <div>
                <label>Employee</label>
                <input
                  className="ro"
                  readOnly
                  value={`${n} · ID ${user.empId}`}
                />
              </div>
              <div>
                <label>Initials</label>
                <input
                  value={ts.initials}
                  maxLength={4}
                  onChange={st("initials")}
                />
              </div>
              <div>
                <label>Date</label>
                <input
                  type="date"
                  max={today}
                  value={ts.date}
                  onChange={setDate}
                />
              </div>
              <div>
                <label>Start time</label>
                <input type="time" value={ts.start} onChange={st("start")} />
              </div>
              <div>
                <label>End time</label>
                <input
                  type="time"
                  className={!ts.end ? "bad" : ""}
                  value={ts.end}
                  onChange={st("end")}
                />
                {!ts.end && <div className="fe">End time is required.</div>}
              </div>
              <div>
                <label>Hours worked</label>
                <input
                  className="ro"
                  readOnly
                  value={chk.hours != null ? `${chk.hours.toFixed(2)} hrs` : ""}
                  placeholder="Calculated after end time"
                />
              </div>
              <div>
                <label>House</label>
                <select
                  className={!ts.house ? "bad" : ""}
                  value={ts.house}
                  onChange={st("house")}
                >
                  <option value="">Select House</option>
                  {HOUSES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                {!ts.house && (
                  <div className="fe">Choose where you worked.</div>
                )}
              </div>
              <div>
                <label>Timestamp</label>
                <input className="ro" readOnly value={fmtStamp(now)} />
              </div>
            </div>
            <label>Work notes</label>
            <textarea
              rows={3}
              value={ts.notes}
              onChange={st("notes")}
              placeholder="Add notes about your shift"
            />
            {user.role === "Admin" && (
              <label>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={ts.override}
                  onChange={st("override")}
                />{" "}
                Admin override (explicitly bypass a schedule/leave conflict)
              </label>
            )}
            <label>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={ts.signoff}
                onChange={st("signoff")}
              />{" "}
              I confirm these hours are accurate.
            </label>
            <button className="btn b w" disabled={!chk.ok} onClick={submit}>
              Submit timesheet
            </button>
          </div>
          <div>
            <div className="card">
              <h2>Before you submit</h2>
              <p>Submit unlocks when every item is done.</p>
              <div style={{ marginTop: 12 }}>
                {chk.items.map((i) => (
                  <div className="ck" key={i.key}>
                    <span className={"ic " + (i.ok ? "y" : "n")}>
                      {i.ok ? "✓" : "!"}
                    </span>
                    {i.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="warn" style={{ marginTop: 16 }}>
              <b>
                Conflict with approved{" "}
                {chk.conflict ? chk.conflict.type.toLowerCase() + " " : ""}leave
              </b>
              <p style={{ color: "inherit", marginTop: 6 }}>
                {chk.conflict
                  ? `You are on approved ${chk.conflict.type.toLowerCase()} leave on ${fmtDay(ts.date)}. You cannot submit a worked-hours timesheet for this date${user.role === "Admin" ? " unless you apply the Admin override" : ""}.`
                  : "A day with approved leave cannot have a worked-hours timesheet unless an Admin explicitly overrides it."}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ---------- MY HOURS ----------
  const myHours = () => {
    const a = anchor || today;
    // "My Hours" is a till-date record, not a planner: never show rows for a date after today,
    // even when browsing by week/month/year or when an approved leave request reaches into the future.
    const rows = inPeriod(
      tillToday(
        ledger.filter((r) => r.emp === n),
        today,
      ),
      per,
      a,
    );
    const [f, t] = periodRange(a, per);
    return (
      <>
        <h1 className="db-page-title">My hours</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="f3" style={{ alignItems: "end" }}>
            <div>
              <label>View by</label>
              <select value={per} onChange={(e) => setPer(e.target.value)}>
                {PERIODS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Around date</label>
              <input
                type="date"
                max={today}
                value={a}
                onChange={(e) => setAnchor(e.target.value)}
              />
            </div>
            <div>
              <button className="btn" onClick={() => setAnchor("")}>
                Back to today
              </button>
            </div>
          </div>
          <p style={{ margin: "12px 0" }}>
            {fmtShort(f)} – {fmtFull(t)} ·{" "}
            <b>{rows.reduce((s, r) => s + r.hours, 0).toFixed(1)} hours</b> ·{" "}
            {rows.filter((r) => r.hours > 0).length} days worked
          </p>
          <T head={["Date", "House", "Start", "End", "Hours", "Status"]}>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.key}>
                  <td>{fmtDay(r.date)}</td>
                  <td>{r.house || "—"}</td>
                  <td>{to12(r.start)}</td>
                  <td>{to12(r.end)}</td>
                  <td>{r.hours ? r.hours.toFixed(1) : "—"}</td>
                  <td>
                    <Pl
                      t={LEAVE_TYPES.includes(r.st) ? "Leave" : r.st}
                      c={cls[r.st]}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No hours in this period.</td>
              </tr>
            )}
          </T>
        </div>
      </>
    );
  };

  // ---------- APPROVALS (Admin only) ----------
  const decide = (id, st) =>
    call(
      "/api/leave/" + id,
      "PATCH",
      { status: st, comment: remarks[id] || "" },
      `${st}. Employee has been notified.`,
    ).then((ok) => ok && setRemarks({ ...remarks, [id]: "" }));
  const swapAct = (s, a) =>
    call(
      "/api/swaps/" + s.id,
      "PATCH",
      { action: a },
      {
        deny: "Denied. Staff notified.",
        train: "Training required. Approval is locked.",
        trained: "Training marked complete.",
        approve: `Approved. Schedule updated for ${s.from} and ${s.with}.`,
      }[a],
    );
  const approvals = () => {
    const pend = reqs.filter((r) => r.st === "Pending");
    return (
      <>
        <h1 className="db-page-title">Approval Center</h1>
        {tab !== "Swap Requests" ? (
          <>
            <div className="card" style={{ marginTop: 16 }}>
              <T
                head={[
                  "Employee",
                  "House",
                  "Type",
                  "Dates",
                  "Hours",
                  "Reason",
                  "Remarks",
                  "Actions",
                ]}
              >
                {pend.length ? (
                  pend.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.emp}</b>
                      </td>
                      <td>{r.house}</td>
                      <td>
                        <span className="pl">{r.type}</span>
                      </td>
                      <td>
                        {fmtShort(r.from)}
                        {r.from !== r.to ? " – " + fmtShort(r.to) : ""}
                      </td>
                      <td>{r.hrs}</td>
                      <td>{r.reason || "—"}</td>
                      <td>
                        <input
                          style={{ minWidth: 140 }}
                          placeholder="Add a remark (optional)"
                          value={remarks[r.id] || ""}
                          onChange={(e) =>
                            setRemarks({ ...remarks, [r.id]: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="btn d"
                          onClick={() => decide(r.id, "Denied")}
                        >
                          Reject
                        </button>{" "}
                        <button
                          className="btn m"
                          onClick={() => decide(r.id, "Approved")}
                        >
                          Approve
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>No pending requests.</td>
                  </tr>
                )}
              </T>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h2>Recent decisions</h2>
              <T
                head={[
                  "Employee",
                  "Type",
                  "Hours",
                  "Reason",
                  "Status",
                  "Decided by",
                  "Remarks",
                ]}
              >
                {reqs
                  .filter((r) => r.st !== "Pending")
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.emp}</td>
                      <td>{r.type}</td>
                      <td>{r.hrs}</td>
                      <td>{r.reason || "—"}</td>
                      <td>
                        <Pl t={r.st} />
                      </td>
                      <td>{r.by}</td>
                      <td>{r.cm || "—"}</td>
                    </tr>
                  ))}
              </T>
            </div>
          </>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <T
              head={[
                "Requested by",
                "Covering",
                "Original shift",
                "Replacement shift",
                "Reason",
                "Status",
                "Actions",
              ]}
            >
              {swaps.length ? (
                swaps.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.from}</b>
                    </td>
                    <td>{s.with}</td>
                    <td>{shiftText(s.orig)}</td>
                    <td>{s.repl ? shiftText(s.repl) : "Cover only"}</td>
                    <td>{s.reason}</td>
                    <td>
                      <Pl t={s.st} />
                    </td>
                    <td>
                      {s.st === "Approved" || s.st === "Denied" ? (
                        "—"
                      ) : (
                        <>
                          <button
                            className="btn d"
                            onClick={() => swapAct(s, "deny")}
                          >
                            Deny
                          </button>{" "}
                          {s.st === "Pending" ? (
                            <button
                              className="btn"
                              onClick={() => swapAct(s, "train")}
                            >
                              Require training
                            </button>
                          ) : (
                            <button
                              className="btn"
                              onClick={() => swapAct(s, "trained")}
                            >
                              Mark training done
                            </button>
                          )}{" "}
                          <button
                            className="btn m"
                            disabled={s.st === "Training required"}
                            onClick={() => swapAct(s, "approve")}
                          >
                            Approve
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>No swap requests.</td>
                </tr>
              )}
            </T>
          </div>
        )}
      </>
    );
  };

  // ---------- RECRUITMENT (Admin only) ----------
  const recruit = () => {
    if (tab === "Dashboard")
      return (
        <>
          <h1 className="db-page-title">Dashboard</h1>
          <p>Welcome back! Here&apos;s your recruitment overview.</p>
          <div className="grid g3">
            {[
              [1, "Active Jobs"],
              [CANDS.length, "Total Candidates"],
              [CANDS.length, "Total Applications"],
              [0, "New Today"],
              [0, "Interviews Scheduled"],
              [0, "Hired This Month"],
            ].map((k) => (
              <KpiCard key={k[1]} value={k[0]} label={k[1]} />
            ))}
          </div>
          <div className="card">
            <h2>Quick actions</h2>
            <button className="btn" onClick={() => setTab("Jobs")}>
              + Create Job Post
            </button>{" "}
            <button className="btn" onClick={() => setTab("Candidates")}>
              View Candidates
            </button>
          </div>
        </>
      );
    if (tab === "Jobs")
      return (
        <>
          <h1 className="db-page-title">Jobs</h1>
          <div className="card" style={{ marginTop: 16 }}>
            <T head={["Title", "Location", "Applicants", "Status"]}>
              <tr>
                <td>
                  <b>Geriatric Caregiver</b>
                </td>
                <td>Tennessee</td>
                <td>{CANDS.length}</td>
                <td>
                  <Pl t="Active" c="g" />
                </td>
              </tr>
            </T>
          </div>
        </>
      );
    if (tab === "Candidates")
      return (
        <>
          <h1 className="db-page-title">Candidates</h1>
          <div className="card" style={{ marginTop: 16 }}>
            <T
              head={[
                "Name",
                "Email",
                "Title",
                "Applied role",
                "Experience",
                "Skills",
                "Source",
              ]}
            >
              {CANDS.map((c) => (
                <tr key={c[0]}>
                  <td>
                    <b>{c[0]}</b>
                  </td>
                  <td>{c[1]}</td>
                  <td>{c[2]}</td>
                  <td>{c[3]}</td>
                  <td>{c[4]}</td>
                  <td>
                    {c[5].map((s) => (
                      <span className="pl" key={s} style={{ marginRight: 4 }}>
                        {s}
                      </span>
                    ))}
                  </td>
                  <td>
                    <Pl t="career_site" />
                  </td>
                </tr>
              ))}
            </T>
          </div>
        </>
      );
    return (
      <>
        <h1 className="db-page-title">{tab}</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <p>
            This screen already exists in the current Recruitment module and is
            reused as-is.
          </p>
        </div>
      </>
    );
  };

  // ---------- TIMESHEET & HOURS AUDIT (Admin) ----------
  const audit = () => {
    const [mf, mt] = periodRange(today, "Month");
    const from = aud.from || mf,
      to = aud.to || mt;
    const rows = ledger.filter(
      (r) =>
        r.date >= from &&
        r.date <= to &&
        (house === "All" || r.house === house) &&
        (aud.emp === "All" || r.emp === aud.emp),
    );
    const worked = rows.filter((r) => r.hours > 0);
    const byHouse = HOUSES.map((h) => [
      h,
      worked.filter((r) => r.house === h).reduce((s, r) => s + r.hours, 0),
    ]);
    const exportCsv = () => {
      const line = (l) =>
        l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
      const csv = [
        line(["Date", "Employee", "House", "Start", "End", "Hours", "Status"]),
        ...rows.map((r) =>
          line([
            r.date,
            r.emp,
            r.house,
            to12(r.start),
            to12(r.end),
            r.hours,
            r.st,
          ]),
        ),
      ].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `timesheets-${from}_to_${to}.csv`;
      a.click();
      say("Exported. Opens in Excel.");
    };
    const kpis = [
      [worked.reduce((s, r) => s + r.hours, 0).toFixed(1), "Hours worked"],
      [new Set(worked.map((r) => r.emp)).size, "Employees worked"],
      [rows.filter((r) => r.st === "Completed").length, "Completed timesheets"],
      [
        rows.filter((r) => r.st === "Incomplete").length,
        "Incomplete timesheets",
      ],
    ];
    return (
      <>
        <h1 className="db-page-title">Timesheet audit</h1>

        <div className="grid">
          {kpis.map((k) => (
            <KpiCard key={k[1]} value={k[0]} label={k[1]} />
          ))}
        </div>
        <div className="card">
          <div className="f3" style={{ alignItems: "end" }}>
            <div>
              <label>House</label>
              <select value={house} onChange={(e) => setHouse(e.target.value)}>
                {["All", ...HOUSES].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Employee</label>
              <select
                value={aud.emp}
                onChange={(e) => setAud({ ...aud, emp: e.target.value })}
              >
                {["All", ...STAFF].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label>From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setAud({ ...aud, from: e.target.value })}
              />
            </div>
            <div>
              <label>To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setAud({ ...aud, to: e.target.value })}
              />
            </div>
            <div>
              <button className="btn b" onClick={exportCsv}>
                Export Excel
              </button>
            </div>
          </div>
          <p style={{ margin: "12px 0" }}>
            Hours by House:{" "}
            {byHouse.map(([h, v]) => `${h} ${v.toFixed(1)}h`).join(" · ")}
          </p>
          <T
            head={[
              "Date",
              "Employee",
              "House",
              "Start",
              "End",
              "Hours",
              "Status",
            ]}
          >
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.key}>
                  <td>{fmtDay(r.date)}</td>
                  <td>{r.emp}</td>
                  <td>{r.house || "—"}</td>
                  <td>{to12(r.start)}</td>
                  <td>{to12(r.end)}</td>
                  <td>{r.hours ? r.hours.toFixed(1) : "—"}</td>
                  <td>
                    <Pl t={r.st} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>No records for these filters.</td>
              </tr>
            )}
          </T>
        </div>
      </>
    );
  };

  // ---------- REPORTS (Admin) ----------
  const reportsPage = () => {
    // Filter by Date range (custom From/To), or by a specific Month, or by a whole Year - Admin's choice.
    const [mf, mt] = periodRange(today, "Month");
    let from, to;
    if (repFilter.mode === "month") {
      const iso = `${repFilter.year}-${String(Number(repFilter.month) + 1).padStart(2, "0")}-01`;
      [from, to] = periodRange(iso, "Month");
    } else if (repFilter.mode === "year") {
      from = `${repFilter.year}-01-01`;
      to = `${repFilter.year}-12-31`;
    } else {
      from = aud.from || mf;
      to = aud.to || mt;
    }
    const empOk = (name) => repFilter.emp === "All" || name === repFilter.emp;
    const rows = ledger.filter(
      (r) =>
        r.date >= from &&
        r.date <= to &&
        (house === "All" || r.house === house) &&
        empOk(r.emp),
    );
    // Every leave record whose range overlaps the report window, for the selected House/Employee - all 4 types.
    const leaveInRange = reqs.filter(
      (r) =>
        r.st === "Approved" &&
        r.from <= to &&
        r.to >= from &&
        (house === "All" || r.house === house) &&
        empOk(r.emp),
    );
    const leaveHrs = (name, type) =>
      leaveInRange
        .filter((r) => r.emp === name && r.type === type)
        .reduce((a, r) => a + r.hrs, 0);
    const byEmp = STAFF.filter(
      (name) => (house === "All" || houseOf(name) === house) && empOk(name),
    ).map((name) => ({
      name,
      house: houseOf(name),
      hours: rows
        .filter((r) => r.emp === name && r.hours > 0)
        .reduce((a, r) => a + r.hours, 0),
      vacation: leaveHrs(name, "Vacation"),
      sick: leaveHrs(name, "Sick"),
      bereavement: leaveHrs(name, "Bereavement"),
      workExcuse: leaveHrs(name, "Work excuse"),
      incomplete: rows.filter((r) => r.emp === name && r.st === "Incomplete")
        .length,
      completed: rows.filter((r) => r.emp === name && r.st === "Completed")
        .length,
    }));
    const byHouse = HOUSES.map((h) => [
      h,
      rows
        .filter((r) => r.house === h && r.hours > 0)
        .reduce((a, r) => a + r.hours, 0),
      new Set(
        rows.filter((r) => r.house === h && r.hours > 0).map((r) => r.emp),
      ).size,
    ]);
    const totalVac = byEmp.reduce((a, e) => a + e.vacation, 0),
      totalSick = byEmp.reduce((a, e) => a + e.sick, 0),
      totalBer = byEmp.reduce((a, e) => a + e.bereavement, 0),
      totalWE = byEmp.reduce((a, e) => a + e.workExcuse, 0);
    // Individual leave requests (every type, every status) for the selected Employee/House, overlapping the window - the actual audit trail of who requested what.
    const leaveRows = reqs
      .filter(
        (r) =>
          r.from <= to &&
          r.to >= from &&
          (house === "All" || r.house === house) &&
          empOk(r.emp),
      )
      .slice()
      .sort((a, b) => b.from.localeCompare(a.from));
    const csvLine = (l) =>
      l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    const exportSummary = () => {
      const csv = [
        csvLine([
          "Employee",
          "House",
          "Hours worked",
          "Vacation used (h)",
          "Sick used (h)",
          "Bereavement used (h)",
          "Work excuse used (h)",
          "Incomplete timesheets",
          "Completed timesheets",
        ]),
        ...byEmp.map((e) =>
          csvLine([
            e.name,
            e.house,
            e.hours.toFixed(1),
            e.vacation.toFixed(1),
            e.sick.toFixed(1),
            e.bereavement.toFixed(1),
            e.workExcuse.toFixed(1),
            e.incomplete,
            e.completed,
          ]),
        ),
      ].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `reports-summary-${from}_to_${to}.csv`;
      a.click();
      say("Exported. Opens in Excel.");
    };
    const exportLeave = () => {
      const csv = [
        csvLine([
          "Employee",
          "House",
          "Type",
          "From",
          "To",
          "Hours",
          "Status",
          "Decided by",
          "Remarks",
        ]),
        ...leaveRows.map((r) =>
          csvLine([
            r.emp,
            r.house,
            r.type,
            r.from,
            r.to,
            r.hrs.toFixed(1),
            r.st,
            r.by || "",
            r.cm || "",
          ]),
        ),
      ].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `leave-requests-${from}_to_${to}.csv`;
      a.click();
      say("Exported. Opens in Excel.");
    };
    const years = Array.from({ length: 5 }, (_, i) =>
      String(new Date(today).getFullYear() - 2 + i),
    );
    return (
      <>
        <div className="report-toolbar">
          <h1 className="db-page-title" style={{ margin: 0 }}>
            Reports
          </h1>
          <button className="btn b" onClick={exportSummary}>
            Export Excel
          </button>
        </div>
        <div className="card">
          <div className="f3" style={{ alignItems: "end" }}>
            <div>
              <label>Employee</label>
              <select
                value={repFilter.emp}
                onChange={(e) =>
                  setRepFilter({ ...repFilter, emp: e.target.value })
                }
              >
                {["All", ...STAFF].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>House</label>
              <select value={house} onChange={(e) => setHouse(e.target.value)}>
                {["All", ...HOUSES].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Filter by</label>
              <select
                value={repFilter.mode || "range"}
                onChange={(e) =>
                  setRepFilter({ ...repFilter, mode: e.target.value })
                }
              >
                <option value="range">Date range</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
            {(!repFilter.mode || repFilter.mode === "range") && (
              <>
                <div>
                  <label>From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setAud({ ...aud, from: e.target.value })}
                  />
                </div>
                <div>
                  <label>To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setAud({ ...aud, to: e.target.value })}
                  />
                </div>
              </>
            )}
            {repFilter.mode === "month" && (
              <>
                <div>
                  <label>Month</label>
                  <select
                    value={repFilter.month}
                    onChange={(e) =>
                      setRepFilter({ ...repFilter, month: e.target.value })
                    }
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Year</label>
                  <select
                    value={repFilter.year}
                    onChange={(e) =>
                      setRepFilter({ ...repFilter, year: e.target.value })
                    }
                  >
                    {years.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {repFilter.mode === "year" && (
              <div>
                <label>Year</label>
                <select
                  value={repFilter.year}
                  onChange={(e) =>
                    setRepFilter({ ...repFilter, year: e.target.value })
                  }
                >
                  {years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="filter-divider" />
          <T
            head={[
              "Employee",
              "House",
              "Hours worked",
              "Vacation used",
              "Sick used",
              "Bereavement used",
              "Work excuse used",
              "Incomplete",
              "Completed",
            ]}
          >
            {byEmp.length ? (
              byEmp.map((e) => (
                <tr key={e.name}>
                  <td>
                    <b>{e.name}</b>
                  </td>
                  <td>{e.house}</td>
                  <td>{e.hours.toFixed(1)}</td>
                  <td>{e.vacation.toFixed(1)}</td>
                  <td>{e.sick.toFixed(1)}</td>
                  <td>{e.bereavement.toFixed(1)}</td>
                  <td>{e.workExcuse.toFixed(1)}</td>
                  <td>
                    {e.incomplete ? (
                      <span className="pl r">{e.incomplete}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td>
                    {e.completed ? (
                      <span className="pl g">{e.completed}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>No employees match these filters.</td>
              </tr>
            )}
          </T>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="report-toolbar report-section-toolbar">
            <h2>
              Leave requests in this window{" "}
              <span style={{ fontWeight: 400, color: "var(--mute)" }}>
                ({leaveRows.length})
              </span>
            </h2>
            <button className="btn b" onClick={exportLeave}>
              Export Excel
            </button>
          </div>
          <T
            head={[
              "Employee",
              "House",
              "Type",
              "From",
              "To",
              "Hours",
              "Status",
              "Decided by",
              "Remarks",
            ]}
          >
            {leaveRows.length ? (
              leaveRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.emp}</b>
                  </td>
                  <td>{r.house}</td>
                  <td>{r.type}</td>
                  <td>{fmtShort(r.from)}</td>
                  <td>{fmtShort(r.to)}</td>
                  <td>{r.hrs.toFixed(1)}h</td>
                  <td>
                    <Pl t={r.st} />
                  </td>
                  <td>{r.by || "—"}</td>
                  <td>{r.cm || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>No leave requests match these filters.</td>
              </tr>
            )}
          </T>
        </div>
      </>
    );
  };

  // ---------- AUDIT TRAIL (Admin) ----------
  const auditPage = () => {
    const rows = (auditLog || []).slice().reverse();
    return (
      <>
        <h1 className="db-page-title">Audit trail</h1>

        <div className="card" style={{ marginTop: 16 }}>
          <T head={["When", "Actor", "Action", "Target", "Detail"]}>
            {rows.length ? (
              rows.map((a) => (
                <tr key={a.id}>
                  <td>{fmtStamp(new Date(a.at))}</td>
                  <td>{a.actor}</td>
                  <td>
                    <span className="pl">{a.action}</span>
                  </td>
                  <td>{a.target}</td>
                  <td>{a.detail || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No audit records yet.</td>
              </tr>
            )}
          </T>
        </div>
      </>
    );
  };

  // ---------- EMPLOYEE MANAGEMENT (Admin) ----------
  const employeeMgmt = () => {
    const isEditing = !!empForm.editingId;
    const set = (k) => (e) => setEmpForm({ ...empForm, [k]: e.target.value });
    const startEdit = (e) => {
      setEmpOpen(true);
      setEmpForm({
        editingId: e.empId,
        name: e.name,
        email: e.email,
        empId: e.empId,
        dob: e.dob || "",
        pin: "",
        position: e.position,
        house: e.house,
      });
    };
    const resetForm = () => {
      setEmpForm(emptyEmpForm);
      setEmpOpen(false);
    };
    const submit = () => {
      if (!empForm.name.trim()) return say("Employee name is required");
      if (isEditing)
        return call(
          `/api/employees/${empForm.editingId}`,
          "PATCH",
          {
            name: empForm.name,
            dob: empForm.dob,
            position: empForm.position,
            house: empForm.house,
          },
          "Employee updated",
        ).then((ok) => ok && resetForm());
      return call(
        "/api/employees",
        "POST",
        {
          name: empForm.name,
          email: empForm.email,
          empId: empForm.empId,
          dob: empForm.dob,
          pin: empForm.pin,
          position: empForm.position,
          house: empForm.house,
        },
        "Employee added",
      ).then((ok) => ok && resetForm());
    };
    const toggleActive = (e) =>
      call(
        `/api/employees/${e.empId}`,
        "PATCH",
        { active: !e.active },
        e.active ? "Employee marked inactive" : "Employee marked active",
      );
    return (
      <>
        <h1 className="db-page-title">Employee management</h1>
        <p>
          {employees.length} Employees · 1 Admin. No Manager role exists in this
          system.
        </p>
        <div className="split">
          <div className="card">
            <h2>Employees List</h2>
            <T
              head={[
                "ID",
                "Name",
                "Date of Birth",
                "Position",
                "House",
                "Status",
                "",
              ]}
            >
              {employees.length ? (
                employees.map((e) => (
                  <tr key={e.empId}>
                    <td>{e.empId}</td>
                    <td>
                      <b>{e.name}</b>
                    </td>
                    <td>{e.dob ? fmtFull(e.dob) : "—"}</td>
                    <td>{e.position}</td>
                    <td>{e.house}</td>
                    <td>
                      <Pl t={e.active === false ? "Inactive" : "Active"} />
                    </td>
                    <td>
                      <button className="btn" onClick={() => startEdit(e)}>
                        Edit
                      </button>{" "}
                      <button className="btn" onClick={() => toggleActive(e)}>
                        {e.active === false ? "Reactivate" : "Deactivate"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>No employees.</td>
                </tr>
              )}
            </T>
          </div>
          {empOpen ? (
            <div className="card">
              <div className="panel-head">
                <h2>{isEditing ? "Update employee" : "Add New Employee"}</h2>
                <button className="btn" onClick={resetForm}>
                  Cancel
                </button>
              </div>
              <label>Full name</label>
              <input
                value={empForm.name}
                onChange={set("name")}
                placeholder="e.g. Priya Menon"
              />
              {!isEditing && (
                <>
                  <label>Email</label>
                  <input
                    value={empForm.email}
                    onChange={set("email")}
                    placeholder="name@starcare.demo"
                  />
                  <label>Employee ID</label>
                  <input
                    value={empForm.empId}
                    onChange={set("empId")}
                    placeholder="e.g. 4829"
                  />
                  <label>PIN</label>
                  <input
                    value={empForm.pin}
                    onChange={set("pin")}
                    placeholder="4-digit PIN"
                  />
                </>
              )}
              <label>Date of Birth</label>
              <input
                type="date"
                max={today}
                value={empForm.dob}
                onChange={set("dob")}
              />
              <label>Position</label>
              <input
                value={empForm.position}
                onChange={set("position")}
                placeholder="e.g. Caregiver"
              />
              <label>House</label>
              <select value={empForm.house} onChange={set("house")}>
                {HOUSES.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <button className="btn b w" onClick={submit}>
                {isEditing ? "Save changes" : "Add New employee"}
              </button>
            </div>
          ) : (
            <div className="card panel-empty">
              <button className="btn" onClick={() => setEmpOpen(true)}>
                + Add New Employee
              </button>
              <h2>Employee Actions</h2>
              <p>
                Click "+ Add New Employee" to create a record, or "Edit" on a
                row to update an existing employee.
              </p>
              <ul>
                <li>Name, Employee ID and Date of Birth are required</li>
                <li>Each Employee ID must be unique</li>
                <li>The PIN and Date of Birth are used for timesheet sign-in</li>
                <li>Each employee is assigned to one House</li>
                <li>Deactivate instead of deleting to keep history</li>
              </ul>
            </div>
          )}
        </div>
      </>
    );
  };

  const complete = () => {
    const x = todo.find((t) => t.id === item);
    if (!x)
      return (
        <>
          <h1 className="db-page-title">Nothing to complete</h1>
          <button className="btn" onClick={() => setTab("Dashboard")}>
            Back to dashboard
          </button>
        </>
      );
    const send = (data) =>
      call(
        "/api/todo",
        "POST",
        { itemId: x.id, data },
        `${x.title} completed`,
      ).then((ok) => ok && setTab("Dashboard"));
    return (
      <>
        <h1 className="db-page-title">{x.title}</h1>
        <p>{x.sub}</p>
        <div className="card" style={{ marginTop: 16, maxWidth: 560 }}>
          {x.kind === "shift" && (
            <>
              <label>Your answer</label>
              <select
                value={ack.answer}
                onChange={(e) => setAck({ ...ack, answer: e.target.value })}
              >
                <option>Confirm</option>
                <option>Cannot attend</option>
              </select>
              <button
                className="btn b w"
                onClick={() => send({ answer: ack.answer })}
              >
                Send answer
              </button>
            </>
          )}
          {x.kind === "training" && (
            <>
              <label>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={ack.acknowledged}
                  onChange={(e) =>
                    setAck({ ...ack, acknowledged: e.target.checked })
                  }
                />{" "}
                I have completed and understood this training.
              </label>
              <button
                className="btn b w"
                onClick={() => send({ acknowledged: ack.acknowledged })}
              >
                Acknowledge
              </button>
            </>
          )}
          <button className="btn w" onClick={() => setTab("Dashboard")}>
            Back
          </button>
        </div>
      </>
    );
  };
  const pendLeave = reqs.filter((r) => r.st === "Pending").length,
    openSwaps = swaps.filter((s) => OPEN_SWAP.includes(s.st)).length;
  const view =
    wb === "Employee Portal"
      ? ({
          "My Schedule": schedule,
          "House Schedule": schedule,
          Leave: leave,
          "Shift Swap": swap,
          Timesheets: timesheet,
          "My Hours": myHours,
          Complete: complete,
        }[tab]?.() ?? dash())
      : wb === "Approval Center"
        ? approvals()
        : wb === "Recruitment"
          ? recruit()
          : wb === "Employee Management"
            ? employeeMgmt()
            : wb === "Reports"
              ? reportsPage()
              : wb === "Audit Trail"
                ? auditPage()
                : audit();
  const recent = notifs.slice().reverse().slice(0, 8);
  return (
    <>
      <div className="top">
        <Link href="/" className="brand brand-link">
          <Image
            src="/starcare_logo.gif"
            alt="Starcare Logo"
            width={150}
            height={150}
            unoptimized
            className="logo"
          />
          <span className="brand-name">Starcare of Tennessee</span>
        </Link>
        <div className="right">
          <div className="nav nav-actions">
            {tabsOf(wb).map((x) => {
              const ModuleIcon = TAB_ICONS[x] || LayoutDashboard;
              return (
                <span
                  key={x}
                  className={"tab " + (x === tab ? "on" : "")}
                  onClick={() => go(x)}
                >
                  <ModuleIcon
                    className="tab-icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {x}
                </span>
              );
            })}
          </div>
          <div style={{ position: "relative" }}>
            <button
              className="bellbtn"
              title="Notifications"
              onClick={() => {
                setBell(!bell);
                setMenu(false);
                setSeen(notifs.length);
              }}
            >
              ⚠️
              {notifs.length > seen && (
                <span className="dot">{notifs.length - seen}</span>
              )}
            </button>
            {bell && (
              <div className="menu notification-dropdown">
                <small>Notifications</small>
                {recent.length ? (
                  recent.map((x) => (
                    <div key={x.id} className="nt">
                      {x.text}
                      <small>{fmtStamp(new Date(x.at))}</small>
                    </div>
                  ))
                ) : (
                  <div className="nt">No notifications yet.</div>
                )}
              </div>
            )}
          </div>
          <div className="profile-menu">
            <button
              className="me profile-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => {
                setMenu(!menu);
                setBell(false);
              }}
            >
              <div className="av">{initialsOf(n)}</div>
              <div>
                <b>{n}</b>
                <small>{user.role === "Admin" ? "Administrator" : user.role}</small>
              </div>
              <ChevronDown
                size={18}
                className={"profile-chevron" + (menu ? " open" : "")}
                aria-hidden="true"
              />
            </button>
            {menu && (
              <div
                className="menu profile-dropdown"
                role="menu"
                aria-label="Workspaces"
              >
                <small>Switch workspace</small>
                {user.wb.map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="menuitem"
                    className={"mi " + (w === wb ? "on" : "")}
                    onClick={() => pick(w)}
                  >
                    <span>
                      {w === "Approval Center"
                        ? "Approval Center (Leave & Swap Requests)"
                        : w}
                    </span>
                    {w === "Approval Center" ? (
                      <span className="pl a">{pendLeave + openSwaps}</span>
                    ) : (
                      w === wb && <span style={{ color: "var(--ink)" }}>✓</span>
                    )}
                  </button>
                ))}
                <div className="menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="mi signout-item"
                  style={{ color: "red" }}
                  onClick={signOut}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <main>{view}</main>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
