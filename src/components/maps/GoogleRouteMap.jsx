import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPinned } from 'lucide-react';
import { loadGoogleMaps } from '../../utils/googleMaps';

export default function GoogleRouteMap({ destination, encodedPolyline }) {
  const mapRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let routeLine;
    let restaurantMarker;
    let destinationMarker;

    async function renderMap() {
      if (!destination || !Number.isFinite(Number(destination.latitude)) || !Number.isFinite(Number(destination.longitude))) {
        setLoading(false);
        return;
      }
      try {
        await loadGoogleMaps();
        const [{ Map, Polyline }, { AdvancedMarkerElement }, geometry] = await Promise.all([
          window.google.maps.importLibrary('maps'),
          window.google.maps.importLibrary('marker'),
          window.google.maps.importLibrary('geometry'),
        ]);
        if (!active || !mapRef.current) return;

        const destinationPosition = {
          lat: Number(destination.latitude),
          lng: Number(destination.longitude),
        };
        const map = new Map(mapRef.current, {
          center: destinationPosition,
          zoom: 14,
          mapId: 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        });

        let path = [];
        if (encodedPolyline) {
          path = geometry.encoding.decodePath(encodedPolyline);
          if (path.length) {
            routeLine = new Polyline({
              path,
              geodesic: true,
              strokeOpacity: 0.8,
              strokeWeight: 5,
              map,
            });
            const bounds = new window.google.maps.LatLngBounds();
            path.forEach((point) => bounds.extend(point));
            map.fitBounds(bounds, 40);
            restaurantMarker = new AdvancedMarkerElement({
              map,
              position: path[0],
              title: 'Nhà hàng LUMORA',
            });
          }
        }

        destinationMarker = new AdvancedMarkerElement({
          map,
          position: destinationPosition,
          title: destination.formattedAddress || 'Địa chỉ giao hàng',
        });
        setError('');
      } catch (err) {
        if (active) setError(err?.message || 'Không thể hiển thị bản đồ.');
      } finally {
        if (active) setLoading(false);
      }
    }

    setLoading(true);
    renderMap();
    return () => {
      active = false;
      if (routeLine) routeLine.setMap(null);
      if (restaurantMarker) restaurantMarker.map = null;
      if (destinationMarker) destinationMarker.map = null;
    };
  }, [destination, encodedPolyline]);

  return (
    <div className="google-route-map-shell">
      <div ref={mapRef} className="google-route-map" />
      {loading && <div className="google-route-map-state"><LoaderCircle className="spin" size={18} /> Đang tải bản đồ...</div>}
      {!loading && error && <div className="google-route-map-state error"><MapPinned size={18} /> {error}</div>}
    </div>
  );
}
