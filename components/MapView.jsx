"use client";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Next.js + Leaflet の marker 画像問題対策
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

export default function MapView({ results }) {
  const routes = (results ?? [])
    .filter((r) => Array.isArray(r._mapPoints) && r._mapPoints.length >= 2)
    .map((r) => ({
      id: r.id,
      points: r._mapPoints
        .map((p) => [Number(p.lat), Number(p.lng)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
      named: r._mapPoints,
    }))
    .filter((r) => r.points.length >= 2);

  if (routes.length === 0) {
    return <div style={{ color: "#6b7280" }}>地図表示できるルートがありません（_mapPointsが空です）</div>;
  }

  const allPts = routes.flatMap((r) => r.points);
  const bounds = L.latLngBounds(allPts);

  return (
    <MapContainer style={{ height: 420, width: "100%" }} bounds={bounds} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {routes.map((r, idx) => (
        <Polyline key={`${r.id}-${idx}`} positions={r.points} />
      ))}

      {/* マーカーは多いと重いので、各ルートの先頭と末尾だけ置く */}
      {routes.map((r, idx) => {
        const first = r.named[0];
        const last = r.named[r.named.length - 1];
        return (
          <div key={`mk-${idx}`}>
            <Marker position={[first.lat, first.lng]}>
              <Popup>{first.name || "Start"}</Popup>
            </Marker>
            <Marker position={[last.lat, last.lng]}>
              <Popup>{last.name || "Goal"}</Popup>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  );
}
