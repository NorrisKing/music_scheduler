import cron from 'node-cron';
import { db, type Schedule } from './store.js';
import { fadeAndStartPlaylist } from './spotify.js';

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
      try {
        console.log(`[Scheduler] Cron fired for schedule ${schedule.id}`);

        // Check if schedule is still active
        const fresh = await db.getSchedule(schedule.id);
        if (!fresh || !fresh.active) return;

        // Debounce: skip if already triggered within the last 5 minutes
        const fiveMinutesAgo = Date.now() - 300_000;
        if (fresh.lastTriggeredAt && fresh.lastTriggeredAt > fiveMinutesAgo) {
          console.log(`[Scheduler] Schedule ${schedule.id} already triggered recently, skipping`);
          return;
        }

        // Mark as triggered (best-effort — don't block playback if DB write fails)
        try {
          await db.markTriggered(schedule.id);
        } catch (markErr) {
          console.error(`[Scheduler] Warning: failed to mark triggered:`, JSON.stringify(markErr));
        }
        console.log(`[Scheduler] Triggering schedule ${schedule.id} for account ${schedule.accountId}`);

        const success = await fadeAndStartPlaylist(
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
      } catch (err) {
        console.error(`[Scheduler] Error in cron callback for ${schedule.id}:`, JSON.stringify(err), err);
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
  for (const [, task] of activeTasks) task.stop();
  activeTasks.clear();

  const all = await db.getSchedules();
  const active = all.filter((s) => s.active);
  for (const schedule of active) {
    startTask(schedule);
  }
  console.log(`[Scheduler] Initialized with ${active.length} active schedules`);

  // Poll every minute to pick up schedules created after startup (e.g. from local dev)
  setInterval(async () => {
    try {
      const latest = await db.getSchedules();
      const latestActive = latest.filter(s => s.active);
      // Register new schedules not yet in activeTasks
      for (const s of latestActive) {
        if (!activeTasks.has(s.id)) {
          console.log(`[Scheduler] Discovered new schedule ${s.id}, registering`);
          startTask(s);
        }
      }
      // Stop tasks whose schedules have been deleted or deactivated
      for (const [id] of activeTasks) {
        const still = latestActive.find(s => s.id === id);
        if (!still) stopTask(id);
      }
    } catch (e) {
      console.error('[Scheduler] Sync poll error:', e);
    }
  }, 60_000);
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
