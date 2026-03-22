import { useRef, useEffect, useState } from 'react'
import GlobeComponent from 'react-globe.gl'
import { NODES as MOCK_NODES, EDGES as MOCK_EDGES, NODE_COLORS } from '../data/mockdata'
import { api } from '../api/bharatgraph'

interface GlobeProps {
  highlightNodeIds?: string[]
  onNodeClick?: (nodeId: string) => void
  liveEventNode?: string | null
}

// Lat/lng for key strategic nodes — used to place real API nodes on globe
const GEO_COORDS: Record<string, { lat: number; lng: number }> = {
  'India':                   { lat: 20.59,  lng: 78.96  },
  'China':                   { lat: 35.86,  lng: 104.19 },
  'Pakistan':                { lat: 30.37,  lng: 69.34  },
  'Nepal':                   { lat: 28.39,  lng: 84.12  },
  'Sri Lanka':               { lat: 7.87,   lng: 80.77  },
  'Bangladesh':              { lat: 23.68,  lng: 90.35  },
  'Myanmar':                 { lat: 21.91,  lng: 95.95  },
  'Bhutan':                  { lat: 27.51,  lng: 90.43  },
  'Maldives':                { lat: 3.20,   lng: 73.22  },
  'Afghanistan':             { lat: 33.93,  lng: 67.71  },
  'Gwadar Port':             { lat: 25.12,  lng: 62.32  },
  'Hambantota Port':         { lat: 6.12,   lng: 81.12  },
  'Strait of Malacca':       { lat: 2.18,   lng: 102.25 },
  'Strait of Hormuz':        { lat: 26.59,  lng: 56.26  },
  'Indian Ocean':            { lat: -10.0,  lng: 75.0   },
  'Belt and Road Initiative':{ lat: 39.90,  lng: 116.40 },
  'Rare Earth':              { lat: 36.0,   lng: 101.0  },
  'Rare Earths':             { lat: 36.0,   lng: 101.0  },
  'United States':           { lat: 37.09,  lng: -95.71 },
  'Russia':                  { lat: 61.52,  lng: 105.31 },
  'Israel':                  { lat: 31.76,  lng: 35.21  },
  'Japan':                   { lat: 36.20,  lng: 138.25 },
  'Iran':                    { lat: 32.43,  lng: 53.69  },
  'Quad':                    { lat: 15.0,   lng: 80.0   },
  'Arunachal Pradesh':       { lat: 28.21,  lng: 94.72  },
  'Kashmir':                 { lat: 34.08,  lng: 74.80  },
  'Aksai Chin':              { lat: 35.0,   lng: 79.5   },
  'Line of Actual Control':  { lat: 33.0,   lng: 78.0   },
  'Brahmaputra River':       { lat: 27.0,   lng: 93.0   },
  'CPEC':                    { lat: 28.0,   lng: 68.0   },
  'Huawei':                  { lat: 22.54,  lng: 114.06 },
  'ISRO':                    { lat: 13.07,  lng: 80.27  },
  'Taiwan':                  { lat: 23.69,  lng: 120.96 },
  'PLA Navy':                { lat: 22.0,   lng: 114.0  },
}

// Ontology category → color
const ONTO_COLORS: Record<string, string> = {
  adversary:          '#FF3131',
  buffer_state:       '#00B4FF',
  chokepoint:         '#FF3131',
  string_of_pearls:   '#FFB800',
  dependency_vector:  '#CC44FF',
  allied_nation:      '#00FF41',
  border_flux_zone:   '#FF8C00',
  military_actor:     '#888780',
  neutral:            '#c8f025',
}

export default function Globe({ highlightNodeIds = [], onNodeClick }: GlobeProps) {
  const globeEl  = useRef<any>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const [size, setSize]         = useState({ w: 800, h: 600 })
  const [countries, setCountries] = useState<any[]>([])
  const [liveNodes, setLiveNodes] = useState<any[]>([])
  const [liveEdges, setLiveEdges] = useState<any[]>([])

  // Fetch real key nodes from API
  useEffect(() => {
    api.subgraph(undefined, undefined, 300)
      .then(data => {
        // Only keep nodes that have known geo coordinates
        const placed = (data.nodes || [])
          .filter((n: any) => GEO_COORDS[n.id])
          .map((n: any) => ({
            id:          n.id,
            name:        n.id,
            type:        n.ontology_category || 'neutral',
            lat:         GEO_COORDS[n.id].lat,
            lng:         GEO_COORDS[n.id].lng,
            impactScore: 50,
            wikidataId:  n.wikidata_id || '',
          }))

        // Build edges between placed nodes
        const placedIds = new Set(placed.map((n: any) => n.id))
        const edges = (data.links || [])
          .filter((e: any) => placedIds.has(e.source) && placedIds.has(e.target))
          .slice(0, 60) // cap for performance

        setLiveNodes(placed.length > 0 ? placed : MOCK_NODES)
        setLiveEdges(edges.length > 0 ? edges : MOCK_EDGES)
      })
      .catch(() => {
        setLiveNodes(MOCK_NODES)
        setLiveEdges(MOCK_EDGES)
      })
  }, [])

  // fetch country polygons
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(r => r.json())
      .then(geo => setCountries(geo.features))
      .catch(() => {
        fetch('https://cdn.jsdelivr.net/npm/geojson-world-map@1.0.0/index.json')
          .then(r => r.json())
          .then(geo => setCountries(geo.features || geo))
      })
  }, [])

  // resize observer
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // camera + controls
  useEffect(() => {
    if (!globeEl.current) return
    globeEl.current.pointOfView({ lat: 15, lng: 82, altitude: 2.0 }, 0)
    const ctrl = globeEl.current.controls()
    ctrl.autoRotate      = true
    ctrl.autoRotateSpeed = 0.35
    ctrl.enableDamping   = true
    ctrl.dampingFactor   = 0.08
    ctrl.minDistance     = 180
    ctrl.maxDistance     = 550
    ctrl.enablePan       = false
    ctrl.addEventListener('start', () => { ctrl.autoRotate = false })
    ctrl.addEventListener('end',   () => { setTimeout(() => { ctrl.autoRotate = true }, 3000) })
  }, [])

  const activeNodes = liveNodes.length > 0 ? liveNodes : MOCK_NODES
  const activeEdges = liveEdges.length > 0 ? liveEdges : MOCK_EDGES

  const points = activeNodes.map((n: any) => ({
    ...n,
    radius:   highlightNodeIds.includes(n.id) ? 0.55 : n.id === 'India' || n.id === 'Q668' ? 0.45 : 0.28,
    color:    highlightNodeIds.includes(n.id)
                ? '#FF3131'
                : ONTO_COLORS[n.type] || NODE_COLORS[n.type] || '#c8f025',
    altitude: highlightNodeIds.includes(n.id) ? 0.04 : 0.018,
  }))

  const arcs = activeEdges.flatMap((e: any) => {
    const src = activeNodes.find((n: any) => n.id === e.source)
    const tgt = activeNodes.find((n: any) => n.id === e.target)
    if (!src || !tgt) return []
    return [{
      startLat: src.lat, startLng: src.lng,
      endLat:   tgt.lat, endLng:   tgt.lng,
      conflict: e.conflictFlag || e.conflict_flag || false,
      weight:   0.35 + (e.confidence || 0.75),
      label:    `${(e.relation || '').replace(/_/g, ' ')} · ${((e.confidence || 0.75) * 100).toFixed(0)}%`,
    }]
  })

  const indiaNode = activeNodes.find((n: any) => n.id === 'India' || n.id === 'Q668')
  const rings = [
    ...(indiaNode ? [{ lat: indiaNode.lat, lng: indiaNode.lng, maxR: 6, propagationSpeed: 1.2, repeatPeriod: 2200, isIndia: true }] : []),
    ...activeNodes.filter((n: any) => highlightNodeIds.includes(n.id)).map((n: any) => ({
      lat: n.lat, lng: n.lng, maxR: 4, propagationSpeed: 2.5, repeatPeriod: 800, isIndia: false,
    })),
  ]

  return (
    <div ref={wrapRef} className="w-full h-full" style={{ cursor: 'grab' }}>
      <GlobeComponent
        ref={globeEl}
        width={size.w}
        height={size.h}
        globeImageUrl={null as any}
        backgroundColor="#020e14"
        atmosphereColor="#c8f025"
        atmosphereAltitude={0.14}
        onGlobeReady={() => {
          const mat = globeEl.current?.globeMaterial() as any
          if (!mat) return
          mat.color.setHex(0x020e14)
          mat.emissive.setHex(0x071820)
          mat.emissiveIntensity = 0.5
          mat.shininess = 8
        }}
        polygonsData={countries}
        polygonCapColor={() => 'rgba(8,69,86,0.45)'}
        polygonSideColor={() => 'rgba(200,240,37,0.06)'}
        polygonStrokeColor={() => 'rgba(200,240,37,0.25)'}
        polygonAltitude={0.006}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointRadius="radius"
        pointAltitude="altitude"
        pointResolution={14}
        pointLabel={(d: any) => `
          <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#c8f025;
            background:rgba(3,10,13,0.95);border:1px solid rgba(200,240,37,0.35);
            padding:5px 10px;pointer-events:none;line-height:1.6">
            <div style="font-weight:700;letter-spacing:.06em">${d.name}</div>
            <div style="opacity:0.5;font-size:9px;letter-spacing:.1em">
              ${(d.type || '').replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>`}
        onPointClick={(d: any) => onNodeClick?.(d.id)}
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(d: any) => d.conflict
          ? ['rgba(255,49,49,0.95)', 'rgba(255,49,49,0.06)']
          : ['rgba(200,240,37,0.9)', 'rgba(200,240,37,0.03)']}
        arcStroke="weight"
        arcDashLength={0.4}
        arcDashGap={0.18}
        arcDashAnimateTime={2400}
        arcAltitudeAutoScale={0.38}
        arcLabel={(d: any) => `
          <div style="font-family:JetBrains Mono,monospace;font-size:10px;
            color:${d.conflict ? '#FF3131' : '#c8f025'};background:rgba(3,10,13,0.92);
            border:1px solid rgba(200,240,37,0.2);padding:3px 8px;pointer-events:none">
            ${d.label}
          </div>`}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        ringColor={(d: any) => d.isIndia
          ? (t: number) => `rgba(200,240,37,${Math.max(0, 0.7 - t * 0.7)})`
          : (t: number) => `rgba(255,49,49,${Math.max(0, 1 - t)})`}
        ringAltitude={0.022}
      />
    </div>
  )
}
