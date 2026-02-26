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
        console.log(`[Scheduler] Triggering schedule ${schedule.id} for account ${schedule.accountId}`);
          const success = await startPlaylist(schedule.accountId, schedule.playlistId, schedule.deviceId, schedule.shuffle);
        if (success) {
          await db.markTriggered(schedule.id);
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
  }
}

export function initScheduler() {
  // Load all active schedules at startup
  const schedules = db.getSchedules().filter((s) => s.active);
  for (const schedule of schedules) {
    startTask(schedule);
  }
  console.log(`[Scheduler] Initialized with ${schedules.length} active schedules`);
}

export const scheduler = {
  register: startTask,
  unregister: stopTask,
  reload(scheduleId: string) {
    const schedule = db.getSchedule(scheduleId);
    if (schedule) {
      startTask(schedule);
    } else {
      stopTask(scheduleId);
    }
  },
  buildCronExpression,
};
