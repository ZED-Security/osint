import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';

// Main application component
export default function CollapsibleTree({ data }) {
    // Refs for the SVG container and the D3 data ID counter
    const svgRef = useRef(null);
    const iRef = useRef(0); // Counter for node IDs
    const [treeData, setTreeData] = useState(null);

    // D3 Configuration constants
    const margin = { top: 20, right: 120, bottom: 20, left: 140 };
    const nodeRadius = 6;
    const nodeDepthSpacing = 180;
    const duration = 750;

    // Use a responsive viewBox for a fluid layout
    const viewBoxHeight = 800; 
    const viewBoxWidth = 1280;

    // Inner dimensions for the D3 layout
    const width = viewBoxWidth - margin.right - margin.left;
    const height = viewBoxHeight - margin.top - margin.bottom;

    // Function to collapse a node's children
    const collapse = useCallback((d) => {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }, []);

    // Function to toggle a node's children
    const toggle = useCallback((d) => {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
    }, []);
    
    // Fetch and initialize the data for D3
    useEffect(() => {
        const root = d3.hierarchy(data);
        root.x0 = height / 2;
        root.y0 = 0;

        // Collapse all children of the root to start
        if (root.children) {
            root.children.forEach(collapse);
        }

        setTreeData(root);
    }, [collapse, height, data]);

    // D3 Visualization Logic (useEffect runs whenever treeData updates)
    useEffect(() => {
        if (!treeData) return;

        const root = treeData;
        const svg = d3.select(svgRef.current);
        
        // Remove existing content before drawing
        svg.selectAll("g").remove();

        const vis = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        // Create the D3 tree layout
        const treeLayout = d3.tree()
            .size([height, width]);

        // The D3 path generator for the links
        const linkPathGenerator = d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x);

        // Main update function
        const update = (source) => {
            // Get node and link data from the hierarchy
            const nodes = treeLayout(root).descendants();
            const links = root.links();

            // Normalize for fixed-depth.
            nodes.forEach(d => { d.y = d.depth * nodeDepthSpacing; });
            
            // --- Nodes Logic ---
            const node = vis.selectAll('g.node')
                .data(nodes, d => d.id || (d.id = ++iRef.current));

            // Enter any new nodes at the parent's previous position.
            const nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('transform', d => `translate(${source.y0},${source.x0})`)
                .on('click', (event, d) => {
                    toggle(d); 
                    update(d);     
                });

            // Circle
            nodeEnter.append('circle')
                .attr('r', 1e-6)
                .style('fill', d => d._children ? 'lightsteelblue' : '#fff');

            // Text
            nodeEnter.append('text')
                .attr('x', d => d.children || d._children ? -10 : 10)
                .attr('dy', '.35em')
                .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
                .text(d => d.data.name)
                .style('fill', '#fff')
                .style('fill-opacity', 1e-6);

            // Tooltip (Title element)
            nodeEnter.append('title')
                .text(d => d.data.description);

            // Transition nodes to their new position.
            const nodeUpdate = node.merge(nodeEnter).transition()
                .duration(duration)
                .attr('transform', d => `translate(${d.y},${d.x})`);

            nodeUpdate.select('circle')
                .attr('r', nodeRadius)
                .style('fill', d => d._children ? 'lightsteelblue' : '#fff');

            nodeUpdate.select('text')
                .style('fill-opacity', 1);

            // Transition exiting nodes to the parent's new position.
            const nodeExit = node.exit().transition()
                .duration(duration)
                .attr('transform', d => `translate(${source.y},${source.x})`)
                .remove();

            nodeExit.select('circle').attr('r', 1e-6);
            nodeExit.select('text').style('fill-opacity', 1e-6);

            // --- Links Logic ---
            const link = vis.selectAll('path.link')
                .data(links, d => d.target.id);

            // Enter any new links at the parent's previous position.
            link.enter().insert('path', 'g')
                .attr('class', 'link')
                .attr('d', d => {
                    const o = { x: source.x0, y: source.y0 };
                    return linkPathGenerator({ source: o, target: o });
                })
                .transition()
                .duration(duration)
                .attr('d', d => linkPathGenerator(d));

            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .attr('d', d => linkPathGenerator(d));

            // Transition exiting links to the parent's new position.
            link.exit().transition()
                .duration(duration)
                .attr('d', d => {
                    const o = { x: source.x, y: source.y };
                    return linkPathGenerator({ source: o, target: o });
                })
                .remove();

            // Stash the old positions for transition.
            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        };

        // Initial rendering
        if (root) {
            update(root);
        }

    }, [treeData, height, width, margin.left, margin.top, duration, nodeDepthSpacing, collapse, toggle]);
    
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <svg
                ref={svgRef}
                style={{ width: '100%', height: '100%' }}
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                preserveAspectRatio="xMidYMid meet"
            >
            </svg>
        </div>
    );
}
