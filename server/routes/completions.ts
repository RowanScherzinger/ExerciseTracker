import type { Context } from "hono";
import { readJsonAsync, writeJsonAsync } from "../lib/store";

interface Completion {
  date: string;
  workoutType: string;
  completedExercises: string[];
  notes?: string;
}

export async function getCompletions(c: Context) {
  const completions = await readJsonAsync<Completion[]>("completions");
  return c.json(completions);
}

export async function postCompletion(c: Context) {
  const body = await c.req.json<Completion>();
  if (!body.date || !body.workoutType) {
    return c.json({ error: "date and workoutType are required" }, 400);
  }

  const completions = await readJsonAsync<Completion[]>("completions");
  const idx = completions.findIndex((c) => c.date === body.date);

  if (idx >= 0) {
    completions[idx] = { ...completions[idx], ...body };
  } else {
    completions.unshift(body);
  }

  await writeJsonAsync("completions", completions);
  return c.json(completions.find((c) => c.date === body.date)!);
}

export async function patchCompletion(c: Context) {
  const date = c.req.param("date");
  const body = await c.req.json<Partial<Completion>>();

  const completions = await readJsonAsync<Completion[]>("completions");
  const idx = completions.findIndex((c) => c.date === date);

  if (idx < 0) return c.json({ error: "Completion not found" }, 404);

  completions[idx] = { ...completions[idx], ...body };
  await writeJsonAsync("completions", completions);
  return c.json(completions[idx]);
}
