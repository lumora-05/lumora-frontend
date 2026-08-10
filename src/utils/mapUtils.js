let mapLibrePromise;

const MAPLIBRE_VERSION = '6.0.0';
const MAPLIBRE_MODULE_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`;
const MAPLIBRE_CSS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

export function loadMapLibre() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Bản đồ chỉ hoạt động trên trình duyệt.'));
  }
  if (mapLibrePromise) return mapLibrePromise;

  if (!document.querySelector('link[data-lumora-maplibre="true"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS_URL;
    link.dataset.lumoraMaplibre = 'true';
    document.head.appendChild(link);
  }

  mapLibrePromise = import(/* @vite-ignore */ MAPLIBRE_MODULE_URL)
    .catch((error) => {
      mapLibrePromise = undefined;
      throw error;
    });
  return mapLibrePromise;
}

export function formatDistanceMeters(value) {
  const meters = Number(value || 0);
  if (!Number.isFinite(meters) || meters <= 0) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDurationSeconds(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

export function parseRouteCoordinates(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
