import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { getScheduleRange, getScheduleDay } from "./routes/schedule";
import { getCompletions, postCompletion, patchCompletion } from "./routes/completions";
import { getReschedules, postReschedule, deleteReschedule, getAvailableRestDays } from "./routes/reschedule";
import { readJsonAsync } from "./lib/store";
import { getCurrentPhase } from "./lib/scheduler";

const app = new Hono();

app.use("*", cors());

// API routes
const api = new Hono();

api.get("/schedule", getScheduleRange);
api.get("/schedule/:date", getScheduleDay);

api.get("/completions", getCompletions);
api.post("/completions", postCompletion);
api.patch("/completions/:date", patchCompletion);

api.get("/reschedules", getReschedules);
api.post("/reschedule", postReschedule);
api.delete("/reschedule/:originalDate", deleteReschedule);
api.get("/reschedule/available-days", getAvailableRestDays);

api.get("/exercises", async (c) => {
  const exercises = await readJsonAsync("exercises");
  return c.json(exercises);
});

api.get("/plan", async (c) => {
  const [plan, phase] = await Promise.all([readJsonAsync("plan"), getCurrentPhase()]);
  return c.json({ plan, currentPhase: phase });
});

app.route("/api", api);

// Serve static client files
app.use("/*", serveStatic({ root: "./client" }));
app.get("/", serveStatic({ path: "./client/index.html" }));

const PORT = parseInt(process.env.PORT ?? "3005");
console.log(`Exercise Planner running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
