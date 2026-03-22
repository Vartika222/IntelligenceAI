import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { NODE_COLORS } from '../data/mockdata'
import type { GeoNode, GeoEdge } from '../data/mockdata'
import { api, useGraph, useStats } from '../api/bharatgraph'


// ── palette ───────────────────────────────────────────────────────────────────
const LIME   = '#c8f025'
const L45    = 'rgba(200,240,37,0.45)'
const L20    = 'rgba(200,240,37,0.20)'
const L12    = 'rgba(200,240,37,0.12)'
const L06    = 'rgba(200,240,37,0.06)'
const L03    = 'rgba(200,240,37,0.03)'
const MUTED  = 'rgba(255,255,255,0.22)'
const WHITE  = 'rgba(255,255,255,0.88)'
const W55    = 'rgba(255,255,255,0.55)'
const BG     = '#030a0d'
const SURF   = '#071218'

// ── domain colors for edges ───────────────────────────────────────────────────
const DOMAIN_COLOR: Record<string, string> = {
  GEOPOLITICS: '#FF3131',
  ECONOMICS:   '#FFB800',
  DEFENSE:     '#c8f025',
  TECHNOLOGY:  '#00B4FF',
  CLIMATE:     '#1D9E75',
  SOCIETY:     '#CC44FF',
}

// ── consequence blurbs per node ───────────────────────────────────────────────
const CONSEQUENCES: Record<string, { score: number; domains: string[]; bullets: string[] }> = {
  Q668:    { score: 100, domains: ['ALL'],                    bullets: ['Central node — all edges converge here', 'Anchor of Bharatiya ontology', 'Strategic pivot for every analysis'] },
  Q148:    { score: 91,  domains: ['GEOPOLITICS','DEFENSE'],  bullets: ['BRI encirclement risk to 6 buffer states', 'PLA-N dual-use port access near Indian coast', 'LAC standoff — 3,000+ forward positions'] },
  Q843:    { score: 87,  domains: ['DEFENSE','GEOPOLITICS'],  bullets: ['Nuclear-armed, ISI proxy networks active', 'CPEC militarises India-Pakistan border arc', 'Cross-border terror funding well-documented'] },
  Q837:    { score: 72,  domains: ['GEOPOLITICS','ECONOMICS'],bullets: ['Northern buffer — BRI MoU signed 2017', 'Kerung-Kathmandu railway under negotiation', 'India-Nepal trade fell 16.6% in Sep 2025'] },
  Q854:    { score: 68,  domains: ['GEOPOLITICS','ECONOMICS'],bullets: ['Hambantota 99yr lease to China Merchants', '200nm from India\'s southern coast', 'Chinese oil refinery announced Q1 2025'] },
  Q902:    { score: 61,  domains: ['GEOPOLITICS'],            bullets: ['Eastern buffer, dual allegiance risk', 'BIMSTEC + SCO observer status', 'Bangladesh unrest — instability spillover'] },
  Q836:    { score: 58,  domains: ['GEOPOLITICS'],            bullets: ['Kyaukpyu port — Bay of Bengal anchor', 'Myanmar coup weakens buffer status', 'BRI debt deepens China dependency'] },
  Gwadar:  { score: 83,  domains: ['DEFENSE','ECONOMICS'],   bullets: ['CPEC anchor, PLA-N docking confirmed', '400km from Indian coast — direct threat', 'Submarine base construction reports'] },
  Malacca: { score: 79,  domains: ['ECONOMICS'],              bullets: ['80% of India\'s energy imports pass here', 'Chinese naval build-up in South China Sea', 'Disruption = economic strangulation'] },
  BRI:     { score: 77,  domains: ['GEOPOLITICS','ECONOMICS'],bullets: ['China\'s strategic debt network', '6 India-adjacent nations now enrolled', 'Asset seizure precedent: Hambantota'] },
  RE:      { score: 85,  domains: ['ECONOMICS','TECHNOLOGY'], bullets: ['India imports 72% rare earths from China', 'Export delays followed 3 of 4 LAC incidents', 'Critical for EV, defense, semiconductor'] },
  IL:      { score: 22,  domains: ['DEFENSE'],                bullets: ['Weapons supplier — Barak, Heron UAV', 'Shared tech cooperation deepening', 'Balanced relation, low strategic risk'] },
  RU:      { score: 34,  domains: ['DEFENSE','ECONOMICS'],    bullets: ['S-400, oil at discount — positive', 'INSTC corridor reduces Pakistan bypass need', 'Ukraine war strain on arms delivery'] },
  US:      { score: 45,  domains: ['DEFENSE','TECHNOLOGY'],   bullets: ['Quad partner, tech + defense deepening', 'Pentagon reaffirmed Arunachal as Indian', 'Chip export deal under negotiation 2025'] },
}

const NAV_ITEMS = [
  { label: 'TERMINAL',  path: '/terminal'  },
  { label: 'DASHBOARD', path: '/dashboard' },
  { label: 'ALERTS',    path: '/alerts'    },
  { label: 'QUERIES',   path: '/queries'   },
]

// ── Time Machine dates ────────────────────────────────────────────────────────
const EARLIEST = new Date('2010-01-01')
const NOW       = new Date()

function dateToPercent(d: Date): number {
  return (d.getTime() - EARLIEST.getTime()) / (NOW.getTime() - EARLIEST.getTime()) * 100
}
function percentToDate(p: number): Date {
  return new Date(EARLIEST.getTime() + (p / 100) * (NOW.getTime() - EARLIEST.getTime()))
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// D3 FORCE GRAPH COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ForceGraph({
  nodes,
  edges,
  filterDomain,
  filterImpact,
  searchTerm,
  cutoffDate,
  selectedNodeId,
  onNodeClick,
}: {
  nodes: GeoNode[]
  edges: GeoEdge[]
  filterDomain: string
  filterImpact: string
  searchTerm: string
  cutoffDate: Date
  selectedNodeId: string | null
  onNodeClick: (id: string) => void
}) {
  const svgRef   = useRef<SVGSVGElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const simRef   = useRef<d3.Simulation<any, any> | null>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })

  // Filter edges by cutoff date
  const activeEdges = edges.filter(e => {
    const edgeDate = new Date(e.validFrom)
    return edgeDate <= cutoffDate
  })

  // Active node IDs from filtered edges
  const activeNodeIds = new Set(activeEdges.flatMap(e => [e.source, e.target]))
  const activeNodes   = nodes.filter(n => activeNodeIds.has(n.id) || n.id === 'Q668')

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || activeNodes.length === 0) return
    const { w, h } = dims
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Defs — arrowhead + glow filter
    const defs = svg.append('defs')
    defs.append('filter').attr('id', 'glow')
      .append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const feMerge = defs.select('filter').append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'blur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'rgba(200,240,37,0.4)')

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', e => g.attr('transform', e.transform))
    svg.call(zoom)

    // Build link data
    const linkData = activeEdges.map(e => ({ ...e, source: e.source, target: e.target }))

    // Simulation
    const sim = d3.forceSimulation(activeNodes as any)
      .force('link', d3.forceLink(linkData).id((d: any) => d.id).distance(110).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide(32))
    simRef.current = sim

    // ── ANIMATED ARC LINKS ────────────────────────────────────────────────────
    const linkGroup = g.append('g').attr('class', 'links')

    const linkPaths = linkGroup.selectAll('path')
      .data(linkData)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        if (d.conflictFlag) return '#FF3131'
        return LIME
      })
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', (d: any) => Math.max(1, d.confidence * 2.5))
      .attr('marker-end', 'url(#arrow)')

    // Animated travel dots along paths
    const travelDots = linkGroup.selectAll('.travel')
      .data(linkData)
      .join('circle')
      .attr('class', 'travel')
      .attr('r', 2.5)
      .attr('fill', (d: any) => d.conflictFlag ? '#FF3131' : LIME)
      .attr('opacity', 0.8)

    // Animate each dot along its path
    function animateDot(dot: any, pathEl: SVGPathElement, delay: number) {
      const totalLength = pathEl.getTotalLength()
      if (totalLength === 0) return
      dot.attr('opacity', 0)

      function loop() {
        dot.attr('opacity', 0)
          .transition()
          .delay(delay)
          .duration(200)
          .attr('opacity', 0.9)
          .transition()
          .duration(1600)
          .ease(d3.easeLinear)
          .attrTween('transform', () => {
            return (t: number) => {
              const pt = pathEl.getPointAtLength(t * totalLength)
              return `translate(${pt.x},${pt.y})`
            }
          })
          .transition()
          .duration(200)
          .attr('opacity', 0)
          .on('end', loop)
      }
      loop()
    }

    // ── NODES ─────────────────────────────────────────────────────────────────
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const drag = d3.drag<SVGGElement, any>()
      .on('start', function(event, d) { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag',  function(event, d) { d.fx = event.x; d.fy = event.y })
      .on('end',   function(event, d) { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })

    const nodeGs = nodeGroup.selectAll<SVGGElement, any>('g')
      .data(activeNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(drag)
      .on('click', (_e, d: any) => onNodeClick(d.id))

    // Outer glow ring for selected
    nodeGs.append('circle')
      .attr('r', (d: any) => d.id === 'Q668' ? 28 : 18)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => NODE_COLORS[d.type] || LIME)
      .attr('stroke-width', (d: any) => d.id === selectedNodeId ? 2 : 0)
      .attr('stroke-opacity', 0.6)
      .attr('filter', 'url(#glow)')
      .attr('class', 'ring')

    // Main node circle
    nodeGs.append('circle')
      .attr('r', (d: any) => d.id === 'Q668' ? 22 : d.impactScore > 75 ? 14 : 10)
      .attr('fill', (d: any) => {
        const col = NODE_COLORS[d.type] || LIME
        return d.id === selectedNodeId ? col : col + '33'
      })
      .attr('stroke', (d: any) => NODE_COLORS[d.type] || LIME)
      .attr('stroke-width', (d: any) => d.id === 'Q668' ? 2.5 : 1.5)
      .attr('stroke-opacity', (d: any) => {
        if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return 0.2
        return 0.9
      })

    // Node label
    nodeGs.append('text')
      .attr('dy', (d: any) => (d.id === 'Q668' ? 22 : d.impactScore > 75 ? 14 : 10) + 13)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', (d: any) => d.id === 'Q668' ? '11px' : '9px')
      .attr('fill', (d: any) => {
        if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return 'rgba(255,255,255,0.15)'
        return d.id === selectedNodeId ? WHITE : 'rgba(255,255,255,0.6)'
      })
      .attr('letter-spacing', '0.08em')
      .text((d: any) => d.name.toUpperCase())

    // Tick
    sim.on('tick', () => {
      linkPaths.attr('d', (d: any) => {
        const sx = d.source.x, sy = d.source.y
        const tx = d.target.x, ty = d.target.y
        const dx = tx - sx, dy = ty - sy
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.2
        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`
      })

      nodeGs.attr('transform', (d: any) => `translate(${d.x},${d.y})`)

      // Animate dots after first tick settles
      travelDots.each(function(d: any, i: number) {
        const pathEl = linkPaths.nodes()[i] as SVGPathElement
        if (pathEl && pathEl.getTotalLength && pathEl.getTotalLength() > 0) {
          animateDot(d3.select(this), pathEl, i * 300)
        }
      })
    })

    // Cleanup
    return () => { sim.stop() }
  }, [dims, activeNodes.length, activeEdges.length, selectedNodeId, searchTerm, cutoffDate])

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        style={{ display: 'block' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME MACHINE SLIDER
// ─────────────────────────────────────────────────────────────────────────────
function TimeMachine({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [pct, setPct]       = useState(100)
  const [playing, setPlaying] = useState(false)
  const trackRef            = useRef<HTMLDivElement>(null)
  const playRef             = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLive = pct >= 99.5

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const p    = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100))
    setPct(p)
    onChange(percentToDate(p))
  }, [onChange])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    handleTrackClick(e)
  }, [handleTrackClick])

  // Year ticks
  const years = [2015, 2017, 2019, 2021, 2023, 2025]

  const togglePlay = () => {
    if (playing) {
      if (playRef.current) clearInterval(playRef.current)
      setPlaying(false)
    } else {
      setPlaying(true)
      let p = pct >= 99 ? 0 : pct
      playRef.current = setInterval(() => {
        p += 0.4
        if (p >= 100) { p = 100; clearInterval(playRef.current!); setPlaying(false) }
        setPct(p)
        onChange(percentToDate(p))
      }, 50)
    }
  }

  useEffect(() => () => { if (playRef.current) clearInterval(playRef.current) }, [])

  return (
    <div
      style={{
        height: 64,
        background: SURF,
        borderTop: `1px solid ${L12}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      {/* EARLIEST button */}
      <button
        onClick={() => { setPct(0); onChange(EARLIEST) }}
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: MUTED,
          background: 'transparent',
          border: `1px solid ${L12}`,
          padding: '4px 8px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          letterSpacing: '0.08em',
        }}
      >
        ◀◀ EARLIEST
      </button>

      {/* PLAY/PAUSE */}
      <button
        onClick={togglePlay}
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: playing ? LIME : MUTED,
          background: playing ? L06 : 'transparent',
          border: `1px solid ${playing ? L45 : L12}`,
          padding: '4px 10px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          letterSpacing: '0.08em',
        }}
      >
        {playing ? '⏸ PAUSE' : '▶ PLAY'}
      </button>

      {/* Track */}
      <div style={{ flex: 1, position: 'relative', padding: '0 8px' }}>
        {/* year labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          {years.map(y => (
            <span key={y} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: MUTED, letterSpacing: '0.06em' }}>{y}</span>
          ))}
        </div>

        {/* track bar */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onMouseMove={handleMouseMove}
          style={{
            height: 4,
            background: `rgba(200,240,37,0.15)`,
            borderRadius: 2,
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {/* filled portion */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${pct}%`,
              background: LIME,
              borderRadius: 2,
              transition: playing ? 'none' : 'width 0.1s',
            }}
          />
          {/* thumb */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: isLive ? LIME : BG,
              border: `2px solid ${LIME}`,
              boxShadow: isLive ? `0 0 8px ${LIME}` : 'none',
              transition: playing ? 'none' : 'left 0.1s',
            }}
          />
        </div>
      </div>

      {/* date display */}
      <div style={{ minWidth: 160, textAlign: 'right' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: MUTED, letterSpacing: '0.1em' }}>
          VIEWING:&nbsp;
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: LIME, letterSpacing: '0.06em' }}>
          {isLive ? 'LIVE' : fmtDate(value)}
        </span>
      </div>

      {/* LIVE badge */}
      <div
        onClick={() => { setPct(100); onChange(NOW) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          border: `1px solid ${isLive ? LIME : L12}`,
          background: isLive ? L12 : 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isLive ? LIME : MUTED,
          boxShadow: isLive ? `0 0 6px ${LIME}` : 'none',
          animation: isLive ? 'pulse-green 2s infinite' : 'none',
        }} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: isLive ? LIME : MUTED, letterSpacing: '0.1em' }}>
          LIVE
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEL PANEL (right column)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// NODE IMPACT GRAPH — mini D3 graph shown in IMPACT tab when node clicked
// Shows the selected node + its direct connections colored by india_impact
// ─────────────────────────────────────────────────────────────────────────────
function NodeImpactGraph({ nodeId, nodeDetail }: { nodeId: string; nodeDetail: any }) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const [dims]  = useState({ w: 340, h: 180 })

  useEffect(() => {
    if (!svgRef.current || !nodeDetail) return
    const { w, h } = dims
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const impactColor = (impact: string) =>
      impact === 'HIGH' ? '#FF3131' : impact === 'MEDIUM' ? '#FFB800' : 'rgba(200,240,37,0.5)'

    // Build nodes: center + up to 8 connected peers
    const outgoing = (nodeDetail.outgoing_edges || []).slice(0, 5)
    const incoming = (nodeDetail.incoming_edges || []).slice(0, 3)
    const allEdges = [...outgoing, ...incoming]

    const centerNode = { id: nodeId, cx: true }
    const peerNodes  = allEdges.map((e: any, i: number) => ({
      id:     e.target || e.source,
      impact: e.india_impact || 'LOW',
      cx:     false,
      angle:  (i / allEdges.length) * Math.PI * 2,
    }))

    const linkData = allEdges.map((e: any) => ({
      source: nodeId,
      target: e.target || e.source,
      impact: e.india_impact || 'LOW',
      relation: (e.relation || '').replace(/_/g, ' '),
      outgoing: !!e.target,
    }))

    const allNodes = [centerNode, ...peerNodes] as any[]

    const sim = d3.forceSimulation(allNodes)
      .force('link', d3.forceLink(linkData).id((d: any) => d.id).distance(65).strength(0.8))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide(18))

    const g = svg.append('g')

    const links = g.append('g').selectAll('line')
      .data(linkData)
      .join('line')
      .attr('stroke', (d: any) => impactColor(d.impact))
      .attr('stroke-width', (d: any) => d.impact === 'HIGH' ? 2 : 1)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-dasharray', (d: any) => !d.outgoing ? '3,2' : 'none')

    const nodeGs = g.append('g').selectAll('g')
      .data(allNodes)
      .join('g')

    nodeGs.append('circle')
      .attr('r', (d: any) => d.cx ? 12 : 7)
      .attr('fill', (d: any) => d.cx ? 'rgba(200,240,37,0.15)' : `${impactColor(d.impact)}22`)
      .attr('stroke', (d: any) => d.cx ? '#c8f025' : impactColor(d.impact))
      .attr('stroke-width', (d: any) => d.cx ? 2 : 1)

    nodeGs.append('text')
      .attr('dy', (d: any) => d.cx ? 20 : 16)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '7px')
      .attr('fill', (d: any) => d.cx ? '#c8f025' : 'rgba(255,255,255,0.5)')
      .text((d: any) => {
        const name = String(d.id)
        return name.length > 10 ? name.slice(0, 10) + '…' : name
      })

    sim.on('tick', () => {
      links
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y)
      nodeGs.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop() }
  }, [nodeId, nodeDetail])

  if (!nodeDetail || (nodeDetail.outgoing_edges?.length === 0 && nodeDetail.incoming_edges?.length === 0)) {
    return null
  }

  return (
    <div style={{ marginBottom: 16, border: `1px solid rgba(200,240,37,0.12)`, background: 'rgba(0,0,0,0.2)' }}>
      <div style={{ padding: '6px 10px', borderBottom: `1px solid rgba(200,240,37,0.08)`, fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
        CONNECTION MAP
      </div>
      <svg ref={svgRef} width={dims.w} height={dims.h} style={{ display: 'block', width: '100%' }} />
    </div>
  )
}

function IntelPanel({ selectedNode, alerts, nodes, edges }: { selectedNode: GeoNode | null; alerts: any[]; nodes: GeoNode[]; edges: GeoEdge[] }) {
  const [tab, setTab]         = useState<'IMPACT' | 'ALERTS' | 'DETAIL'>('IMPACT')
  const [nodeDetail, setNodeDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const nav = useNavigate()

  // Fetch real node detail from API when selection changes
  useEffect(() => {
    if (!selectedNode) { setNodeDetail(null); return }
    setDetailLoading(true)
    api.node(selectedNode.id)
      .then(d => setNodeDetail(d))
      .catch(() => setNodeDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedNode?.id])

  // Compute dynamic impact from real edges
  const realEdges   = nodeDetail ? [...(nodeDetail.outgoing_edges || []), ...(nodeDetail.incoming_edges || [])] : []
  const impactMap: Record<string, number> = { HIGH: 75, MEDIUM: 45, LOW: 15, NONE: 0 }
  const dynamicScore = Math.min(100, realEdges.reduce((sum: number, e: any) =>
    sum + (impactMap[e.india_impact] || 0), 0))
  const highEdgesCount = realEdges.filter((e: any) => e.india_impact === 'HIGH').length
  const domains = [...new Set(realEdges.map((e: any) => e.domain).filter(Boolean))] as string[]

  // Fallback to hardcoded for key nodes, otherwise use dynamic
  const staticIntel = selectedNode ? CONSEQUENCES[selectedNode.id] : null
  const score       = staticIntel?.score ?? dynamicScore
  const bullets     = staticIntel?.bullets ?? realEdges.slice(0, 3).map((e: any) =>
    `${e.relation?.replace(/_/g, ' ')} → ${e.target || e.source} [${e.india_impact}]`)
  const domainList  = staticIntel?.domains ?? (domains.length > 0 ? domains : ['GEOPOLITICS'])

  const color   = selectedNode ? (NODE_COLORS[selectedNode.type] || LIME) : LIME
  const sevColor = (s: string) =>
    s === 'CRITICAL' ? '#FF3131' : s === 'HIGH' || s === 'WATCH' ? '#FFB800' : LIME

  const TABS = ['IMPACT', 'ALERTS', 'DETAIL'] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${L12}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: tab === t ? LIME : MUTED,
              background: tab === t ? L06 : 'transparent',
              border: 'none',
              borderBottom: tab === t ? `1px solid ${LIME}` : '1px solid transparent',
              padding: '10px 4px',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── IMPACT TAB ── */}
        {tab === 'IMPACT' && (
          <div style={{ padding: 20 }}>
            {!selectedNode ? (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: MUTED, lineHeight: 1.8, marginTop: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>◎</div>
                Click any node on<br />the graph to analyze<br />India impact
              </div>
            ) : (
              <>
                {/* node header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px', background: `${color}0a`, border: `1px solid ${color}22` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, color: WHITE, fontWeight: 700, letterSpacing: '0.04em' }}>
                      {selectedNode.name.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em' }}>
                      {selectedNode.type.replace(/_/g, ' ').toUpperCase()} · {selectedNode.wikidataId}
                    </div>
                  </div>
                </div>

                {/* impact score */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em' }}>INDIA IMPACT SCORE</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, color: score >= 75 ? '#FF3131' : score >= 50 ? '#FFB800' : LIME, fontWeight: 700 }}>
                      {detailLoading ? '…' : score} / 100
                    </span>
                  </div>
                  <div style={{ height: 4, background: L06, borderRadius: 2 }}>
                    <div style={{
                      height: '100%',
                      width: `${score}%`,
                      background: score >= 75 ? '#FF3131' : score >= 50 ? '#FFB800' : LIME,
                      borderRadius: 3,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>

                {/* domain tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {domainList.map(d => (
                    <span key={d} style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9,
                      color: DOMAIN_COLOR[d] || LIME,
                      background: `${DOMAIN_COLOR[d] || LIME}14`,
                      border: `1px solid ${DOMAIN_COLOR[d] || LIME}30`,
                      padding: '2px 6px',
                      letterSpacing: '0.08em',
                    }}>
                      {d}
                    </span>
                  ))}
                </div>

                {/* node connection mini graph */}
                <NodeImpactGraph nodeId={selectedNode.id} nodeDetail={nodeDetail} />

                {/* consequences */}
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>
                  STRATEGIC IMPLICATIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bullets.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: color, fontSize: 8, marginTop: 3, flexShrink: 0 }}>◆</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: W55, lineHeight: 1.7 }}>{b}</span>
                    </div>
                  ))}
                </div>

                {/* action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button
                    onClick={() => nav('/queries')}
                    style={{
                      flex: 1,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: LIME,
                      background: L06,
                      border: `1px solid ${L20}`,
                      padding: '8px 0',
                      cursor: 'pointer',
                      letterSpacing: '0.08em',
                    }}
                  >
                    FULL ANALYSIS →
                  </button>
                  <button
                    onClick={() => nav('/terminal')}
                    style={{
                      flex: 1,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: MUTED,
                      background: 'transparent',
                      border: `1px solid ${L12}`,
                      padding: '8px 0',
                      cursor: 'pointer',
                      letterSpacing: '0.08em',
                    }}
                  >
                    VIEW ON GLOBE
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {tab === 'ALERTS' && (
          <div>
            {alerts.slice(0, 4).map(a => (
              <div
                key={a.id}
                onClick={() => nav('/alerts')}
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${L12}`,
                  borderLeft: `2px solid ${sevColor(a.severity)}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = L03}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    color: sevColor(a.severity),
                    background: `${sevColor(a.severity)}18`,
                    padding: '2px 6px',
                    letterSpacing: '0.1em',
                  }}>
                    {a.severity}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: MUTED }}>{a.timestamp}</span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: W55, lineHeight: 1.5 }}>{a.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: L45, marginTop: 4 }}>{a.subtitle}</div>
              </div>
            ))}
            <div style={{ padding: 16 }}>
              <button
                onClick={() => nav('/alerts')}
                style={{
                  width: '100%',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: LIME,
                  background: 'transparent',
                  border: `1px solid ${L20}`,
                  padding: '8px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                }}
              >
                VIEW ALL ALERTS →
              </button>
            </div>
          </div>
        )}

        {/* ── DETAIL TAB ── */}
        {tab === 'DETAIL' && (
          <div style={{ padding: 16 }}>
            {!selectedNode ? (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 24 }}>
                Select a node to view details
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 12 }}>
                  NODE PROPERTIES
                </div>
                {[
                  ['NAME',       nodeDetail?.name        || selectedNode.name],
                  ['WIKIDATA',   nodeDetail?.wikidata_id || selectedNode.wikidataId || '—'],
                  ['TYPE',       (nodeDetail?.ontology_category || selectedNode.type).replace(/_/g, ' ')],
                  ['CONNECTIONS',String(nodeDetail?.total_connections ?? '—')],
                  ['FIRST SEEN', nodeDetail?.first_seen  || '—'],
                  ['LAST SEEN',  nodeDetail?.last_seen   || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${L06}` }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED }}>{k}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: LIME }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>
                    CONNECTED EDGES
                  </div>
                  {detailLoading ? (
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED }}>Loading…</div>
                  ) : nodeDetail ? (
                    <>
                      {[...(nodeDetail.outgoing_edges || []).map((e: any) => ({ ...e, dir: '→', peer: e.target })),
                        ...(nodeDetail.incoming_edges || []).map((e: any) => ({ ...e, dir: '←', peer: e.source }))
                      ].slice(0, 12).map((e: any, i: number) => (
                        <div key={i} style={{ padding: '5px 0', borderBottom: `1px solid ${L06}` }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: W55 }}>
                            {e.dir} {e.peer}
                          </span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: e.india_impact === 'HIGH' ? '#FF3131' : e.india_impact === 'MEDIUM' ? '#FFB800' : L45, marginLeft: 8 }}>
                            {(e.relation || '').replace(/_/g, ' ')} · {e.india_impact}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map((e, i) => (
                      <div key={i} style={{ padding: '5px 0', borderBottom: `1px solid ${L06}` }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: W55 }}>
                          {e.source === selectedNode.id
                            ? `→ ${nodes.find(n => n.id === e.target)?.name || e.target}`
                            : `← ${nodes.find(n => n.id === e.source)?.name || e.source}`}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: e.conflictFlag ? '#FF3131' : L45, marginLeft: 8 }}>
                          {e.relation}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const nav = useNavigate()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [filterDomain,   setFilterDomain]   = useState('ALL')
  const [filterImpact,   setFilterImpact]   = useState('ALL')
  const [searchTerm,     setSearchTerm]     = useState('')
  const [cutoffDate,     setCutoffDate]     = useState(NOW)
  const [alerts,         setAlerts]         = useState<any[]>([])

  // ── Real API data ──────────────────────────────────────────
  const { data: graphData, loading: graphLoading } = useGraph(
    filterDomain !== 'ALL' ? filterDomain : undefined,
    filterImpact !== 'ALL' ? filterImpact : undefined,
  )
  const { data: statsData } = useStats()

  // Map API nodes to GeoNode shape for D3
  const NODES: GeoNode[] = (graphData?.nodes || []).map((n: any) => ({
    id:          n.id,
    name:        n.id,
    lat:         0,
    lng:         0,
    type:        (n.ontology_category || 'neutral') as any,
    wikidataId:  n.wikidata_id || '',
    impactScore: 50,
    confidence:  0.75,
  }))

  const EDGES: GeoEdge[] = (graphData?.links || []).map((e: any, i: number) => ({
    id:           `e${i}`,
    source:       e.source,
    target:       e.target,
    relation:     e.relation || '',
    confidence:   e.confidence || 0.75,
    conflictFlag: e.conflict_flag || false,
    validFrom:    e.valid_from || '',
    sourceUrl:    e.source_url || '',
  }))

  // Fetch alerts once
  useEffect(() => {
    api.alerts().then(r => setAlerts(r.alerts || [])).catch(() => {})
  }, [])

  const selectedNode = NODES.find(n => n.id === selectedNodeId) || null

  // Stats from real API, fallback to computed
  const totalNodes  = statsData?.total_nodes  ?? NODES.length
  const totalEdges  = statsData?.total_edges  ?? EDGES.length
  const highEdges   = statsData?.high_impact_edges ?? EDGES.filter(e => e.conflictFlag).length
  const lastUpdated = statsData?.last_updated ?? new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })

  const DOMAINS = ['ALL', 'GEOPOLITICS', 'ECONOMICS', 'DEFENSE', 'TECHNOLOGY', 'CLIMATE', 'SOCIETY']
  const IMPACTS  = ['ALL', 'HIGH', 'CRITICAL']

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG, fontFamily: 'JetBrains Mono, monospace' }}>

      {/* ── NAVBAR ── */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 24, padding: '0 16px', borderBottom: `1px solid ${L12}`, background: 'rgba(3,10,13,0.95)', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', color: LIME }}>BHARATINTEL</span>
        <div style={{ width: 1, height: 16, background: L12 }} />
        {NAV_ITEMS.map(item => (
          <button
            key={item.label}
            onClick={() => nav(item.path)}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.1em',
              color: item.label === 'DASHBOARD' ? LIME : MUTED,
              background: 'transparent',
              border: 'none',
              borderBottom: item.label === 'DASHBOARD' ? `1px solid ${LIME}` : '1px solid transparent',
              cursor: 'pointer',
              paddingBottom: 2,
            }}
          >
            {item.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: L45 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: LIME, animation: 'pulse-green 2s infinite' }} />
          LIVE · {totalNodes} NODES · {lastUpdated} IST
        </div>
      </div>

      {/* ── BENTO BODY ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 380px', overflow: 'hidden' }}>

        {/* ════ LEFT — filters + stats ════ */}
        <div style={{ borderRight: `1px solid ${L12}`, background: SURF, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* stats 2x2 grid */}
          <div style={{ padding: 12, borderBottom: `1px solid ${L12}`, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 10 }}>GRAPH STATISTICS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'NODES',   value: totalNodes,  color: LIME     },
                { label: 'EDGES',   value: totalEdges,  color: LIME     },
                { label: 'HIGH',    value: highEdges,   color: '#FF3131'},
                { label: 'UPDATED', value: lastUpdated, color: L45      },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: L03, border: `1px solid ${L06}`, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4, letterSpacing: '-0.02em' }}>{value}</div>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* domain filters */}
          <div style={{ padding: 12, borderBottom: `1px solid ${L12}`, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>DOMAIN FILTER</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DOMAINS.map(d => (
                <button
                  key={d}
                  onClick={() => setFilterDomain(d)}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    color: filterDomain === d ? (DOMAIN_COLOR[d] || LIME) : MUTED,
                    background: filterDomain === d ? `${DOMAIN_COLOR[d] || LIME}0f` : 'transparent',
                    border: `1px solid ${filterDomain === d ? (DOMAIN_COLOR[d] || LIME) + '40' : L06}`,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {d !== 'ALL' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOMAIN_COLOR[d] || LIME, display: 'inline-block', flexShrink: 0 }} />}
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* impact filter */}
          <div style={{ padding: 12, borderBottom: `1px solid ${L12}`, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>IMPACT FILTER</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {IMPACTS.map(i => (
                <button
                  key={i}
                  onClick={() => setFilterImpact(i)}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    color: filterImpact === i ? (i === 'CRITICAL' ? '#FF3131' : i === 'HIGH' ? '#FFB800' : LIME) : MUTED,
                    background: filterImpact === i ? L06 : 'transparent',
                    border: `1px solid ${filterImpact === i ? L20 : L06}`,
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* entity search */}
          <div style={{ padding: 12, borderBottom: `1px solid ${L12}`, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>ENTITY SEARCH</div>
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search entity..."
              style={{
                width: '100%',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: LIME,
                background: L03,
                border: `1px solid ${L12}`,
                padding: '6px 8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ontology legend */}
          <div style={{ padding: 12, flex: 1 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 10 }}>ONTOLOGY LEGEND</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.06em' }}>{type.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════ CENTER — graph canvas ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#020e14', position: 'relative', overflow: 'hidden' }}>

          {/* graph label */}
          <div style={{ position: 'absolute', top: 12, left: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
            <span style={{ fontSize: 10, color: L45, letterSpacing: '0.12em' }}>⊞ GRAPH VIEW</span>
          </div>

          {/* zoom hint */}
          <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 10, fontSize: 9, color: 'rgba(200,240,37,0.2)', letterSpacing: '0.06em', pointerEvents: 'none' }}>
            SCROLL TO ZOOM · DRAG NODES
          </div>

          {/* D3 graph */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ForceGraph
              nodes={NODES}
              edges={EDGES}
              filterDomain={filterDomain}
              filterImpact={filterImpact}
              searchTerm={searchTerm}
              cutoffDate={cutoffDate}
              selectedNodeId={selectedNodeId}
              onNodeClick={id => setSelectedNodeId(prev => prev === id ? null : id)}
            />
          </div>

          {/* Time Machine */}
          <TimeMachine value={cutoffDate} onChange={setCutoffDate} />
        </div>

        {/* ════ RIGHT — intel panel ════ */}
        <div style={{ borderLeft: `1px solid ${L12}`, background: SURF, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* panel header */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${L12}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: L45, letterSpacing: '0.12em' }}>INTEL PANEL</span>
            {selectedNode && (
              <>
                <span style={{ fontSize: 9, color: MUTED }}>·</span>
                <span style={{ fontSize: 10, color: LIME }}>{selectedNode.name.toUpperCase()}</span>
              </>
            )}
          </div>

          <IntelPanel selectedNode={selectedNode} alerts={alerts} nodes={NODES} edges={EDGES} />
        </div>
      </div>
    </div>
  )
}
