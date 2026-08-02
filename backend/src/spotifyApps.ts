// Registre des "lots" Spotify (une app Spotify = un Client ID = jusqu'à 5 comptes autorisés).
// Le lot historique s'appelle "lot1" et utilise la variable SPOTIFY_CLIENT_ID existante.
// Chaque lot supplémentaire se déclare via SPOTIFY_CLIENT_ID_LOT2, SPOTIFY_CLIENT_ID_LOT3, etc.

export interface SpotifyApp {
  lotId: string;
  clientId: string;
}

const MAX_ACCOUNTS_PER_LOT = 5;

function buildRegistry(): SpotifyApp[] {
  const apps: SpotifyApp[] = [];

  // lot1 = variable historique, sans suffixe
  if (process.env.SPOTIFY_CLIENT_ID) {
    apps.push({ lotId: 'lot1', clientId: process.env.SPOTIFY_CLIENT_ID });
  }

  // lot2, lot3, ... = SPOTIFY_CLIENT_ID_LOT2, SPOTIFY_CLIENT_ID_LOT3, ...
  let n = 2;
  while (process.env[`SPOTIFY_CLIENT_ID_LOT${n}`]) {
    apps.push({ lotId: `lot${n}`, clientId: process.env[`SPOTIFY_CLIENT_ID_LOT${n}`]! });
    n++;
  }

  return apps;
}

const REGISTRY = buildRegistry();

export function getAllSpotifyApps(): SpotifyApp[] {
  return REGISTRY;
}

export function getSpotifyApp(lotId: string | undefined | null): SpotifyApp {
  const app = REGISTRY.find((a) => a.lotId === lotId);
  if (app) return app;
  // Fallback : si le lot est inconnu (ancien compte sans lot_id, ou lot mal configuré),
  // on retombe sur le premier lot déclaré pour ne jamais planter.
  if (REGISTRY.length > 0) return REGISTRY[0];
  throw new Error('Aucune app Spotify configurée (SPOTIFY_CLIENT_ID manquant)');
}

// Donne le prochain lot ayant encore de la place, en fonction du nombre de comptes déjà assignés.
export function pickNextLot(accountCountsByLot: Record<string, number>): SpotifyApp | null {
  for (const app of REGISTRY) {
    const used = accountCountsByLot[app.lotId] || 0;
    if (used < MAX_ACCOUNTS_PER_LOT) return app;
  }
  return null; // tous les lots sont pleins
}
// force rebuild
