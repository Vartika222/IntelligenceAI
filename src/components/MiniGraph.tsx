import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { NODE_COLORS } from '../data/mockdata'

const ONTO_COLOR: Record<string, string> = {
  adversary:         '#FF3131',
  buffer_state:      '#00B4FF',
  chokepoint:        '#FF3131',
  string_of_pearls:  '#FFB800',
  dependency_vector: '#CC44FF',
  allied_nation:     '#c8f025',
  border_flux_zone:  '#FF8C00',
  military_actor:    '#888780',
  neutral:           '#c8f025',
}

// Known connections between strategic entities for the mini graph
const KNOWN_EDGES: [string, string][] = [
  ['China', 'Hambantota Port'],
  ['China', 'Gwadar Port'],
  ['China', 'CPEC'],
  ['China', 'Belt and Road Initiative'],
  ['China', 'Pakistan'],
  ['China', 'Myanmar'],
  ['China', 'Nepal'],
  ['China', 'Maldives'],
  ['China', 'Bangladesh'],
  ['Pakistan', 'Gwadar Port'],
  ['Pakistan', 'CPEC'],
  ['India', 'Quad'],
  ['India', 'Brahmaputra River'],
  ['India', 'Line of Actual Control'],
  ['Hambantota Port', 'Sri Lanka'],
  ['Belt and Road Initiative', 'Sri Lanka'],
  ['Belt and Road Initiative', 'Nepal'],
  ['Belt and Road Initiative', 'Maldives'],
]

interface MiniGraphProps {
  highlightNodeIds: string[]
  height?: number
}

export default function MiniGraph({ highlightNodeIds, height = 180 }: MiniGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || highlightNodeIds.length === 0) return

    const W = svgRef.current.clientWidth || 300
    const H = height

    // Build node set from highlight IDs + connected neighbors
    const nodeIds = new Set(highlightNodeIds)
    const edgeData: { source: string; target: string }[] = []

    KNOWN_EDGES.forEach(([a, b]) => {
      if (nodeIds.has(a) || nodeIds.has(b)) {
        nodeIds.add(a)
        nodeIds.add(b)
        edgeData.push({ source: a, target: b })
      }
    })

    // If no known edges, just show the highlight nodes in a circle
    const nodeArr = Array.from(nodeIds).slice(0, 12).map(id => ({
      id,
      highlighted: highlightNodeIds.includes(id),
    }))

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const sim = d3.forceSimulation(nodeArr as any)
      .force('link', d3.forceLink(edgeData).id((d: any) => d.id).distance(50).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(18))

    const links = svg.append('g').selectAll('line').data(edgeData).join('line')
      .attr('stroke', 'rgba(200,240,37,0.25)')
      .attr('stroke-width', 1)

    const nodeGs = svg.append('g').selectAll('g').data(nodeArr).join('g')

    nodeGs.append('circle')
      .attr('r', (d: any) => d.highlighted ? 9 : 5)
      .attr('fill', (d: any) => d.highlighted ? 'rgba(200,240,37,0.2)' : 'rgba(255,255,255,0.05)')
      .attr('stroke', (d: any) => d.highlighted ? '#c8f025' : 'rgba(255,255,255,0.2)')
      .attr('stroke-width', (d: any) => d.highlighted ? 1.5 : 0.5)

    nodeGs.append('text')
      .attr('dy', (d: any) => d.highlighted ? 18 : 13)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '7px')
      .attr('fill', (d: any) => d.highlighted ? 'rgba(200,240,37,0.8)' : 'rgba(255,255,255,0.3)')
      .text((d: any) => {
        const n = String(d.id)
        return n.length > 12 ? n.slice(0, 12) + '…' : n
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
  }, [highlightNodeIds, height])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      style={{ display: 'block', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(200,240,37,0.08)' }}
    />
  )
}
