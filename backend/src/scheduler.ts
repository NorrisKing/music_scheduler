import cron from 'node-cron';
import { db, type Schedule } from './store.js';
import { startPlaylist } from './spotify.js';

// Map of schedule id -> cron task
const activeTasks = new Map<string, ReturnType<typeof cron.schedule>>();

function buildCronExpression(days: number[], hour: number, minute: number): string {
  const daysStr = days.length === 7 ? '*' : days.join(',');
  return `${minute} ${hour} * * ${daysStr}`;
}

function startTask(schedule: Schedule) {
  if (activeTasks.has(schedule.id)) {
    activeTasks.get(schedule.id)!.stop();
    activeTasks.delete(schedule.id);
  }

  if (!schedule.active) return;

  const expression = buildCronExpression(schedule.days, schedule.hour, schedule.minute);

  try {
    const task = cron.schedule(expression, async () => {
      console.log(`[Scheduler] Cron fired for schedule ${schedule.id}`);

      // Check if schedule is still active
      const fresh = await db.getSchedule(schedule.id);
      if (!fresh || !fresh.active) return;

      // Atomic distributed lock: only one backend instance can claim this trigger window.
      // Prevents double-trigger when local dev + Railway backend both run simultaneously.
      const claimed = await db.tryMarkTriggered(schedule.id);
      if (!claimed) {
        console.log(`[Scheduler] Schedule ${schedule.id} already claimed by another instance, skipping`);
        return;
      }
      console.log(`[Scheduler] Triggering schedule ${schedule.id} for account ${schedule.accountId}`);

      const success = await startPlaylist(
        schedule.accountId,
        schedule.playlistId,
        schedule.deviceId,
      );

      if (success) {
        await db.updateLastPushed(schedule.accountId, schedule.playlistName);
        console.log(`[Scheduler] OK - playlist ${schedule.playlistId} started`);
      } else {
        console.error(`[Scheduler] FAILED - playlist ${schedule.playlistId}`);
      }
    }, { timezone: 'Asia/Manila' });

    activeTasks.set(schedule.id, task);
    console.log(`[Scheduler] Registered: ${schedule.id} (${expression})`);
  } catch (err) {
    console.error(`[Scheduler] Invalid cron for schedule ${schedule.id}:`, err);
  }
}

function stopTask(scheduleId: string) {
  const task = activeTasks.get(scheduleId);
  if (task) {
    task.stop();
    activeTasks.delete(scheduleId);
    console.log(`[Scheduler] Stopped: ${scheduleId}`);
  } else {
    console.log(`[Scheduler] Unregister: ${scheduleId} not found in activeTasks`);
  }
}

export async function initScheduler() {
  // Stop all existing tasks first to prevent ghost tasks
  for (const [id, task] of activeTasks) {
    task.stop();
    activeTasks.delete(id);
  }
  const all = await db.getSchedules();
  const schedules = all.filter((s) => s.active);
  for (const schedule of schedules) {
    startTask(schedule);
  }
  console.log(`[Scheduler] Initialized with ${schedules.length} active schedules`);
}

export const scheduler = {
  register: startTask,
  unregister: stopTask,
  async reload(scheduleId: string) {
    const schedule = await db.getSchedule(scheduleId);
    if (schedule) {
      startTask(schedule);
    } else {
      stopTask(scheduleId);
    }
  },
  buildCronExpression,
};
