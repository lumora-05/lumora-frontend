export default function GoogleMapsEmbed({ routeGeometry, destinationLabel }) {
  if (!routeGeometry || !destinationLabel) return null;

  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(destinationLabel)}&output=embed`;

  return (
    <div className="open-map-shell">
      <iframe
        className="open-map-canvas"
        src={mapUrl}
        title={`Google Maps - ${destinationLabel}`}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        style={{ border: 0, display: 'block' }}
      />
    </div>
  );
}
