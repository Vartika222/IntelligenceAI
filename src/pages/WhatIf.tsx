import { useState, useRef, useEffect, useCallback } from 'react'
import * as d3 from 'd3'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api, useWhatIf } from '../api/bharatgraph'
import type { WhatIfResponse } from '../api/bharatgraph'
import { NODES, NODE_COLORS } from '../data/mockdata'

// ── palette ───────────────────────────────────────────────────────────────────
const LIME   = '#c8f025'
const L45    = 'rgba(200,240,37,0.45)'
const L20    = 'rgba(200,240,37,0.20)'
const L12    = 'rgba(200,240,37,0.12)'
const L08    = 'rgba(200,240,37,0.08)'
const L04    = 'rgba(200,240,37,0.04)'
const RED    = '#FF3131'
const AMBER  = '#FFB800'
const TEAL   = '#1D9E75'
const MUTED  = 'rgba(255,255,255,0.22)'
const WHITE  = 'rgba(255,255,255,0.88)'
const W55    = 'rgba(255,255,255,0.55)'
const W35    = 'rgba(255,255,255,0.35)'
const BG     = '#030a0d'
const SURF   = '#071218'

const NAV_ITEMS = [
  { label: 'TERMINAL',  path: '/terminal'  },
  { label: 'DASHBOARD', path: '/dashboard' },
  { label: 'ALERTS',    path: '/alerts'    },
  { label: 'QUERIES',   path: '/queries'   },
  { label: 'WHAT-IF',   path: '/whatif'    },
]

const DOMAIN_COLOR: Record<string, string> = {
  GEOPOLITICS: '#FF3131',
  ECONOMICS:   '#FFB800',
  DEFENSE:     '#c8f025',
  TECHNOLOGY:  '#00B4FF',
  CLIMATE:     '#1D9E75',
  SOCIETY:     '#CC44FF',
  UNKNOWN:     'rgba(255,255,255,0.3)',
}

// Preset high-value nodes for quick demo scenarios
const PRESETS = [
  { id: 'Gwadar Port',       label: 'Gwadar Port',     tag: 'CPEC anchor'         },
  { id: 'China',             label: 'China',            tag: 'Primary adversary'   },
  { id: 'Hambantota Port',   label: 'Hambantota Port',  tag: 'String of pearls'    },
  { id: 'Strait of Malacca', label: 'Str. Malacca',     tag: 'Chokepoint'          },
  { id: 'Belt and Road Initiative', label: 'BRI',       tag: 'Debt network'        },
  { id: 'Rare Earth',        label: 'Rare Earths',      tag: 'Dependency vector'   },
]

// ── Impact bar ────────────────────────────────────────────────────────────────
function ImpactBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 2 }}
      />
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, large,
}: {
  label: string; value: string | number; sub?: string; color?: string; large?: boolean
}) {
  return (
    <div style={{
      background: L04,
      border: `1px solid ${L12}`,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: large ? 32 : 22,
        fontWeight: 700,
        color: color || LIME,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.12em' }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: W35, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// WHATIF GRAPH — network disruption visualisation
// ─────────────────────────────────────────────────────────────────────────────
function WhatIfGraph({ result }: { result: WhatIfResponse }) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 400, h: 240 })

  useEffect(() => {
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect
      setDims({ w: width, h: height })
    })
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || !result) return
    const { w, h } = dims
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const ic = (impact: string) =>
      impact === 'HIGH' ? '#FF3131' : impact === 'MEDIUM' ? '#FFB800' : 'rgba(200,240,37,0.35)'

    const nodeMap = new Map<string, { id: string; isRemoved: boolean; impact: string }>()
    nodeMap.set(result.removed_node, { id: result.removed_node, isRemoved: true, impact: 'HIGH' })
    ;(result.affected_edges || []).forEach((e: any) => {
      const s = e.subject || e.source || ''
      const o = e.object  || e.target || ''
      if (s && s !== result.removed_node) nodeMap.set(s, { id: s, isRemoved: false, impact: e.india_impact || 'LOW' })
      if (o && o !== result.removed_node) nodeMap.set(o, { id: o, isRemoved: false, impact: e.india_impact || 'LOW' })
    })

    const nodeArr = Array.from(nodeMap.values()).slice(0, 16)
    const nodeIds = new Set(nodeArr.map(n => n.id))
    const linkArr = (result.affected_edges || []).slice(0, 16)
      .map((e: any) => ({ source: e.subject || e.source || '', target: e.object || e.target || '', impact: e.india_impact || 'LOW' }))
      .filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target))

    const sim = d3.forceSimulation(nodeArr as any)
      .force('link', d3.forceLink(linkArr).id((d: any) => d.id).distance(55).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-140))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide(20))

    const g = svg.append('g')
    g.append('circle').attr('cx', w / 2).attr('cy', h / 2).attr('r', 38)
      .attr('fill', 'rgba(255,49,49,0.04)').attr('stroke', 'rgba(255,49,49,0.18)')
      .attr('stroke-dasharray', '4,3').attr('stroke-width', 1)

    const links = g.append('g').selectAll('line').data(linkArr).join('line')
      .attr('stroke', (d: any) => ic(d.impact))
      .attr('stroke-width', (d: any) => d.impact === 'HIGH' ? 2.5 : 1.5)
      .attr('stroke-opacity', 0.65)
      .attr('stroke-dasharray', (d: any) => d.impact === 'HIGH' ? '5,2' : 'none')

    const isolatedSet = new Set(result.isolated_nodes || [])
    const nodeGs = g.append('g').selectAll('g').data(nodeArr).join('g')

    nodeGs.filter((d: any) => isolatedSet.has(d.id)).append('circle')
      .attr('r', 12).attr('fill', 'none').attr('stroke', '#FFB800')
      .attr('stroke-dasharray', '2,2').attr('stroke-width', 1.5)

    nodeGs.append('circle')
      .attr('r', (d: any) => d.isRemoved ? 13 : 7)
      .attr('fill', (d: any) => d.isRemoved ? 'rgba(255,49,49,0.15)' : `${ic(d.impact)}18`)
      .attr('stroke', (d: any) => d.isRemoved ? '#FF3131' : ic(d.impact))
      .attr('stroke-width', (d: any) => d.isRemoved ? 2.5 : 1.5)

    nodeGs.filter((d: any) => d.isRemoved).append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', '13px').attr('fill', '#FF3131').attr('font-weight', 'bold').text('✕')

    nodeGs.append('text')
      .attr('dy', (d: any) => d.isRemoved ? 24 : 17)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '7.5px')
      .attr('fill', (d: any) => d.isRemoved ? '#FF3131' : ic(d.impact))
      .text((d: any) => { const n = String(d.id); return n.length > 11 ? n.slice(0, 11) + '…' : n })

    sim.on('tick', () => {
      links.attr('x1', (d: any) => (d.source as any).x).attr('y1', (d: any) => (d.source as any).y)
           .attr('x2', (d: any) => (d.target as any).x).attr('y2', (d: any) => (d.target as any).y)
      nodeGs.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop() }
  }, [dims, result])

  return (
    <div style={{ padding: '16px 28px', borderBottom: `1px solid ${L12}` }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.12em', marginBottom: 8 }}>
        NETWORK DISRUPTION MAP
      </div>
      <div ref={wrapRef} style={{ width: '100%', height: 240, background: 'rgba(0,0,0,0.25)', border: `1px solid ${L12}` }}>
        <svg ref={svgRef} width={dims.w} height={dims.h} style={{ width: '100%' }} />
      </div>
    </div>
  )
}

// ── Game theory panel ─────────────────────────────────────────────────────────
function GameTheoryPanel({ result }: { result: WhatIfResponse }) {
  const hasGameTheory = result.shapley_centrality !== undefined

  const deterrenceColor = (idx: number) =>
    idx >= 0.7 ? RED : idx >= 0.4 ? AMBER : TEAL

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.12em' }}>
        GAME THEORY ANALYSIS
      </div>

      {!hasGameTheory ? (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: MUTED,
          padding: '16px',
          border: `1px solid ${L12}`,
          background: L04,
          lineHeight: 1.8,
        }}>
          <span style={{ color: AMBER }}>⚠ </span>
          Backend game theory not yet enabled.<br />
          Add <span style={{ color: LIME }}>shapley_centrality</span>,{' '}
          <span style={{ color: LIME }}>deterrence_index</span>, and{' '}
          <span style={{ color: LIME }}>nash_equilibrium</span> to the{' '}
          <span style={{ color: LIME }}>/whatif</span> endpoint response.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Shapley centrality */}
          <div style={{ padding: '14px 16px', background: L04, border: `1px solid ${L12}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em' }}>
                SHAPLEY CENTRALITY
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: LIME }}>
                {result.shapley_centrality!.toFixed(1)}
              </span>
            </div>
            <ImpactBar value={result.shapley_centrality!} max={100} color={LIME} />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: W35, marginTop: 8, lineHeight: 1.6 }}>
              Marginal contribution to total network impact across all coalition subsets.
              Higher = harder to replace.
            </div>
          </div>

          {/* Deterrence index */}
          {result.deterrence_index !== undefined && (
            <div style={{ padding: '14px 16px', background: L04, border: `1px solid ${L12}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em' }}>
                  DETERRENCE INDEX
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: deterrenceColor(result.deterrence_index) }}>
                  {result.deterrence_index.toFixed(2)}
                </span>
              </div>
              <ImpactBar value={result.deterrence_index * 100} max={100} color={deterrenceColor(result.deterrence_index)} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: W35, marginTop: 8, lineHeight: 1.6 }}>
                {result.deterrence_index >= 0.7
                  ? '⚠ India highly exposed — insufficient counter-edges'
                  : result.deterrence_index >= 0.4
                  ? '◈ Partial deterrence — some gaps remain'
                  : '✓ India well-countered — deterrence maintained'
                }
              </div>
            </div>
          )}

          {/* Nash equilibrium */}
          {result.nash_equilibrium && (
            <div style={{ padding: '14px 16px', background: L04, border: `1px solid ${L12}` }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>
                NASH EQUILIBRIUM
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: WHITE, lineHeight: 1.6 }}>
                {result.nash_equilibrium}
              </div>
            </div>
          )}

          {/* Deterrence gaps */}
          {result.deterrence_gaps && result.deterrence_gaps.length > 0 && (
            <div style={{ padding: '14px 16px', background: `${RED}08`, border: `1px solid ${RED}25` }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: RED, letterSpacing: '0.1em', marginBottom: 10 }}>
                DETERRENCE GAPS EXPOSED
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.deterrence_gaps.map((gap, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: RED, fontSize: 9, marginTop: 2, flexShrink: 0 }}>◆</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: W55, lineHeight: 1.5 }}>{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATIF PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function WhatIf() {
  const nav                             = useNavigate()
  const { result, loading, error, simulate, reset } = useWhatIf()
  const [input,   setInput]             = useState('')
  const [suggestions, setSuggestions]   = useState<string[]>([])
  const [showSug, setShowSug]           = useState(false)
  const inputRef                        = useRef<HTMLInputElement>(null)

  // Build suggestion list from all known nodes
  const allNodeNames = NODES.map(n => n.name)

  const handleInputChange = (v: string) => {
    setInput(v)
    if (v.length < 2) { setSuggestions([]); setShowSug(false); return }
    const filtered = allNodeNames.filter(n => n.toLowerCase().includes(v.toLowerCase())).slice(0, 6)
    setSuggestions(filtered)
    setShowSug(filtered.length > 0)
  }

  const handleSimulate = (nodeId?: string) => {
    const target = nodeId || input.trim()
    if (!target) return
    setInput(target)
    setShowSug(false)
    simulate(target)
  }

  const impactColor = (score: number) =>
    score >= 150 ? RED : score >= 75 ? AMBER : LIME

  // Max impact for bar scaling
  const maxImpact = 300

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
              color: item.label === 'WHAT-IF' ? LIME : MUTED,
              background: 'transparent',
              border: 'none',
              borderBottom: item.label === 'WHAT-IF' ? `1px solid ${LIME}` : '1px solid transparent',
              cursor: 'pointer',
              paddingBottom: 2,
            }}
            onMouseEnter={e => { if (item.label !== 'WHAT-IF') (e.currentTarget as HTMLElement).style.color = L45 }}
            onMouseLeave={e => { if (item.label !== 'WHAT-IF') (e.currentTarget as HTMLElement).style.color = MUTED }}
          >
            {item.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: L45, letterSpacing: '0.08em' }}>
          STRATEGIC SIMULATION ENGINE
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div style={{ padding: '24px 32px 20px', borderBottom: `1px solid ${L12}`, background: SURF, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: L45, letterSpacing: '0.2em', marginBottom: 8 }}>WHAT-IF ENGINE</div>
        <div style={{ fontSize: 22, color: WHITE, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
          Node Removal Simulator
        </div>
        <div style={{ fontSize: 12, color: W55, lineHeight: 1.6, maxWidth: 600 }}>
          Remove any node from India's strategic graph and see the cascading impact —
          edges lost, India Impact Score delta, isolated actors, and game theory equilibrium shift.
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <div style={{ padding: '16px 32px', borderBottom: `1px solid ${L12}`, background: SURF, flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* input */}
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: L45, fontSize: 13 }}>⊘</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSimulate(); if (e.key === 'Escape') setShowSug(false) }}
              onFocus={() => input.length >= 2 && setShowSug(suggestions.length > 0)}
              placeholder="Enter node to remove — e.g. Gwadar Port, China, Hambantota Port..."
              style={{
                width: '100%',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                color: WHITE,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${L20}`,
                padding: '12px 14px 12px 38px',
                outline: 'none',
                caretColor: LIME,
                boxSizing: 'border-box',
              }}
            />
            {/* suggestions dropdown */}
            <AnimatePresence>
              {showSug && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#0a1a20',
                    border: `1px solid ${L20}`,
                    borderTop: 'none',
                    zIndex: 50,
                  }}
                >
                  {suggestions.map(s => {
                    const node = NODES.find(n => n.name === s)
                    const color = node ? NODE_COLORS[node.type] || LIME : LIME
                    return (
                      <div
                        key={s}
                        onClick={() => handleSimulate(s)}
                        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${L08}` }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = L08}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: W55 }}>{s}</span>
                        {node && (
                          <span style={{ fontSize: 10, color: MUTED, marginLeft: 'auto' }}>
                            {node.type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* simulate button */}
          <button
            onClick={() => handleSimulate()}
            disabled={loading || !input.trim()}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              color: loading ? MUTED : BG,
              background: loading ? L08 : LIME,
              border: `1px solid ${loading ? L12 : LIME}`,
              padding: '12px 24px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            {loading ? '[ SIMULATING... ]' : '[ SIMULATE REMOVAL ]'}
          </button>

          {result && (
            <button
              onClick={() => { reset(); setInput('') }}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: MUTED,
                background: 'transparent',
                border: `1px solid ${L12}`,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              RESET
            </button>
          )}
        </div>

        {/* preset scenarios */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: MUTED, letterSpacing: '0.12em', marginRight: 4 }}>QUICK SCENARIOS:</span>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => handleSimulate(p.id)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: input === p.id ? LIME : W35,
                background: input === p.id ? L08 : 'transparent',
                border: `1px solid ${input === p.id ? L20 : 'rgba(255,255,255,0.08)'}`,
                padding: '3px 10px',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (input !== p.id) (e.currentTarget as HTMLElement).style.color = W55 }}
              onMouseLeave={e => { if (input !== p.id) (e.currentTarget as HTMLElement).style.color = W35 }}
            >
              {p.label}
              <span style={{ color: MUTED, marginLeft: 6 }}>· {p.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* empty / loading state */}
        {!result && !loading && !error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ fontSize: 48, opacity: 0.08 }}>⊘</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 1.8 }}>
              Enter a node name above or pick a quick scenario<br />
              to simulate its removal from India's strategic graph
            </div>
          </div>
        )}

        {loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, border: `2px solid ${L12}`, borderTop: `2px solid ${LIME}`, borderRadius: '50%' }}
            />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: L45, letterSpacing: '0.1em' }}>
              SIMULATING REMOVAL...
            </div>
          </div>
        )}

        {error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: RED,
              padding: '20px 28px',
              border: `1px solid ${RED}30`,
              background: `${RED}08`,
              maxWidth: 480,
              lineHeight: 1.7,
            }}>
              <div style={{ marginBottom: 6, letterSpacing: '0.1em' }}>SIMULATION ERROR</div>
              <div style={{ color: W55 }}>{error}</div>
              <div style={{ color: MUTED, marginTop: 8, fontSize: 10 }}>
                Make sure the backend is running on localhost:8000
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 320px', minWidth: 0 }}
            >
              {/* ── LEFT — main results ── */}
              <div style={{ overflow: 'auto', borderRight: `1px solid ${L12}` }}>

                {/* summary banner */}
                <div style={{
                  padding: '20px 28px',
                  borderBottom: `1px solid ${L12}`,
                  background: `${RED}06`,
                  borderLeft: `3px solid ${RED}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: RED, boxShadow: `0 0 8px ${RED}` }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: WHITE, letterSpacing: '0.06em' }}>
                      REMOVING: {result.removed_node.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: W55, lineHeight: 1.7 }}>
                    {result.summary}
                  </div>
                </div>

                {/* 4 stat cards */}
                <div style={{ padding: '20px 28px', borderBottom: `1px solid ${L12}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <StatCard
                      label="EDGES LOST"
                      value={result.total_edges_lost}
                      color={result.total_edges_lost >= 5 ? RED : AMBER}
                      large
                    />
                    <StatCard
                      label="IMPACT SCORE LOST"
                      value={result.impact_score_lost}
                      sub="out of ~300 max"
                      color={impactColor(result.impact_score_lost)}
                      large
                    />
                    <StatCard
                      label="ISOLATED NODES"
                      value={result.isolated_nodes.length}
                      sub={result.isolated_nodes.length > 0 ? result.isolated_nodes.slice(0, 2).join(', ') : 'none'}
                      color={result.isolated_nodes.length > 0 ? RED : TEAL}
                      large
                    />
                    <StatCard
                      label="DOMAINS HIT"
                      value={Object.keys(result.domain_breakdown).length}
                      sub={Object.keys(result.domain_breakdown).join(' · ')}
                      color={LIME}
                      large
                    />
                  </div>
                </div>

                {/* network disruption map */}
                <WhatIfGraph result={result!} />

                {/* domain breakdown */}
                <div style={{ padding: '20px 28px', borderBottom: `1px solid ${L12}` }}>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em', marginBottom: 14 }}>DOMAIN BREAKDOWN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(result.domain_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([domain, count]) => {
                        const color = DOMAIN_COLOR[domain] || MUTED
                        const max   = Math.max(...Object.values(result.domain_breakdown))
                        return (
                          <div key={domain}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: W55, letterSpacing: '0.06em' }}>{domain}</span>
                              </div>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color, fontWeight: 700 }}>
                                {count} edge{count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <ImpactBar value={count} max={max} color={color} />
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* affected edges table */}
                <div style={{ padding: '20px 28px' }}>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em', marginBottom: 14 }}>
                    AFFECTED RELATIONSHIPS ({result.affected_edges.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 160px 80px 70px',
                      padding: '6px 10px',
                      borderBottom: `1px solid ${L12}`,
                      gap: 8,
                    }}>
                      {['RELATIONSHIP', 'RELATION TYPE', 'DOMAIN', 'IMPACT'].map(h => (
                        <span key={h} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: MUTED, letterSpacing: '0.1em' }}>{h}</span>
                      ))}
                    </div>
                    {result.affected_edges.map((e, i) => {
                      const domColor = DOMAIN_COLOR[e.domain] || MUTED
                      const impColor = e.india_impact === 'HIGH' ? RED : e.india_impact === 'MEDIUM' ? AMBER : LIME
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 160px 80px 70px',
                            padding: '9px 10px',
                            borderBottom: `1px solid rgba(255,255,255,0.04)`,
                            gap: 8,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = L04}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: W55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: WHITE }}>{(e as any).subject || e.source}</span>
                            <span style={{ color: MUTED }}> → </span>
                            <span>{(e as any).object || e.target}</span>
                          </div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: L45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.relation}
                          </div>
                          <div>
                            <span style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 9,
                              color: domColor,
                              background: `${domColor}14`,
                              padding: '2px 5px',
                            }}>
                              {(e.domain || 'UNK').slice(0, 4)}
                            </span>
                          </div>
                          <div>
                            <span style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 9,
                              color: impColor,
                              fontWeight: 700,
                            }}>
                              {e.india_impact}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── RIGHT — game theory + isolated nodes ── */}
              <div style={{ overflow: 'auto', background: SURF, display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* game theory */}
                <div style={{ padding: '20px 20px', borderBottom: `1px solid ${L12}` }}>
                  <GameTheoryPanel result={result} />
                </div>

                {/* isolated nodes */}
                <div style={{ padding: '20px 20px', borderBottom: `1px solid ${L12}` }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.12em', marginBottom: 12 }}>
                    ISOLATED NODES
                  </div>
                  {result.isolated_nodes.length === 0 ? (
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: TEAL }}>
                      ✓ No nodes become isolated
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.isolated_nodes.map(n => (
                        <span
                          key={n}
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 10,
                            color: RED,
                            background: `${RED}12`,
                            border: `1px solid ${RED}30`,
                            padding: '3px 8px',
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* try another */}
                <div style={{ padding: '20px 20px' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: MUTED, letterSpacing: '0.12em', marginBottom: 12 }}>
                    TRY ANOTHER SCENARIO
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {PRESETS.filter(p => p.id !== result.removed_node).slice(0, 4).map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSimulate(p.id)}
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 10,
                          color: W35,
                          background: 'transparent',
                          border: `1px solid rgba(255,255,255,0.07)`,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = L04; (e.currentTarget as HTMLElement).style.color = W55 }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = W35 }}
                      >
                        <span>{p.label}</span>
                        <span style={{ color: MUTED }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
