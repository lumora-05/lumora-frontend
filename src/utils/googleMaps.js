let googleMapsPromise;

export const googleMapsBrowserApiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
export const googleMapsEnabled = Boolean(googleMapsBrowserApiKey);

export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps chỉ hoạt động trên trình duyệt.'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!googleMapsBrowserApiKey) return Promise.reject(new Error('Chưa cấu hình VITE_GOOGLE_MAPS_API_KEY.'));
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lumora-google-maps="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không thể tải Google Maps.')), { once: true });
      return;
    }

    const callbackName = `__lumoraGoogleMapsReady_${Date.now()}`;
    const cleanup = () => {
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    };
    window[callbackName] = () => {
      cleanup();
      if (window.google?.maps?.importLibrary) resolve(window.google.maps);
      else reject(new Error('Google Maps tải không đầy đủ.'));
    };

    const script = document.createElement('script');
    script.dataset.lumoraGoogleMaps = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsBrowserApiKey)}&v=weekly&loading=async&callback=${encodeURIComponent(callbackName)}&language=vi&region=VN`;
    script.onerror = () => {
      cleanup();
      googleMapsPromise = undefined;
      reject(new Error('Không thể tải Google Maps. Hãy kiểm tra API key và domain được phép.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
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
