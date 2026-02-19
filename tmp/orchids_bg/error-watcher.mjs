import { readdir, readFile as readFileAsync } from 'node:fs/promises';
import { statSync, openSync, readSync, closeSync, watch, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const BACKEND_URL = 'https://orchids-server.calmstone-6964e08a.westeurope.azurecontainerapps.io';
const PROJECT_ID  = 'c9286b95-d861-438f-b125-56b9b8584359';
const BG_DIR      = '/tmp/orchids_bg';
const TAIL_BYTES  = 50000;
const DEBOUNCE_MS = 500;

console.log('[error-watcher] Started (fs.watch mode). BACKEND_URL=' + BACKEND_URL + ' PROJECT_ID=' + PROJECT_ID);

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)/g;
const stripAnsi = (s) => s.replace(ANSI_RE, '');
// Strip concurrently [N] prefixes from log lines
const CONCURRENTLY_RE = /^\[\d+\]\s*/gm;
const stripConcurrently = (s) => s.replace(CONCURRENTLY_RE, '');

const ERROR_LINE_RE = /ERROR\s{2,}(.+)/g;
const BUNDLED_RE = /(?:Web|iOS|Android|\u03bb)\s*Bundled\s+\d+ms/g;

const IGNORED_PATTERNS = [
  /Tried to register two views with the same name RNSVG/,
  /Tried to register two views with the same name RNS/,
  /ERR_NGROK/,
  /ngrok.*authtoken/i,
  /Sign up for an account/,
];
const isIgnored = (msg) => IGNORED_PATTERNS.some(re => re.test(msg));

// Bun outputs: 'error: <message>' (lowercase) followed by stack frames '      at <loc>'
// We require the full Bun error signature: numbered source lines + caret + error: + at
// This is extremely precise and avoids false positives from console.error() etc.
const BUN_ERROR_RE = /^error:\s+(.+)/gm;
const STACK_FRAME_RE = /^\s+at\s+/m;
const SOURCE_LINE_RE = /^\d+\s*\|/m;
const CARET_RE = /^\s*\^/m;

let lastHash = '';
let checkCount = 0;
let debounceTimer = null;
const watchers = new Map();
const processTypeCache = new Map();

async function getLogEntries() {
  try {
    const entries = await readdir(BG_DIR, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    return dirs.map(d => ({
      logPath: BG_DIR + '/' + d + '/output.log',
      bgDir: BG_DIR + '/' + d,
    }));
  } catch { return []; }
}

function classifyProcess(bgDir) {
  if (processTypeCache.has(bgDir)) return processTypeCache.get(bgDir);
  try {
    const script = readFileSync(bgDir + '/run.sh', 'utf-8');
    const type = script.includes('cd frontend') ? 'metro' : 'backend';
    processTypeCache.set(bgDir, type);
    return type;
  } catch {
    return 'unknown';
  }
}

function readTail(path) {
  try {
    const stat = statSync(path);
    const start = Math.max(0, stat.size - TAIL_BYTES);
    const buf = Buffer.alloc(Math.min(stat.size, TAIL_BYTES));
    const fd = openSync(path, 'r');
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    return buf.toString('utf-8');
  } catch { return ''; }
}

function detectMetroErrors(text) {
  const clean = stripAnsi(text);
  let lastBundledPos = -1;
  let bm;
  BUNDLED_RE.lastIndex = 0;
  while ((bm = BUNDLED_RE.exec(clean)) !== null) {
    lastBundledPos = bm.index + bm[0].length;
  }
  const searchText = lastBundledPos > 0 ? clean.substring(lastBundledPos) : clean;
  const errors = [];
  let m;
  ERROR_LINE_RE.lastIndex = 0;
  while ((m = ERROR_LINE_RE.exec(searchText)) !== null) {
    const msg = m[1]?.trim();
    if (!msg || isIgnored(msg)) continue;
    const rest = searchText.substring(m.index + m[0].length);
    const nextErr = rest.search(/ERROR\s{2,}/);
    const block = nextErr > 0 ? rest.substring(0, nextErr) : rest.substring(0, 2000);
    let fullMsg = msg;
    const codeMatch = block.match(/Code:\s*(\S+\.(?:tsx?|jsx?))/);
    if (codeMatch) fullMsg += ' in ' + codeMatch[1];
    errors.push({ message: fullMsg, timestamp: Date.now(), source: 'expo' });
  }
  return errors;
}

// Matches Bun's exact error output: numbered source lines, caret pointer,
// then 'error: <msg>' followed by '      at <location>' stack frames.
// This full-signature match is extremely precise — no false positives.
// Like Metro's Bundled marker, we only look at errors AFTER the last
// successful server restart ('Started development server') so that
// fixed errors don't persist.
const SERVER_STARTED_RE = /Started development server/g;

function detectBunErrors(text) {
  const clean = stripConcurrently(stripAnsi(text));
  // Debug: show last 300 chars of cleaned text to verify restart marker presence
  const tail300 = clean.substring(clean.length - 300).replace(/\n/g, '\\n');
  console.log('[error-watcher] detectBunErrors TAIL: ' + tail300);
  // Find the last 'Started development server' marker — only errors after it matter
  let lastRestartPos = -1;
  let restartCount = 0;
  let sm;
  SERVER_STARTED_RE.lastIndex = 0;
  while ((sm = SERVER_STARTED_RE.exec(clean)) !== null) {
    restartCount++;
    lastRestartPos = sm.index + sm[0].length;
    console.log('[error-watcher] Found restart marker #' + restartCount + ' at pos ' + sm.index + ' (total clean length=' + clean.length + ')');
  }
  const searchText = lastRestartPos > 0 ? clean.substring(lastRestartPos) : clean;
  console.log('[error-watcher] detectBunErrors: restartCount=' + restartCount + ' lastRestartPos=' + lastRestartPos + ' searchText length=' + searchText.length + ' (clean length=' + clean.length + ')');
  // Debug: show first 200 chars of searchText to see what we're scanning for errors
  console.log('[error-watcher] searchText HEAD: ' + searchText.substring(0, 200).replace(/\n/g, '\\n'));
  const errors = [];
  let m;
  let matchCount = 0;
  BUN_ERROR_RE.lastIndex = 0;
  while ((m = BUN_ERROR_RE.exec(searchText)) !== null) {
    matchCount++;
    const msg = m[1]?.trim();
    console.log('[error-watcher] BUN match #' + matchCount + ': "' + msg + '"');
    if (!msg || isIgnored(msg)) { console.log('[error-watcher]   -> skipped (empty or ignored)'); continue; }
    const preceding = searchText.substring(Math.max(0, m.index - 500), m.index);
    const hasCaret = CARET_RE.test(preceding);
    const hasSourceLine = SOURCE_LINE_RE.test(preceding);
    console.log('[error-watcher]   -> hasCaret=' + hasCaret + ' hasSourceLine=' + hasSourceLine);
    if (!hasCaret || !hasSourceLine) { console.log('[error-watcher]   -> skipped (missing caret/source)'); continue; }
    const following = searchText.substring(m.index + m[0].length, m.index + m[0].length + 1000);
    const hasStack = STACK_FRAME_RE.test(following);
    console.log('[error-watcher]   -> hasStack=' + hasStack);
    if (!hasStack) { console.log('[error-watcher]   -> skipped (no stack frame)'); continue; }
    let fullMsg = msg;
    const fileMatch = following.match(/\((\/[^)]+\.(?:ts|tsx|js|jsx)):\d+/);
    if (fileMatch) {
      const rel = fileMatch[1].replace(/^\/home\/user\/app\//, '');
      fullMsg += ' in ' + rel;
    }
    console.log('[error-watcher]   -> ACCEPTED: ' + fullMsg);
    errors.push({ message: fullMsg, timestamp: Date.now(), source: 'backend' });
  }
  console.log('[error-watcher] detectBunErrors: ' + matchCount + ' regex matches, ' + errors.length + ' accepted');
  return errors;
}

function dedup(errors) {
  const seen = new Set();
  return errors.filter(e => {
    if (seen.has(e.message)) return false;
    seen.add(e.message);
    return true;
  }).slice(0, 20);
}

// For backend processes, multiple bg dirs may exist from old runs.
// Only scan the most recently modified log to avoid stale errors.
function pickMostRecentLog(entries) {
  let best = null;
  let bestMtime = 0;
  for (const entry of entries) {
    try {
      const st = statSync(entry.logPath);
      if (st.mtimeMs > bestMtime) {
        bestMtime = st.mtimeMs;
        best = entry;
      }
    } catch {}
  }
  return best;
}

async function check() {
  checkCount++;
  try {
    const entries = await getLogEntries();
    console.log('[error-watcher] Check #' + checkCount + ' | entries: ' + entries.length);
    let allErrors = [];
    const metroEntries = [];
    const backendEntries = [];
    // Classify entries by type
    for (const entry of entries) {
      const type = classifyProcess(entry.bgDir);
      console.log('[error-watcher] ' + entry.bgDir + ' -> type=' + type);
      if (type === 'metro') {
        metroEntries.push(entry);
      } else if (type === 'backend') {
        backendEntries.push(entry);
      }
    }
    // Backend: only scan the most recently modified log (avoids stale old processes)
    if (backendEntries.length > 0) {
      const newest = pickMostRecentLog(backendEntries);
      if (newest) {
        console.log('[error-watcher] Using most recent backend log: ' + newest.bgDir + ' (of ' + backendEntries.length + ' candidates)');
        const text = readTail(newest.logPath);
        if (text) {
          const bunErrs = detectBunErrors(text);
          allErrors = allErrors.concat(bunErrs);
        }
      }
    }
    // Metro: combine all metro logs and detect
    if (metroEntries.length > 0) {
      const metroTexts = metroEntries.map(e => readTail(e.logPath)).filter(Boolean);
      const metroErrs = detectMetroErrors(metroTexts.join(''));
      allErrors = allErrors.concat(metroErrs);
    }
    // Dedup and hash
    const errors = dedup(allErrors);
    const hash = createHash('md5').update(JSON.stringify(errors.map(e => e.message))).digest('hex');
    if (hash !== lastHash) {
      const postUrl = BACKEND_URL + '/sandbox/dev-server-errors';
      console.log('[error-watcher] State changed (' + lastHash.substring(0,8) + ' -> ' + hash.substring(0,8) + '), POSTing ' + errors.length + ' errors');
      lastHash = hash;
      try {
        const res = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: PROJECT_ID, errors }),
        });
        console.log('[error-watcher] POST ' + res.status);
      } catch (e) {
        console.log('[error-watcher] POST failed: ' + (e?.message || e));
      }
    }
  } catch (e) {
    console.log('[error-watcher] Check error: ' + (e?.message || e));
  }
}

function scheduleCheck() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(check, DEBOUNCE_MS);
}

function watchFile(filePath) {
  if (watchers.has(filePath)) return;
  if (!existsSync(filePath)) return;
  try {
    const w = watch(filePath, () => scheduleCheck());
    w.on('error', () => { watchers.delete(filePath); });
    watchers.set(filePath, w);
    console.log('[error-watcher] Watching: ' + filePath);
  } catch {}
}

async function refreshWatchers() {
  const entries = await getLogEntries();
  for (const { logPath } of entries) watchFile(logPath);
}

try {
  watch(BG_DIR, () => refreshWatchers());
  console.log('[error-watcher] Watching directory: ' + BG_DIR);
} catch (e) {
  console.log('[error-watcher] Could not watch BG_DIR: ' + (e?.message || e));
}

refreshWatchers().then(() => setTimeout(check, 1000));
setInterval(refreshWatchers, 30000);