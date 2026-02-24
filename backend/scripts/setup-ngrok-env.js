#!/usr/bin/env node

/**
 * Writes the backend URL to frontend/.env.local
 * Uses the Orchids public URL (derived from the backend .env or a fixed pattern),
 * and preserves existing variables in .env.local instead of overwriting them.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getOrchidsBackendUrl() {
  // Try to detect the Orchids URL from environment
  const hostname = process.env.ORCHIDS_HOSTNAME || process.env.HOST || '';
  if (hostname && hostname.includes('orchids.cloud')) {
    return `https://${hostname}`;
  }

  // Try to read from backend .env
  try {
    const backendEnv = path.join(__dirname, '../.env');
    const content = fs.readFileSync(backendEnv, 'utf-8');
    const match = content.match(/BACKEND_URL=(.+)/);
    if (match) return match[1].trim();
  } catch {}

  // Derive from current process port - use Orchids convention
  const projectId = process.env.PROJECT_ID || '';
  if (projectId) {
    return `https://3002-${projectId}.orchids.cloud`;
  }

  return null;
}

function updateEnvFile(envPath, key, value) {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf-8');
  } catch {}

  const lines = content.split('\n').filter(Boolean);
  const existing = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (existing >= 0) {
    lines[existing] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

async function main() {
  const envPath = path.join(__dirname, '../../frontend/.env.local');

  // Try ngrok first
  try {
    const response = await fetch('http://localhost:4040/api/tunnels', { signal: AbortSignal.timeout(3000) });
    const data = await response.json();
    const tunnel = data.tunnels?.find((t) => t.proto === 'https');
    if (tunnel?.public_url) {
      updateEnvFile(envPath, 'EXPO_PUBLIC_BACKEND_URL', tunnel.public_url);
      console.log(`✅ Backend URL (ngrok): ${tunnel.public_url}`);
      return;
    }
  } catch {}

  // Try Orchids URL detection
  const orchidsUrl = getOrchidsBackendUrl();
  if (orchidsUrl) {
    updateEnvFile(envPath, 'EXPO_PUBLIC_BACKEND_URL', orchidsUrl);
    console.log(`✅ Backend URL (orchids): ${orchidsUrl}`);
    return;
  }

  // Keep existing value if present, otherwise use localhost
  let existing = '';
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/EXPO_PUBLIC_BACKEND_URL=(.+)/);
    if (match) {
      existing = match[1].trim();
    }
  } catch {}

  if (!existing) {
    updateEnvFile(envPath, 'EXPO_PUBLIC_BACKEND_URL', 'http://localhost:3002');
    console.log('⚠️  Using localhost:3002 as fallback');
  } else {
    console.log(`ℹ️  Keeping existing backend URL: ${existing}`);
  }
}

main();
