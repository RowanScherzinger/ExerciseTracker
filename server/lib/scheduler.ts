import { readJsonAsync } from "./store";

export type WorkoutType = "A" | "B" | "C" | null;
export type DayStatus = "scheduled" | "completed" | "partial" | "missed" | "rest" | "rescheduled-here";

export interface ScheduleDay {
  date: string;
  workoutType: WorkoutType;
  status: DayStatus;
  completedExercises: string[];
  totalExercises: number;
  rescheduledFrom?: string;
}

interface PlanData {
  startDate: string;
  weeklyPattern: (string | null)[];
  phases: { name: string; slug: string; startMonth: number; endMonth: number | null }[];
}

interface Completion {
  date: string;
  workoutType: string;
  completedExercises: string[];
}

interface Reschedule {
  originalDate: string;
  rescheduledTo: string;
  workoutType: string;
}

interface WorkoutDef {
  exercises: { exerciseId: string }[];
}

interface WorkoutsData {
  [key: string]: WorkoutDef;
}

function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return dateToISO(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

function isPast(date: string): boolean {
  const today = dateToISO(new Date());
  return date < today;
}

export async function getSchedule(from: string, to: string): Promise<ScheduleDay[]> {
  const [plan, completions, reschedules, workouts]: [PlanData, Completion[], Reschedule[], WorkoutsData] =
    await Promise.all([
      readJsonAsync("plan"),
      readJsonAsync("completions"),
      readJsonAsync("reschedules"),
      readJsonAsync("workouts"),
    ]);

  const completionMap = new Map<string, Completion>(completions.map((c) => [c.date, c]));
  const rescheduleByOriginal = new Map<string, Reschedule>(reschedules.map((r) => [r.originalDate, r]));
  const rescheduleByTarget = new Map<string, Reschedule>(reschedules.map((r) => [r.rescheduledTo, r]));

  const days: ScheduleDay[] = [];
  let cursor = from;

  while (cursor <= to) {
    const offsetDays = daysBetween(plan.startDate, cursor);
    const weekIndex = ((offsetDays % 7) + 7) % 7;
    let workoutType = (plan.weeklyPattern[weekIndex] as WorkoutType) ?? null;

    // Rescheduled-to: this rest day now has a workout
    const reschedHere = rescheduleByTarget.get(cursor);
    if (reschedHere) {
      workoutType = reschedHere.workoutType as WorkoutType;
    }

    const totalExercises = workoutType
      ? (workouts[workoutType]?.exercises?.length ?? workouts[`${workoutType}_circuit`]?.exercises?.length ?? 0)
      : 0;

    const completion = completionMap.get(cursor);
    const completedExercises = completion?.completedExercises ?? [];

    let status: DayStatus;
    if (!workoutType) {
      status = "rest";
    } else if (reschedHere) {
      status = completion
        ? completedExercises.length === totalExercises
          ? "completed"
          : "partial"
        : isPast(cursor)
        ? "missed"
        : "rescheduled-here";
    } else if (completion) {
      status = completedExercises.length === totalExercises ? "completed" : "partial";
    } else if (isPast(cursor)) {
      // Check if this was rescheduled away
      const movedAway = rescheduleByOriginal.get(cursor);
      status = movedAway ? "rest" : "missed";
    } else {
      status = "scheduled";
    }

    const day: ScheduleDay = {
      date: cursor,
      workoutType,
      status,
      completedExercises,
      totalExercises,
    };
    if (reschedHere) day.rescheduledFrom = reschedHere.originalDate;

    days.push(day);
    cursor = addDays(cursor, 1);
  }

  return days;
}

export async function getCurrentPhase(phaseOverride?: string | null): Promise<{
  name: string;
  slug: string;
  monthsElapsed: number;
}> {
  const plan: PlanData = await readJsonAsync("plan");
  const today = dateToISO(new Date());
  const startDate = new Date(plan.startDate + "T00:00:00Z");
  const todayDate = new Date(today + "T00:00:00Z");
  const monthsElapsed = Math.floor(
    (todayDate.getFullYear() - startDate.getFullYear()) * 12 +
      todayDate.getMonth() -
      startDate.getMonth()
  );

  if (phaseOverride) {
    const found = plan.phases.find((p) => p.slug === phaseOverride);
    if (found) return { ...found, monthsElapsed };
  }

  const phase =
    plan.phases.find(
      (p) => monthsElapsed >= p.startMonth && (p.endMonth === null || monthsElapsed <= p.endMonth)
    ) ?? plan.phases[0];

  return { ...phase, monthsElapsed };
}
