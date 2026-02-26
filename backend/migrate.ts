import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_FILE = join(process.cwd(), 'data.json');

async function migrate() {
  if (!existsSync(DATA_FILE)) {
    console.log('No data.json found, skipping migration.');
    return;
  }

  const raw = readFileSync(DATA_FILE, 'utf-8');
  const store = JSON.parse(raw);

  console.log(`Migrating ${Object.keys(store.accounts).length} accounts...`);
  for (const account of Object.values(store.accounts) as any) {
    const { error } = await supabase.from('spotify_accounts').upsert({
      id: account.id,
      display_name: account.displayName,
      email: account.email,
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expires_at: account.expiresAt,
      added_at: account.addedAt,
    });
    if (error) console.error(`Error migrating account ${account.id}:`, error);
  }

  console.log(`Migrating ${Object.keys(store.schedules).length} schedules...`);
  for (const schedule of Object.values(store.schedules) as any) {
    const { error } = await supabase.from('schedules').upsert({
      id: schedule.id,
      name: schedule.name,
      account_id: schedule.accountId,
      playlist_id: schedule.playlistId,
      playlist_name: schedule.playlistName,
      playlist_image_url: schedule.playlistImageUrl,
      cron_expression: schedule.cronExpression,
      days: schedule.days,
      hour: schedule.hour,
      minute: schedule.minute,
      active: schedule.active,
      created_at: schedule.createdAt,
      last_triggered_at: schedule.lastTriggeredAt,
      device_id: schedule.deviceId,
      device_name: schedule.deviceName,
      shuffle: schedule.shuffle,
    });
    if (error) console.error(`Error migrating schedule ${schedule.id}:`, error);
  }

  console.log('Migration complete!');
}

migrate();
