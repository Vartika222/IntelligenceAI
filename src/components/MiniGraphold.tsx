import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { NODES, EDGES, NODE_COLORS } from '../data/mockdata'

interface MiniGraphProps {
  highlightNodeIds: string[]
  height?: number
}

export default function MiniGraph({ highlightNodeIds, height = 240 }: MiniGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const W = svgRef.current.clientWidth || 300
    const H = height

    const relevantIds = new Set(highlightNodeIds)
    EDGES.forEach(e => {
      if (highlightNodeIds.includes(e.source)) relevantIds.add(e.target)
      if (highlightNodeIds.includes(e.target)) relevantIds.add(e.source)
    })

    const nodeData = NODES.filter(n => relevantIds.has(n.id)).map(n => ({ ...n }))
    const edgeData = EDGES
      .filter(e => relevantIds.has(e.source) && relevantIds.has(e.target))
      .map(e => ({ ...e, source: e.source as any, target: e.target as any }))

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const sim = d3.forceSimulation(nodeData as any)
      .force('link',    d3.forceLink(edgeData).id((d: any) => d.id).distance(60))
      .force('charge',  d3.forceManyBody().strength(-130))
      .force('center',  d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(16))

    const link = svg.append('g')
      .selectAll('line')
      .data(edgeData)
      .join('line')
      .attr('stroke', d => d.conflictFlag ? 'rgba(255,49,49,0.5)' : 'rgba(200,240,37,0.2)')
      .attr('stroke-width', d => d.conflictFlag ? 1.5 : 0.8)
      .attr('stroke-dasharray', d => d.conflictFlag ? '3 2' : null as any)

    const node = svg.append('g')
      .selectAll('g')
      .data(nodeData)
      .join('g')
      .style('cursor', 'pointer')

    node.append('circle')
      .attr('r', (d: any) => highlightNodeIds.includes(d.id) ? 8 : 5)
      .attr('fill', (d: any) => {
        const base = NODE_COLORS[d.type] || '#c8f025'
        return highlightNodeIds.includes(d.id) ? base : base + '33'
      })
      .attr('stroke', (d: any) => NODE_COLORS[d.type] || '#c8f025')
      .attr('stroke-width', (d: any) => highlightNodeIds.includes(d.id) ? 1.5 : 0.5)

    node.append('text')
      .text((d: any) => d.name)
      .attr('dy', (d: any) => (highlightNodeIds.includes(d.id) ? 8 : 5) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', (d: any) =>
        highlightNodeIds.includes(d.id)
          ? 'rgba(200,240,37,0.85)'
          : 'rgba(200,240,37,0.3)'
      )

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop() }
  }, [highlightNodeIds, height])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      style={{
        display: 'block',
        background: 'rgba(200,240,37,0.02)',
        border: '1px solid rgba(200,240,37,0.12)',
      }}
    />
  )
}
