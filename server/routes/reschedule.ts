import type { Context } from "hono";
import { readJsonAsync, writeJsonAsync } from "../lib/store";
import { getSchedule } from "../lib/scheduler";

interface Reschedule {
  originalDate: string;
  rescheduledTo: string;
  workoutType: string;
  reason?: string;
}

export async function getReschedules(c: Context) {
  const reschedules = await readJsonAsync<Reschedule[]>("reschedules");
  return c.json(reschedules);
}

export async function postReschedule(c: Context) {
  const body = await c.req.json<Reschedule>();
  if (!body.originalDate || !body.rescheduledTo || !body.workoutType) {
    return c.json({ error: "originalDate, rescheduledTo and workoutType are required" }, 400);
  }

  // Verify the target date is a rest day
  const [targetDays] = await Promise.all([getSchedule(body.rescheduledTo, body.rescheduledTo)]);
  const targetDay = targetDays[0];
  if (targetDay && targetDay.workoutType !== null && targetDay.status !== "rest") {
    return c.json({ error: "Target date already has a scheduled workout" }, 409);
  }

  const reschedules = await readJsonAsync<Reschedule[]>("reschedules");

  // Remove any existing reschedule for this original date
  const filtered = reschedules.filter((r) => r.originalDate !== body.originalDate);
  filtered.push(body);

  await writeJsonAsync("reschedules", filtered);
  return c.json(body);
}

export async function deleteReschedule(c: Context) {
  const originalDate = c.req.param("originalDate");
  const reschedules = await readJsonAsync<Reschedule[]>("reschedules");
  const filtered = reschedules.filter((r) => r.originalDate !== originalDate);

  if (filtered.length === reschedules.length) {
    return c.json({ error: "Reschedule not found" }, 404);
  }

  await writeJsonAsync("reschedules", filtered);
  return c.json({ deleted: true });
}

export async function getAvailableRestDays(c: Context) {
  // Returns future rest days available for rescheduling (next 60 days)
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const from = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 59);
  const to = d.toISOString().slice(0, 10);

  const days = await getSchedule(from, to);
  const restDays = days.filter((d) => d.status === "rest").map((d) => d.date);
  return c.json(restDays);
}
