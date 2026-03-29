/**
 * BharatGraph API Service
 * Single source of truth for all backend calls.
 * Base URL: http://localhost:8000
 *
 * Usage:
 *   import { api } from '../api/bharatgraph'
 *   const stats = await api.stats()
 */

const BASE = 'http://localhost:8000'

// ── helpers ───────────────────────────────────────────────────────────────────
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${res.statusText}`)
  return res.json()
}

// ── response types ────────────────────────────────────────────────────────────

export interface GraphNode {
  id:                string
  type:              string
  ontology_category: string
  wikidata_id:       string | null
  first_seen:        string | null
  last_seen:         string | null
}

export interface GraphEdge {
  source:       string
  target:       string
  relation:     string
  context:      string
  confidence:   number
  valid_from:   string
  valid_to:     string | null
  source_name:  string
  source_url:   string
  domain:       string
  india_impact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
}

export interface SubgraphResponse {
  nodes:       GraphNode[]
  links:       GraphEdge[]
  total_nodes: number
  total_edges: number
  returned:    number
  offset:      number
  has_more:    boolean
}

export interface StatsResponse {
  total_nodes:       number
  total_edges:       number
  high_impact_edges: number
  domain_breakdown:  Record<string, number>
  ontology_breakdown:Record<string, number>
  last_updated:      string | null
}

export interface SearchResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  total: number
}

export interface TimelineResponse {
  node1:     string
  node2:     string
  from_date: string | null
  to_date:   string | null
  total:     number
  edges:     GraphEdge[]
}

export interface NodeDetailResponse extends GraphNode {
  outgoing_edges:    GraphEdge[]
  incoming_edges:    GraphEdge[]
  total_connections: number
  wikidata_url:      string | null
}

export interface KeyFact {
  claim:      string
  source:     string   // "KB" | "LIVE" | "EXPERT"
  confidence: number
  impact:     string   // "HIGH" | "MEDIUM" | "LOW"
}

export interface QueryResponse {
  // structured fields
  headline?:      string
  assessment?:    string
  key_facts?:     KeyFact[]
  graph_gaps?:    string | null
  watch_signals?: string[]
  data_sources?:  { kb_edges: number; live_edges: number; coverage: string }
  // legacy compat
  question:       string
  answer:         string
  evidence:       GraphEdge[]
  sources_used:   number
  kb_edges?:      GraphEdge[]
  live_edges?:    GraphEdge[]
  total_evidence?: number
  entities_matched?: string[]
}

export interface AlertEvidence {
  asset?:    string
  actor?:    string
  zone?:     string
  target?:   string
  context:   string
  date:      string
  impact:    string
}

export interface Alert {
  pattern:      string
  threat_level: 'HIGH' | 'MEDIUM' | 'LOW'
  domain:       string
  description:  string
  nodes:        string[]
  evidence:     AlertEvidence[]
  watch_for:    string
}

export interface AlertsResponse {
  total_alerts: number
  alerts:       Alert[]
}

export interface WhatIfResponse {
  removed_node:      string
  affected_edges:    GraphEdge[]
  total_edges_lost:  number
  impact_score_lost: number
  isolated_nodes:    string[]
  domain_breakdown:  Record<string, number>
  summary:           string
  // game theory fields (added by backend — gracefully absent if not yet implemented)
  shapley_centrality?: number
  deterrence_index?:   number
  nash_equilibrium?:   string
  deterrence_gaps?:    string[]
}

// ── API object ────────────────────────────────────────────────────────────────

export const api = {

  /** Health check */
  health: () =>
    get<{ status: string; service: string; version: string }>('/health'),

  /** Dashboard stats — total nodes, edges, domain breakdown */
  stats: () =>
    get<StatsResponse>('/graph/stats'),

  /**
   * Full graph for D3 visualization.
   * Pass domain/impact to filter, limit/offset for pagination.
   */
  subgraph: (
    domain?:      string,
    india_impact?: string,
    limit  = 300,
    offset = 0,
  ) => {
    const params = new URLSearchParams()
    if (domain       && domain       !== 'ALL') params.set('domain',       domain)
    if (india_impact && india_impact !== 'ALL') params.set('india_impact', india_impact)
    params.set('limit',  String(limit))
    params.set('offset', String(offset))
    return get<SubgraphResponse>(`/graph/subgraph?${params}`)
  },

  /** Keyword search across nodes + edge contexts */
  search: (q: string, limit = 20) =>
    get<SearchResponse>(`/graph/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  /**
   * Timeline between two nodes — powers Time Machine slider.
   * from_date / to_date: "YYYY-MM-DD"
   */
  timeline: (
    node1:      string,
    node2:      string,
    from_date?: string,
    to_date?:   string,
  ) => {
    const params = new URLSearchParams({ node1, node2 })
    if (from_date) params.set('from_date', from_date)
    if (to_date)   params.set('to_date',   to_date)
    return get<TimelineResponse>(`/graph/timeline?${params}`)
  },

  /** Full node detail — name, QID, all edges — for Node Panel */
  node: (id: string) =>
    get<NodeDetailResponse>(`/graph/node/${encodeURIComponent(id)}`),

  /** Natural language query → LLM answer + evidence edges */
  query: (question: string) =>
  post<QueryResponse>('/query', { question }),

  /**
   * What-If simulation — remove a node, see impact.
   * Returns domain breakdown + isolated nodes + game theory scores.
   */
  whatif: (node_id: string) =>
    post<WhatIfResponse>('/whatif', { node_id }),

  /** Pattern alerts — early warning system */
  alerts: () =>
    get<AlertsResponse>('/alerts'),
}

// ── React hooks ───────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'

/** Auto-refreshing subgraph hook. Polls every 60s. */
export function useGraph(domain?: string, impact?: string) {
  const [data,    setData]    = useState<SubgraphResponse>({ nodes: [], links: [], total_nodes: 0, total_edges: 0, returned: 0, offset: 0, has_more: false })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      api.subgraph(domain, impact)
        .then(d  => { if (!cancelled) { setData(d); setLoading(false); setError(null) } })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [domain, impact])

  return { data, loading, error }
}

/** Auto-refreshing stats hook. Polls every 60s. */
export function useStats() {
  const [data,    setData]    = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      api.stats()
        .then(d  => { if (!cancelled) { setData(d); setLoading(false); setError(null) } })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { data, loading, error }
}

/** One-shot What-If hook. Call simulate(nodeId) to run. */
export function useWhatIf() {
  const [result,     setResult]     = useState<WhatIfResponse | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const simulate = (node_id: string) => {
    setLoading(true)
    setError(null)
    api.whatif(node_id)
      .then(d  => { setResult(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  const reset = () => { setResult(null); setError(null) }

  return { result, loading, error, simulate, reset }
}