import cron from 'node-cron';
import { db } from './store.js';
import { fadeAndStartPlaylist, getSpotifyPlaylists } from './spotify.js';

// Map de "id de l'entrée calendrier" -> tâche cron active
const activeTasks = new Map<number, ReturnType<typeof cron.schedule>>();

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function findPlaylistId(accountId: string, playlistName: string): Promise<string | null> {
  const data = await getSpotifyPlaylists(accountId);
  if (!data) return null;
  const target = normalize(playlistName);
  const found = data.items.find((p: any) => normalize(p.name) === target);
  return found ? found.id : null;
}

function startTask(entry: { id: number; accountId: string; playDate: string; hour: number; minute: number; playlistName: string }) {
  if (activeTasks.has(entry.id)) {
    activeTasks.get(entry.id)!.stop();
    activeTasks.delete(entry.id);
  }

  const d = new Date(entry.playDate + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth() + 1;
  // Expression pour une date précise (jour + mois exacts). Comme l'entrée est
  // supprimée/arrêtée après son déclenchement, elle ne revient pas l'année suivante.
  const expression = `${entry.minute} ${entry.hour} ${day} ${month} *`;

  try {
    const task = cron.schedule(expression, async () => {
      try {
        console.log(`[Calendar] Cron fired for entry ${entry.id} (${entry.playDate} ${entry.hour}:${entry.minute})`);

        const fresh = await db.getCalendarEntry(entry.id);
        if (!fresh) return;

        // Anti double-déclenchement (redémarrage serveur, etc.)
        const fiveMinutesAgo = Date.now() - 300_000;
        if (fresh.triggeredAt && fresh.triggeredAt > fiveMinutesAgo) {
          console.log(`[Calendar] Entry ${entry.id} already triggered recently, skipping`);
          return;
        }

        const playlistId = await findPlaylistId(fresh.accountId, fresh.playlistName);
        if (!playlistId) {
          console.error(`[Calendar] Playlist introuvable: "${fresh.playlistName}" (compte ${fresh.accountId})`);
          await db.markCalendarStatus(entry.id, 'playlist_introuvable');
          return;
        }

        await db.markCalendarTriggered(entry.id);
        const success = await fadeAndStartPlaylist(fresh.accountId, playlistId);

        if (success) {
          await db.updateLastPushed(fresh.accountId, fresh.playlistName);
          await db.markCalendarStatus(entry.id, 'ok');
          console.log(`[Calendar] OK - "${fresh.playlistName}" lancée pour ${fresh.accountId}`);
        } else {
          await db.markCalendarStatus(entry.id, 'echec_lecture');
          console.error(`[Calendar] FAILED - "${fresh.playlistName}" pour ${fresh.accountId}`);
        }
      } catch (err) {
        console.error(`[Calendar] Error in cron callback for entry ${entry.id}:`, err);
      } finally {
        // Ponctuel : on arrête la tâche après son unique déclenchement
        stopTask(entry.id);
      }
    }, { timezone: 'Asia/Manila' });

    activeTasks.set(entry.id, task);
    console.log(`[Calendar] Registered: entry ${entry.id} (${expression}) - "${entry.playlistName}"`);
  } catch (err) {
    console.error(`[Calendar] Invalid cron for entry ${entry.id}:`, err);
  }
}

function stopTask(id: number) {
  const task = activeTasks.get(id);
  if (task) {
    task.stop();
    activeTasks.delete(id);
  }
}

export async function initCalendarScheduler() {
  for (const [, task] of activeTasks) task.stop();
  activeTasks.clear();

  const upcoming = await db.getUpcomingCalendarEntries();
  for (const entry of upcoming) startTask(entry);
  console.log(`[Calendar] Initialized with ${upcoming.length} upcoming calendar entries`);

  // Reprend les entrées ajoutées après le démarrage (ex: nouvel import Excel)
  setInterval(async () => {
    try {
      const latest = await db.getUpcomingCalendarEntries();
      for (const entry of latest) {
        if (!activeTasks.has(entry.id)) {
          console.log(`[Calendar] Discovered new entry ${entry.id}, registering`);
          startTask(entry);
        }
      }
      for (const [id] of activeTasks) {
        const still = latest.find(e => e.id === id);
        if (!still) stopTask(id);
      }
    } catch (e) {
      console.error('[Calendar] Sync poll error:', e);
    }
  }, 60_000);
}
