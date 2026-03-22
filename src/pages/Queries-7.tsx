import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Ticker from '../components/Ticker'
import MiniGraph from '../components/MiniGraph'
import { QUERIES } from '../data/mockdata'
import type { Query } from '../data/mockdata'
import { api } from '../api/bharatgraph'

const _INITIAL_QUERIES: Query[] = [
  ...QUERIES,
  {
    id: 'q4', number: 4,
    question: 'What is the current status of Hambantota Port?',
    answer: "Sri Lanka leased Hambantota to China Merchants Port on a 99-year agreement in 2017 after failing to service a $1.12B loan. The port sits 200nm from India's southern coast near critical Indian Ocean shipping lanes. A Chinese oil refinery was announced Q1 2025.",
    timestamp: '2d ago', edgesTraversed: 9, sources: 5,
    cypherGenerated: `MATCH (c:Country {id:'Q148'})-[r:CONTROLS_PORT]->(p:Infrastructure {name:'Hambantota'}) RETURN r, p`,
    usedNodes: ['Q148', 'Q854', 'Gwadar'],
  },
  {
    id: 'q5', number: 5,
    question: "How does Nepal's BRI accession affect India?",
    answer: "Nepal signed a BRI Framework in December 2024 identifying 10 projects including the Kerung-Kathmandu railway. India-Nepal trade fell 16.6% in Sep 2025. Nepal sits on India's northern buffer arc — BRI entrenchment would collapse 3 buffer state edges.",
    timestamp: '3d ago', edgesTraversed: 11, sources: 7,
    cypherGenerated: `MATCH (n:Country {id:'Q837'})-[r:PARTICIPATES_IN]->(bri:Treaty {name:'BRI'}) RETURN r, n, bri`,
    usedNodes: ['Q668', 'Q837', 'Q148', 'BRI'],
  },
  {
    id: 'q6', number: 6,
    question: 'Explain the Quad alliance strategic significance',
    answer: 'The Quad (India, USA, Japan, Australia) has deepened Indo-Pacific cooperation against Chinese military expansion. The US reaffirmed Arunachal Pradesh as Indian territory June 2025. Pentagon 2025 report: China using reduced LAC tensions to prevent deepening US-India ties.',
    timestamp: '4d ago', edgesTraversed: 16, sources: 9,
    cypherGenerated: `MATCH (q:Organization {name:'Quad'})<-[:MEMBER]-(c:Country) RETURN c`,
    usedNodes: ['Q668', 'US'],
  },
]

const NAV = [
  { label: 'TERMINAL',  path: '/terminal'  },
  { label: 'DASHBOARD', path: '/dashboard' },
  { label: 'ALERTS',    path: '/alerts'    },
  { label: 'QUERIES',   path: '/queries'   },
  { label: 'WHAT-IF',   path: '/whatif'    },
]

const SOURCES = ['gdelt.org', 'thehindu.com', 'reuters.com', 'cfr.org', 'aljazeera.com']

export default function Queries() {
  const nav = useNavigate()
  const [openId, setOpenId]     = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [newQuery,    setNewQuery]    = useState('')
  const [isRunning,   setIsRunning]   = useState(false)
  const [queryList,   setQueryList]   = useState<Query[]>(_INITIAL_QUERIES)

  const filtered = queryList.filter(q =>
    search === '' || q.question.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = useCallback((id: string) => {
    setOpenId(prev => prev === id ? null : id)
  }, [])

  const handleNewQuery = async () => {
    if (!newQuery.trim()) return
    setIsRunning(true)
    try {
      const res = await api.query(newQuery)
      const newQ: Query = {
        id:             `q${Date.now()}`,
        number:         queryList.length + 1,
        question:       res.question,
        answer:         res.answer,
        timestamp:      new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        edgesTraversed: res.sources_used,
        sources:        res.sources_used,
        cypherGenerated: `MATCH (a:Entity)-[r:RELATION]->(b:Entity) WHERE toLower(a.name) CONTAINS toLower('${newQuery.split(' ')[0]}') RETURN a,r,b LIMIT 20`,
        usedNodes:      [...new Set((res.evidence || []).flatMap((e: any) => [e.subject, e.object]).filter(Boolean))].slice(0, 5),
      }
      setQueryList(prev => [newQ, ...prev])
      setNewQuery('')
      setOpenId(newQ.id)
    } catch (err) {
      console.error('Query failed:', err)
    }
    setIsRunning(false)
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
              item.label === 'QUERIES'
                ? 'text-[#c8f025] border-b border-[#c8f025]'
                : 'text-[rgba(255,255,255,0.2)] hover:text-[rgba(200,240,37,0.45)]'
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="font-mono text-xxs text-[rgba(200,240,37,0.45)]">{filtered.length} QUERIES</span>
      </div>

      <Ticker />

      {/* ── search + new query bar ── */}
      {/* ── query input bar ── */}
      <div
        className="shrink-0 flex flex-col border-b border-[rgba(200,240,37,0.12)]"
        style={{ background: 'rgba(7,18,24,0.95)' }}
      >
        {/* main new-query row */}
        <div className="flex items-center border-b border-[rgba(200,240,37,0.08)]" style={{ minHeight: 56 }}>
          <span className="font-mono text-[rgba(200,240,37,0.4)] text-base px-4 select-none shrink-0">&gt;</span>
          <input
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleNewQuery() }}
            placeholder="Ask anything about India's strategic situation..."
            className="flex-1 font-mono text-base bg-transparent border-0 outline-none tracking-wide py-4 pr-4"
            style={{
              color: 'rgba(255,255,255,0.92)',
              caretColor: '#c8f025',
            }}
          />
          <button
            onClick={handleNewQuery}
            className="font-mono text-xs tracking-widest px-6 shrink-0 h-full cursor-pointer transition-all duration-150 border-l border-[rgba(200,240,37,0.12)]"
            style={{
              color: isRunning ? 'rgba(200,240,37,0.5)' : '#c8f025',
              background: isRunning ? 'rgba(200,240,37,0.06)' : 'transparent',
              minHeight: 56,
              letterSpacing: '0.12em',
            }}
            onMouseEnter={e => { if (!isRunning) (e.currentTarget as HTMLElement).style.background = 'rgba(200,240,37,0.08)' }}
            onMouseLeave={e => { if (!isRunning) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {isRunning ? '[ RUNNING... ]' : '[ EXECUTE ]'}
          </button>
        </div>
        {/* search history row */}
        <div className="flex items-center" style={{ minHeight: 36 }}>
          <span className="font-mono text-[rgba(200,240,37,0.25)] text-xs px-4 select-none shrink-0">HISTORY</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter past queries..."
            className="flex-1 font-mono text-xs bg-transparent border-0 outline-none tracking-wide py-2 pr-4"
            style={{
              color: 'rgba(255,255,255,0.6)',
              caretColor: '#c8f025',
            }}
          />
        </div>
      </div>

      {/* ── query card grid ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid border-b border-[rgba(200,240,37,0.12)]" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {filtered.map((query, idx) => {
            const isOpen = openId === query.id
            const colIdx = idx % 3

            return (
              <div key={query.id} className="relative">

                {/* card */}
                <div
                  onClick={() => toggle(query.id)}
                  className="flex flex-col gap-2 p-4 cursor-pointer transition-colors duration-150"
                  style={{
                    borderRight:  colIdx < 2 ? '1px solid rgba(200,240,37,0.12)' : 'none',
                    borderBottom: '1px solid rgba(200,240,37,0.12)',
                    background:   isOpen ? 'rgba(200,240,37,0.03)' : 'transparent',
                    minHeight:    160,
                  }}
                  onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(200,240,37,0.015)' }}
                  onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* number + edges badge */}
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-[rgba(255,255,255,0.2)]">
                      {String(query.number).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-xxs px-2 py-0.5 bg-[rgba(200,240,37,0.06)] text-[rgba(200,240,37,0.45)] tracking-wide">
                      {query.edgesTraversed} EDGES
                    </span>
                  </div>

                  {/* question */}
                  <div
                    className="font-mono text-sm flex-1 leading-relaxed transition-colors duration-150"
                    style={{ color: isOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}
                  >
                    {query.question}
                  </div>

                  {/* meta */}
                  <div className="flex justify-between">
                    <span className="font-mono text-xxs text-[rgba(255,255,255,0.2)]">{query.sources} sources</span>
                    <span className="font-mono text-xxs text-[rgba(255,255,255,0.2)]">{query.timestamp}</span>
                  </div>
                </div>

                {/* ── inline expander on col 2 only, spans all 3 cols ── */}
                {colIdx === 2 && (() => {
                  const rowStart    = Math.floor(idx / 3) * 3
                  const rowQueries  = filtered.slice(rowStart, rowStart + 3)
                  const openRowQuery = rowQueries.find(q => q.id === openId)
                  if (!openRowQuery) return null

                  return (
                    <AnimatePresence>
                      <motion.div
                        key={`qexp-${rowStart}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden bg-[rgba(0,0,0,0.5)]"
                        style={{
                          position:     'relative',
                          left:         '-200%',
                          width:        '300%',
                          minWidth:     0,
                          borderBottom: '1px solid rgba(200,240,37,0.12)',
                          borderTop:    '1px solid rgba(200,240,37,0.15)',
                          zIndex:       10,
                        }}
                      >
                        <div className="p-5 pb-6">

                          {/* header */}
                          <div className="flex justify-between items-start mb-5">
                            <div>
                              <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-1.5">
                                QUERY {String(openRowQuery.number).padStart(2, '00')} — INTELLIGENCE RESULT
                              </div>
                              <div className="font-mono text-base text-[rgba(255,255,255,0.85)] leading-snug" style={{ maxWidth: 600 }}>
                                {openRowQuery.question}
                              </div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setOpenId(null) }}
                              className="font-mono text-xxs text-[rgba(255,255,255,0.2)] border border-[rgba(200,240,37,0.12)] px-3 py-1 bg-transparent cursor-pointer hover:text-[rgba(255,255,255,0.5)] transition-colors shrink-0"
                            >
                              [CLOSE]
                            </button>
                          </div>

                          {/* 3-col content */}
                          <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr 1fr', minWidth: 0 }}>

                            {/* col 1 — answer */}
                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                              <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">ANSWER</div>
                              <div className="font-mono text-xs text-[rgba(255,255,255,0.7)] leading-relaxed border-l-2 border-[#c8f025] pl-3" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
                                {openRowQuery.answer}
                              </div>
                              <div className="mt-4">
                                <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-2">STATS</div>
                                <div className="flex gap-5">
                                  {[['EDGES', openRowQuery.edgesTraversed], ['SOURCES', openRowQuery.sources]].map(([k, v]) => (
                                    <div key={String(k)}>
                                      <div className="font-mono text-xl font-medium text-[#c8f025]">{v}</div>
                                      <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider">{k}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* col 2 — cypher + node map */}
                            <div>
                              <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">GENERATED CYPHER</div>
                              <pre className="font-mono text-xs text-[rgba(200,240,37,0.7)] bg-[rgba(200,240,37,0.04)] border border-[rgba(200,240,37,0.12)] p-3 whitespace-pre-wrap leading-relaxed mb-4 overflow-x-auto">
                                {openRowQuery.cypherGenerated}
                              </pre>
                              <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-2">NODE MAP</div>
                              <MiniGraph highlightNodeIds={openRowQuery.usedNodes} height={160} />
                            </div>

                            {/* col 3 — nodes + evidence */}
                            <div>
                              <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">NODES TRAVERSED</div>
                              <div className="flex flex-wrap gap-1.5 mb-5">
                                {openRowQuery.usedNodes.map(nid => (
                                  <span
                                    key={nid}
                                    className="font-mono text-xxs px-2 py-0.5 border border-[rgba(200,240,37,0.2)] text-[rgba(200,240,37,0.45)] bg-[rgba(200,240,37,0.04)]"
                                  >
                                    {nid}
                                  </span>
                                ))}
                              </div>

                              <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-3">EVIDENCE SOURCES</div>
                              <div className="flex flex-col gap-1.5">
                                {Array.from({ length: Math.min(openRowQuery.sources, 4) }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between items-center px-2 py-1.5 border border-[rgba(200,240,37,0.12)] bg-[rgba(0,0,0,0.3)]"
                                  >
                                    <span className="font-mono text-xs text-[rgba(255,255,255,0.4)]">{SOURCES[i]}</span>
                                    <span
                                      className="font-mono text-xxs"
                                      style={{ color: i % 2 === 0 ? 'rgba(200,240,37,0.6)' : 'rgba(255,49,49,0.6)' }}
                                    >
                                      {i % 2 === 0 ? '+' : '−'}{(Math.random() * 2 + 0.5).toFixed(1)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4">
                                <div className="font-mono text-xxs text-[rgba(255,255,255,0.2)] tracking-wider mb-1.5">TIMESTAMP</div>
                                <div className="font-mono text-xs text-[rgba(200,240,37,0.45)]">{openRowQuery.timestamp}</div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {/* empty state */}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center font-mono text-xs text-[rgba(255,255,255,0.2)] tracking-widest" style={{ height: 200 }}>
            NO QUERIES MATCHING "{search}"
          </div>
        )}
      </div>
    </div>
  )
}
