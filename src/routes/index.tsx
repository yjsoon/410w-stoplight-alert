import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getArrivals } from "@/lib/bus.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "410W Run Alarm — Stop 53319" },
      { name: "description", content: "Live arrival for bus 410W at stop 53319, with a loud alarm when it's under 5 minutes away." },
      { property: "og:title", content: "410W Run Alarm" },
      { property: "og:description", content: "Know exactly when to run for bus 410W." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const ALERT_MS = 5 * 60 * 1000;

function useSiren(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!active || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    gain.gain.value = 0.6;
    osc.connect(gain).connect(ctx.destination);
    let up = true;
    const t = setInterval(() => {
      osc.frequency.setTargetAtTime(up ? 1400 : 700, ctx.currentTime, 0.05);
      up = !up;
    }, 350);
    osc.start();
    return () => { clearInterval(t); osc.stop(); };
  }, [active]);
  return ctxRef;
}

function fmt(ms: number) {
  if (ms <= 30000) return "Arriving";
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Index() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getArrivals>> | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [armed, setArmed] = useState(false);
  const [snoozedTime, setSnoozedTime] = useState<string | null>(null);

  useEffect(() => {
    const load = () => getArrivals().then((d) => { setData(d); setError(false); }).catch(() => setError(true));
    load();
    const a = setInterval(load, 20000);
    const b = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const next = data?.arrivals.find((a) => new Date(a.time).getTime() - now > -30000);
  const ms = next ? new Date(next.time).getTime() - now : null;
  const urgent = ms !== null && ms < ALERT_MS;
  const alarming = urgent && armed && snoozedTime !== next?.time;
  const ctxRef = useSiren(alarming);

  useEffect(() => {
    if (alarming && "vibrate" in navigator) navigator.vibrate([400, 200, 400, 200, 400]);
  }, [alarming]);

  const arm = () => {
    ctxRef.current ??= new AudioContext();
    void ctxRef.current.resume();
    setArmed(true);
  };

  return (
    <main className={`min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center transition-colors ${urgent ? "bg-alarm text-alarm-foreground animate-alarm" : "bg-background text-foreground"}`}>
      <div>
        <p className="font-display text-sm uppercase tracking-[0.3em] opacity-70">Stop 53319</p>
        <h1 className="font-display text-7xl font-black">410W</h1>
      </div>

      <div>
        <p className="text-sm uppercase tracking-widest opacity-70">{urgent ? "RUN NOW!" : "Next bus in"}</p>
        <p className="font-display text-[22vw] leading-none font-black tabular-nums md:text-[10rem]">
          {error ? "—" : ms === null ? (data ? "No bus" : "…") : fmt(ms)}
        </p>
      </div>

      {data && data.arrivals.length > 1 && (
        <p className="opacity-70">
          Then: {data.arrivals.slice(1).map((a) => fmt(new Date(a.time).getTime() - now)).join(" · ")}
        </p>
      )}

      {!armed ? (
        <button onClick={arm} className="rounded-full bg-primary px-8 py-4 font-display text-lg font-bold text-primary-foreground">
          🔔 Turn on alarm
        </button>
      ) : alarming ? (
        <button onClick={() => setSnoozedTime(next?.time ?? null)} className="rounded-full bg-background px-8 py-4 font-display text-lg font-bold text-foreground">
          I'm running — stop alarm
        </button>
      ) : (
        <p className="text-sm opacity-70">Alarm on · sounds when under 5 min. Keep this tab open.</p>
      )}
      {error && <p className="text-sm text-destructive">Couldn't reach bus data. Retrying…</p>}
    </main>
  );
}
