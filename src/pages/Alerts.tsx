import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Ticker from '../components/Ticker'
import MiniGraph from '../components/MiniGraph'
import { ALERTS as MOCK_ALERTS } from '../data/mockdata'
import type { Alert } from '../data/mockdata'
import { api } from '../api/bharatgraph'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3131',
  HIGH:     '#FF6B00',
  WATCH:    '#FFB800',
  INFO:     '#c8f025',
}

const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(255,49,49,0.08)',
  HIGH:     'rgba(255,107,0,0.08)',
  WATCH:    'rgba(255,184,0,0.08)',
  INFO:     'rgba(200,240,37,0.06)',
}

type Filter = 'ALL' | 'CRITICAL' | 'WATCH' | 'INFO'

const NAV = [
  { label: 'TERMINAL',  path: '/terminal'  },
  { label: 'DASHBOARD', path: '/dashboard' },
  { label: 'ALERTS',    path: '/alerts'    },
  { label: 'QUERIES',   path: '/queries'   },
  { label: 'WHAT-IF',   path: '/whatif'    },
]

export default function Alerts() {
  const nav = useNavigate()
  const [openId,     setOpenId]     = useState<string | null>(null)
  const [filter,     setFilter]     = useState<Filter>('ALL')
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([])

  useEffect(() => {
    api.alerts()
      .then(r => {
        if (r.alerts && r.alerts.length > 0) {
          const mapped: Alert[] = r.alerts.map((a: any, i: number) => ({
            id:             `live-${i}`,
            number:         i + 1,
            severity:       a.threat_level === 'HIGH' ? 'CRITICAL' : a.threat_level === 'MEDIUM' ? 'HIGH' : 'WATCH',
            title:          a.pattern,
            subtitle:       a.description,
            timestamp:      'live',
            region:         a.domain,
            confidence:     0.85,
            pattern:        a.pattern,
            steps:          (a.nodes || []).map((n: string) => `${n} detected`),
            edges:          (a.evidence || []).slice(0, 3).map((e: any) => `${e.asset || e.actor || e.zone || '?'}: ${e.context || ''}`),
            recommendation: a.watch_for,
            nodes:          a.nodes || [],
          }))
          setLiveAlerts(mapped)
        } else {
          setLiveAlerts(MOCK_ALERTS)
        }
      })
      .catch(() => setLiveAlerts(MOCK_ALERTS))
  }, [])

  const ALERTS = liveAlerts.length > 0 ? liveAlerts : MOCK_ALERTS

  const filtered = ALERTS.filter(a =>
    filter === 'ALL' ? true :
    filter === 'CRITICAL' ? (a.severity === 'CRITICAL' || a.severity === 'HIGH') :
    a.severity === filter
  )

  const openIndex    = filtered.findIndex(a => a.id === openId)
  const openRowIndex = openIndex === -1 ? -1 : Math.floor(openIndex / 3)
  const openAlert    = ALERTS.find(a => a.id === openId)

  const toggle = useCallback((id: string) => {
    setOpenId(prev => prev === id ? null : id)
  }, [])

  const rows: Alert[][] = []
  for (let i = 0; i < filtered.length; i += 3) {
    rows.push(filtered.slice(i, i + 3))
  }

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">

      {/* ── navbar ── */}
      <div className="flex shrink-0 items-center gap-6 px-4 border-b border-[rgba(200,240,37,0.12)] bg-[rgba(0,0,0,0.6)]" style={{ height: 48 }}>
        <span className="font-mono text-sm font-medium text-[#c8f025] tracking-widest">BHARATINTEL</span>
        <div className="w-px h-4 bg-[rgba(200,240,37,0.12)]" />
        {NAV.map(item => (
          <button
            key={item.label}
            onClick={() => nav(item.path)}
            className={`font-mono text-xxs tracking-widest pb-0.5 bg-transparent border-0 cursor-pointer transition-colors duration-150 ${
              item.label === 'ALERTS'
                ? 'text-[#c8f025] border-b border-[#c8f025]'
                : 'text-[rgba(255,255,255,0.2)] hover:text-[rgba(200,240,37,0.45)]'
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="font-mono text-xxs text-[rgba(200,240,37,0.45)]">{filtered.length} ACTIVE ALERTS</span>
      </div>

      <Ticker />

      {/* ── filter bar ── */}
      <div className="flex shrink-0 items-center border-b border-[rgba(200,240,37,0.12)] bg-[rgba(0,0,0,0.3)]">
        {(['ALL', 'CRITICAL', 'WATCH', 'INFO'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono text-xxs tracking-wider px-5 py-2.5 border-r border-[rgba(200,240,37,0.12)] cursor-pointer transition-all duration-150 border-0 border-r ${
              filter === f
                ? 'text-[#c8f025] bg-[rgba(200,240,37,0.08)] border-b border-[#c8f025]'
                : 'text-[rgba(255,255,255,0.2)] bg-transparent hover:text-[rgba(200,240,37,0.45)]'
            }`}
            style={{ borderRight: '1px solid rgba(200,240,37,0.12)' }}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <span className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider px-4">
          CLICK ANY ALERT TO EXPAND
        </span>
      </div>

      {/* ── scrollable grid ── */}
      <div className="flex-1 overflow-y-auto">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx}>

            {/* row of cards */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
                borderBottom: openRowIndex === rowIdx ? 'none' : '1px solid rgba(200,240,37,0.12)',
              }}
            >
              {row.map((alert, colIdx) => {
                const isOpen    = openId === alert.id
                const globalIdx = rowIdx * 3 + colIdx
                return (
                  <div
                    key={alert.id}
                    onClick={() => toggle(alert.id)}
                    className="relative p-4 cursor-pointer transition-colors duration-150"
                    style={{
                      borderRight:   colIdx < 2 ? '1px solid rgba(200,240,37,0.12)' : 'none',
                      borderBottom:  openRowIndex === rowIdx ? '1px solid rgba(200,240,37,0.12)' : 'none',
                      background:    isOpen ? 'rgba(200,240,37,0.03)' : 'transparent',
                      paddingLeft:   16,
                    }}
                    onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(200,240,37,0.015)' }}
                    onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {/* top accent bar */}
                    <div
                      className="absolute top-0 left-0 right-0 transition-opacity duration-200"
                      style={{ height: 2, background: SEV_COLOR[alert.severity], opacity: isOpen ? 1 : 0 }}
                    />
                    {/* left accent line */}
                    <div
                      className="absolute top-0 bottom-0 left-0 transition-opacity duration-200"
                      style={{ width: 2, background: SEV_COLOR[alert.severity], opacity: isOpen ? 1 : 0.3 }}
                    />

                    <div className="pl-2">
                      {/* number + badge */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs text-[rgba(255,255,255,0.2)]">
                          {String(globalIdx + 1).padStart(2, '0')}
                        </span>
                        <span
                          className="font-mono text-xxs px-2 py-0.5 tracking-wide"
                          style={{ background: SEV_BG[alert.severity], color: SEV_COLOR[alert.severity] }}
                        >
                          {alert.severity}
                        </span>
                      </div>

                      {/* title */}
                      <div
                        className="font-mono text-sm font-medium mb-1.5 leading-snug transition-colors duration-150"
                        style={{ color: isOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}
                      >
                        {alert.title}
                      </div>

                      {/* subtitle */}
                      <div className="font-mono text-xxs text-[rgba(200,240,37,0.45)] mb-4">
                        {alert.subtitle}
                      </div>

                      {/* meta */}
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xxs text-[rgba(255,255,255,0.2)]">{alert.region}</span>
                        <span className="font-mono text-xxs text-[rgba(255,255,255,0.2)]">{alert.timestamp}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* empty fill cells */}
              {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  style={{
                    borderLeft:   '1px solid rgba(200,240,37,0.12)',
                    borderBottom: openRowIndex === rowIdx ? '1px solid rgba(200,240,37,0.12)' : 'none',
                  }}
                />
              ))}
            </div>

            {/* ── expander ── */}
            <AnimatePresence>
              {openRowIndex === rowIdx && openAlert && (
                <motion.div
                  key={`exp-${rowIdx}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden bg-[rgba(0,0,0,0.4)]"
                  style={{
                    borderBottom: '1px solid rgba(200,240,37,0.12)',
                    borderTop: `1px solid ${SEV_COLOR[openAlert.severity]}33`,
                  }}
                >
                  <div className="p-5 pb-6">

                    {/* expander header */}
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-1.5">
                          {openAlert.pattern} — PATTERN ANALYSIS ({String(openAlert.number).padStart(2, '0')})
                        </div>
                        <div className="font-mono text-base font-medium text-[rgba(255,255,255,0.9)]">
                          {openAlert.title}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenId(null) }}
                        className="font-mono text-xxs text-[rgba(255,255,255,0.2)] border border-[rgba(200,240,37,0.12)] px-3 py-1 bg-transparent cursor-pointer hover:text-[rgba(255,255,255,0.5)] transition-colors shrink-0"
                      >
                        [CLOSE]
                      </button>
                    </div>

                    {/* 3-col detail */}
                    <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>

                      {/* col 1 — pattern steps */}
                      <div>
                        <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">
                          PATTERN STEPS
                        </div>
                        {openAlert.steps.map((step, i) => (
                          <div
                            key={i}
                            className="flex gap-2 items-start py-1.5 border-b border-[rgba(200,240,37,0.06)] font-mono text-xs"
                            style={{ color: step.includes('✓') ? 'rgba(200,240,37,0.8)' : 'rgba(255,255,255,0.3)' }}
                          >
                            <span className="shrink-0 text-xxs" style={{ color: step.includes('✓') ? '#c8f025' : 'rgba(255,255,255,0.2)' }}>
                              {step.includes('✓') ? '◆' : '◇'}
                            </span>
                            {step.replace(' ✓', '')}
                          </div>
                        ))}

                        {/* confidence */}
                        <div className="mt-5">
                          <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-1.5">
                            CONFIDENCE
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-medium text-[#c8f025]">
                              {(openAlert.confidence * 100).toFixed(0)}
                            </span>
                            <span className="font-mono text-sm text-[rgba(200,240,37,0.45)]">%</span>
                          </div>
                          <div className="h-0.5 bg-[rgba(200,240,37,0.1)] mt-2">
                            <div
                              className="h-full bg-[#c8f025] transition-all duration-500"
                              style={{ width: `${openAlert.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* col 2 — edges + mini graph */}
                      <div>
                        <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">
                          EDGES INVOLVED
                        </div>
                        {openAlert.edges.map((edge, i) => (
                          <div
                            key={i}
                            className="font-mono text-xs text-[rgba(255,255,255,0.4)] py-1.5 border-b border-[rgba(200,240,37,0.06)]"
                          >
                            {edge}
                          </div>
                        ))}
                        <div className="mt-4">
                          <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-2">
                            NODE MAP
                          </div>
                          <MiniGraph highlightNodeIds={openAlert.nodes} height={180} />
                        </div>
                      </div>

                      {/* col 3 — recommendation */}
                      <div>
                        <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">
                          RECOMMENDATION
                        </div>
                        <div className="font-mono text-xs text-[rgba(255,255,255,0.65)] leading-relaxed mb-5">
                          {openAlert.recommendation}
                        </div>

                        <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-2">
                          REGION
                        </div>
                        <div className="font-mono text-xs text-[rgba(200,240,37,0.45)] px-2 py-1.5 border border-[rgba(200,240,37,0.12)] bg-[rgba(200,240,37,0.03)] mb-4">
                          {openAlert.region}
                        </div>

                        <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-2">
                          AFFECTED NODES
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {openAlert.nodes.map(nid => (
                            <span
                              key={nid}
                              className="font-mono text-xxs px-2 py-0.5 border border-[rgba(200,240,37,0.2)] text-[rgba(200,240,37,0.45)] bg-[rgba(200,240,37,0.04)]"
                            >
                              {nid}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* ── two big feature cards ── */}
        <div
          className="grid border-t border-[rgba(200,240,37,0.12)]"
          style={{ gridTemplateColumns: '1fr 1fr', minHeight: 240 }}
        >
          {/* flat map */}
          <div className="flex flex-col p-5 border-r border-[rgba(200,240,37,0.12)] bg-[rgba(200,240,37,0.01)]">
            <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">
              ACTIVE EVENT MAP
            </div>
            <div className="flex-1 relative overflow-hidden border border-[rgba(200,240,37,0.12)] bg-[#020e14]" style={{ minHeight: 180 }}>
              <svg viewBox="0 0 800 400" className="w-full h-full opacity-70">
                <rect x="0" y="0" width="800" height="400" fill="#020e14" />
                {[100, 200, 300, 400, 500, 600, 700].map(x => (
                  <line key={x} x1={x} y1="0" x2={x} y2="400" stroke="rgba(200,240,37,0.05)" strokeWidth="0.5" />
                ))}
                {[80, 160, 240, 320].map(y => (
                  <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="rgba(200,240,37,0.05)" strokeWidth="0.5" />
                ))}
                <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(200,240,37,0.1)" strokeWidth="0.5" strokeDasharray="4 4" />
                {ALERTS.filter(a => a.lat && a.lng).map(alert => {
                  const x = ((alert.lng! + 180) / 360) * 800
                  const y = ((90 - alert.lat!) / 180) * 400
                  return (
                    <g key={alert.id}>
                      <circle cx={x} cy={y} r="6" fill="none" stroke={SEV_COLOR[alert.severity]} strokeWidth="1" opacity="0.5">
                        <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={x} cy={y} r="3" fill={SEV_COLOR[alert.severity]} opacity="0.9" />
                    </g>
                  )
                })}
              </svg>
              <div className="absolute bottom-1.5 right-2 font-mono text-[10px] text-[rgba(255,255,255,0.2)] tracking-wider">
                EQUIRECTANGULAR · LIVE EVENTS
              </div>
            </div>
          </div>

          {/* recent queries */}
          <div className="flex flex-col p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider">RECENT QUERIES</span>
              <button
                onClick={() => nav('/queries')}
                className="font-mono text-xxs text-[rgba(255,255,255,0.2)] border border-[rgba(200,240,37,0.12)] px-2 py-0.5 bg-transparent cursor-pointer hover:text-[rgba(200,240,37,0.45)] transition-colors"
              >
                ALL →
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { q: 'China leverage over India via rare earths', edges: 14, t: '08:14' },
                { q: 'Neighbors with overlapping defense agreements', edges: 22, t: '07:52' },
                { q: 'India-Pakistan media tone since Balakot', edges: 18, t: 'Yesterday' },
              ].map((item, i) => (
                <div
                  key={i}
                  onClick={() => nav('/queries')}
                  className="flex justify-between items-start gap-2 p-2.5 border border-[rgba(200,240,37,0.12)] cursor-pointer transition-all duration-150 hover:border-[rgba(200,240,37,0.3)] hover:bg-[rgba(200,240,37,0.02)]"
                >
                  <div className="font-mono text-xs text-[rgba(255,255,255,0.55)] flex-1 leading-snug">{item.q}</div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xxs text-[rgba(200,240,37,0.45)]">{item.edges} edges</div>
                    <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)]">{item.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
