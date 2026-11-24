import { createServerFn } from "@tanstack/react-start";

export type Arrival = { time: string; load: string; type: string } | null;

export const getArrivals = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://arrivelah2.busrouter.sg/?id=53319");
  if (!res.ok) throw new Error("Bus data unavailable");
  const data = (await res.json()) as {
    services: { no: string; next?: Arrival; next2?: Arrival; next3?: Arrival }[];
  };
  const svc = data.services.find((s) => s.no === "410W");
  const pick = (a?: Arrival) => (a?.time ? { time: a.time, load: a.load, type: a.type } : null);
  return {
    fetchedAt: new Date().toISOString(),
    arrivals: svc ? [pick(svc.next), pick(svc.next2), pick(svc.next3)].filter(Boolean) as NonNullable<Arrival>[] : [],
  };
});
