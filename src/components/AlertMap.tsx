/**
 * AlertMap — Interactive Leaflet map for the Alerts page.
 * Shows alert pins, flies to clicked alert location.
 *
 * Install dependencies first:
 *   npm install leaflet react-leaflet
 *   npm install --save-dev @types/leaflet
 */

import { useEffect, useRef } from 'react'
import type { Alert } from '../data/mockdata'

// ── node/location coordinates for known entities ──────────────────────────────
const ENTITY_COORDS: Record<string, [number, number]> = {
  'China':                    [35.86,  104.19],
  'Pakistan':                 [30.37,   69.34],
  'India':                    [20.59,   78.96],
  'Nepal':                    [28.39,   84.12],
  'Sri Lanka':                [7.87,    80.77],
  'Bangladesh':               [23.68,   90.35],
  'Myanmar':                  [21.91,   95.95],
  'Maldives':                 [3.20,    73.22],
  'Bhutan':                   [27.51,   90.43],
  'Gwadar Port':              [25.12,   62.32],
  'Hambantota Port':          [6.12,    81.12],
  'Strait of Malacca':        [2.18,   102.25],
  'Strait of Hormuz':         [26.59,   56.26],
  'Indian Ocean':             [-10.0,   75.0 ],
  'Arunachal Pradesh':        [28.21,   94.72],
  'Kashmir':                  [34.08,   74.80],
  'Aksai Chin':               [35.0,    79.5 ],
  'Line of Actual Control':   [33.0,    78.0 ],
  'Brahmaputra River':        [27.0,    93.0 ],
  'Doklam':                   [27.25,   89.08],
  'Galwan Valley':            [34.73,   78.15],
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3131',
  HIGH:     '#FF3131',
  WATCH:    '#FFB800',
  INFO:     '#c8f025',
}

// Resolve alert location — use lat/lng if present, else look up nodes list
function resolveLatLng(alert: Alert): [number, number] | null {
  if (alert.lat && alert.lng) return [alert.lat, alert.lng]
  for (const nodeId of (alert.nodes || [])) {
    if (ENTITY_COORDS[nodeId]) return ENTITY_COORDS[nodeId]
  }
  return null
}

interface AlertMapProps {
  alerts:        Alert[]
  focusedAlert:  Alert | null
}

export default function AlertMap({ alerts, focusedAlert }: AlertMapProps) {
  const mapRef       = useRef<any>(null)
  const leafletRef   = useRef<any>(null)
  const markersRef   = useRef<any[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default marker icon path issue with Vite
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      leafletRef.current = L

      const map = L.map(containerRef.current!, {
        center:          [20, 80],
        zoom:            3,
        zoomControl:     false,
        attributionControl: false,
        minZoom:         2,
        maxZoom:         8,
      })

      // Dark tile layer — CartoDB Dark Matter (free, no key)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains:  'abcd',
        maxZoom:     19,
      }).addTo(map)

      mapRef.current = map

      // Add zoom control bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Plot initial markers
      plotMarkers(L, map, alerts)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // ── Re-plot markers when alerts change ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return
    plotMarkers(leafletRef.current, mapRef.current, alerts)
  }, [alerts])

  // ── Fly to focused alert ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !focusedAlert) return
    const coords = resolveLatLng(focusedAlert)
    if (coords) {
      mapRef.current.flyTo(coords, 5, { duration: 1.2, easeLinearity: 0.25 })
    }
  }, [focusedAlert])

  function plotMarkers(L: any, map: any, alertList: Alert[]) {
    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    alertList.forEach(alert => {
      const coords = resolveLatLng(alert)
      if (!coords) return

      const color = SEV_COLOR[alert.severity] || '#c8f025'

      // Custom circle marker with pulse
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:20px;height:20px">
            <div style="
              position:absolute;top:50%;left:50%;
              transform:translate(-50%,-50%);
              width:20px;height:20px;
              border-radius:50%;
              background:${color}22;
              border:1px solid ${color}66;
              animation:pulse-alert 2s infinite;
            "></div>
            <div style="
              position:absolute;top:50%;left:50%;
              transform:translate(-50%,-50%);
              width:8px;height:8px;
              border-radius:50%;
              background:${color};
              box-shadow:0 0 6px ${color};
            "></div>
          </div>`,
        iconSize:   [20, 20],
        iconAnchor: [10, 10],
      })

      const marker = L.marker(coords, { icon })
        .addTo(map)
        .bindTooltip(`
          <div style="
            font-family:JetBrains Mono,monospace;
            font-size:11px;
            background:rgba(3,10,13,0.95);
            border:1px solid ${color}55;
            color:${color};
            padding:5px 10px;
            line-height:1.6;
          ">
            <div style="font-weight:700">${alert.title}</div>
            <div style="opacity:0.6;font-size:9px">${alert.severity} · ${alert.region}</div>
          </div>`, {
          className:  'leaflet-bharatmap-tooltip',
          permanent:  false,
          direction:  'top',
          offset:     [0, -8],
        })

      markersRef.current.push(marker)
    })
  }

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-alert {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          50%      { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
        .leaflet-bharatmap-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-bharatmap-tooltip::before { display: none !important; }
        .leaflet-container { background: #020e14 !important; }
        .leaflet-tile { filter: brightness(0.85) saturate(0.6); }
      `}</style>

      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 180 }}
      />
    </>
  )
}
