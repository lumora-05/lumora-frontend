import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPinned } from 'lucide-react';
import { loadMapLibre, parseRouteCoordinates } from '../../utils/mapUtils';

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

export default function OpenStreetMapRouteMap({ routeGeometry, destinationLabel }) {
  const mapHostRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let map;

    async function render() {
      const coordinates = parseRouteCoordinates(routeGeometry)
        .filter((point) => Array.isArray(point)
          && Number.isFinite(Number(point[0]))
          && Number.isFinite(Number(point[1])))
        .map((point) => [Number(point[0]), Number(point[1])]);

      if (!coordinates.length || !mapHostRef.current) {
        setLoading(false);
        return;
      }

      try {
        const maplibregl = await loadMapLibre();
        if (!active || !mapHostRef.current) return;

        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        map = new maplibregl.Map({
          container: mapHostRef.current,
          style: OSM_STYLE,
          center: last,
          zoom: 14,
          attributionControl: true,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          if (!active || !map) return;
          map.addSource('delivery-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates },
            },
          });
          map.addLayer({
            id: 'delivery-route-line',
            type: 'line',
            source: 'delivery-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#e96720', 'line-width': 5, 'line-opacity': 0.88 },
          });

          new maplibregl.Marker({ color: '#303a45' })
            .setLngLat(first)
            .setPopup(new maplibregl.Popup({ offset: 18 }).setText('Nhà hàng LUMORA'))
            .addTo(map);
          new maplibregl.Marker({ color: '#e96720' })
            .setLngLat(last)
            .setPopup(new maplibregl.Popup({ offset: 18 }).setText(destinationLabel || 'Địa chỉ giao hàng'))
            .addTo(map);

          const bounds = coordinates.reduce(
            (value, point) => value.extend(point),
            new maplibregl.LngLatBounds(first, first),
          );
          map.fitBounds(bounds, { padding: 42, maxZoom: 16, duration: 0 });
          setLoading(false);
          setError('');
        });
        map.on('error', () => {
          if (active) {
            setLoading(false);
            setError('Không thể tải lớp bản đồ OpenStreetMap lúc này.');
          }
        });
      } catch (err) {
        if (active) {
          setLoading(false);
          setError('Không thể tải bản đồ. Quãng đường và phí giao vẫn được backend tính bình thường.');
        }
      }
    }

    setLoading(true);
    setError('');
    render();
    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [routeGeometry, destinationLabel]);

  if (!routeGeometry) return null;

  return (
    <div className="open-map-shell">
      <div ref={mapHostRef} className="open-map-canvas" />
      {loading ? <div className="open-map-state"><LoaderCircle className="spin" size={18} /> Đang tải bản đồ...</div> : null}
      {error ? <div className="open-map-state error"><MapPinned size={18} /> {error}</div> : null}
    </div>
  );
}
