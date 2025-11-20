
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink, NodeType } from '../types';

interface D3GraphProps {
  data: { nodes: GraphNode[]; links: GraphLink[] };
  onNodeSelect: (node: GraphNode | null) => void;
  repulsion: number;
  selectedNodeId?: string;
}

export const D3Graph: React.FC<D3GraphProps> = ({ data, onNodeSelect, repulsion, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDims = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateDims);
    updateDims();
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  useEffect(() => {
    if (!data.nodes.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;

    // Color scale based on node type
    const color = (d: GraphNode) => {
        switch (d.type) {
            case NodeType.FILE: return '#3b82f6'; // blue
            case NodeType.CLASS: return '#eab308'; // yellow
            case NodeType.FUNCTION: return '#ec4899'; // pink
            case NodeType.MODULE: return '#a855f7'; // purple
            default: return '#94a3b8';
        }
    };

    const radius = (d: GraphNode) => {
        switch (d.type) {
            case NodeType.FILE: return 12;
            case NodeType.CLASS: return 10;
            case NodeType.FUNCTION: return 6;
            default: return 8;
        }
    };

    // Create simulation with adjusted forces
    const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(40))
      .force("charge", d3.forceManyBody().strength(-repulsion)) // Dynamic repulsion
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05)) 
      .force("x", d3.forceX(width / 2).strength(0.08)) 
      .force("y", d3.forceY(height / 2).strength(0.08)) 
      .force("collide", d3.forceCollide().radius((d: any) => radius(d) + 4).iterations(2))
      .velocityDecay(0.4); 

    // Add zoom capabilities
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    svg.call(zoom);

    // Arrow marker
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", String)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#64748b");

    // Links
    const link = g.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#end)");

    // Nodes
    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", (d: any) => radius(d) + (d.id === selectedNodeId ? 4 : 0)) // Make bigger if selected
      .attr("fill", (d: any) => color(d))
      .attr("stroke", (d: any) => d.id === selectedNodeId ? "#6366f1" : "#fff") // Highlight selected
      .attr("stroke-width", (d: any) => d.id === selectedNodeId ? 3 : 1.5)
      .attr("cursor", "pointer")
      // @ts-ignore
      .call(drag(simulation));

    node.on("click", (event, d) => {
        onNodeSelect(d as unknown as GraphNode);
        event.stopPropagation();
    });

    // Labels
    const text = g.append("g")
        .selectAll("text")
        .data(data.nodes)
        .join("text")
        .text((d: any) => d.label)
        .attr("x", 15)
        .attr("y", 4)
        .attr("fill", "#cbd5e1")
        .style("font-size", "10px")
        .style("font-family", "sans-serif")
        .style("pointer-events", "none");


    // Ticker
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      text
        .attr("x", (d: any) => d.x + 15)
        .attr("y", (d: any) => d.y + 4);
    });

    // Cleanup
    return () => {
        simulation.stop();
    };

  }, [data, dimensions, onNodeSelect, repulsion, selectedNodeId]);

  // Drag logic
  const drag = (simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div ref={wrapperRef} className="w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-inner shadow-black/50">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
};
