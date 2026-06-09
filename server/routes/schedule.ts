import type { Context } from "hono";
import { getSchedule, getCurrentPhase } from "../lib/scheduler";
import { readJsonAsync } from "../lib/store";

function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return dateToISO(d);
}

export async function getScheduleRange(c: Context) {
  const today = dateToISO(new Date());
  const from = (c.req.query("from") as string) ?? addDays(today, -14);
  const to = (c.req.query("to") as string) ?? addDays(today, 21);

  const days = await getSchedule(from, to);
  return c.json(days);
}

export async function getScheduleDay(c: Context) {
  const date = c.req.param("date") as string;
  const [days, workouts, exercises, phaseInfo] = await Promise.all([
    getSchedule(date, date),
    readJsonAsync<Record<string, unknown>>("workouts"),
    readJsonAsync<{ id: string }[]>("exercises"),
    getCurrentPhase(),
  ]);

  const day = days[0];
  if (!day) return c.json({ error: "Invalid date" }, 400);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  let workoutDetail = null;
  if (day.workoutType) {
    const resolvedKey = workouts[day.workoutType] ? day.workoutType : `${day.workoutType}_circuit`;
    const wk = workouts[resolvedKey] as {
      name: string;
      durationMin: number;
      exercises: { exerciseId: string; sets: number; reps: number; weightKg: number; restSec: number; durationSec?: number; note?: string }[];
    };
    if (wk?.exercises) {
      workoutDetail = {
        name: wk.name,
        durationMin: wk.durationMin,
        exercises: wk.exercises.map((e) => ({
          ...e,
          exercise: exerciseMap.get(e.exerciseId) ?? null,
          completed: day.completedExercises.includes(e.exerciseId),
        })),
      };
    }
  }

  return c.json({ ...day, phase: phaseInfo, workoutDetail });
}
