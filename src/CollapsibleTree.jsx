import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';

// Main application component
export default function CollapsibleTree({ data }) {
    // Refs for the SVG container and the D3 data ID counter
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const iRef = useRef(0); // Counter for node IDs
    const [treeData, setTreeData] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // D3 Configuration constants
    const nodeRadius = 8;
    const nodeDepthSpacing = 200;
    const duration = 750;
    const horizontalMargin = 60; // Increased horizontal margin
    const verticalMargin = 40;   // Increased vertical margin

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setDimensions({
                    width: clientWidth,
                    height: clientHeight
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Calculate inner dimensions for the D3 layout
    const innerWidth = dimensions.width - horizontalMargin * 2;
    const innerHeight = dimensions.height - verticalMargin * 2;

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
        if (!data) return;

        const root = d3.hierarchy(data);
        root.x0 = innerHeight / 2;
        root.y0 = 0;

        // Collapse all children of the root to start
        if (root.children) {
            root.children.forEach(collapse);
        }

        setTreeData(root);
    }, [collapse, innerHeight, data]);

    // D3 Visualization Logic
    useEffect(() => {
        if (!treeData || dimensions.width === 0 || dimensions.height === 0) return;

        const root = treeData;
        const svg = d3.select(svgRef.current);
        
        // Clear existing content
        svg.selectAll("*").remove();

        // Create main visualization group with margins
        const vis = svg.append("g")
            .attr("transform", `translate(${horizontalMargin},${verticalMargin})`);
        
        // Create the D3 tree layout
        const treeLayout = d3.tree()
            .size([innerHeight, innerWidth]);

        // The D3 path generator for the links
        const linkPathGenerator = d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x);

        // Function to handle node click and navigation
        const handleClick = (d) => {
            if (d.data.url) {
                window.open(d.data.url, '_blank');
            }
        };

        // Main update function
        const update = (source) => {
            // Get node and link data from the hierarchy
            const nodes = treeLayout(root).descendants();
            const links = root.links();

            // Normalize for fixed-depth spacing
            nodes.forEach(d => { 
                d.y = d.depth * nodeDepthSpacing; 
                // Ensure nodes don't go beyond boundaries
                d.x = Math.max(nodeRadius, Math.min(innerHeight - nodeRadius, d.x));
                d.y = Math.max(nodeRadius, Math.min(innerWidth - nodeRadius, d.y));
            });
            
            // --- Nodes Logic ---
            const node = vis.selectAll('g.node')
                .data(nodes, d => d.id || (d.id = ++iRef.current));

            // Enter any new nodes at the parent's previous position
            const nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('transform', d => `translate(${source.y0},${source.x0})`)
                .on('click', (event, d) => {
                    event.stopPropagation();
                    toggle(d); 
                    update(d);     
                    handleClick(d);
                })
                .style('cursor', 'pointer');

            // Add circle to each node with better styling
            nodeEnter.append('circle')
                .attr('r', 1e-6)
                .style('fill', d => d._children ? 'lightsteelblue' : '#fff')
                .style('stroke', 'steelblue')
                .style('stroke-width', '2px');

            // Add text to each node with better positioning
            nodeEnter.append('text')
                .attr('x', d => d.children || d._children ? -12 : 12)
                .attr('dy', '.35em')
                .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
                .text(d => d.data.name)
                .style('fill', '#fff')
                .style('font-size', '12px')
                .style('font-weight', 'normal')
                .style('fill-opacity', 1e-6)
                .style('pointer-events', 'none')
                .call(wrapText, 120); // Wrap text to prevent overflow

            // Tooltip
            nodeEnter.append('title')
                .text(d => d.data.description || d.data.name);

            // Transition nodes to their new position
            const nodeUpdate = node.merge(nodeEnter).transition()
                .duration(duration)
                .attr('transform', d => `translate(${d.y},${d.x})`);

            nodeUpdate.select('circle')
                .attr('r', nodeRadius)
                .style('fill', d => d._children ? 'lightsteelblue' : '#fff');

            nodeUpdate.select('text')
                .style('fill-opacity', 1);

            // Transition exiting nodes
            const nodeExit = node.exit().transition()
                .duration(duration)
                .attr('transform', d => `translate(${source.y},${source.x})`)
                .remove();

            nodeExit.select('circle').attr('r', 1e-6);
            nodeExit.select('text').style('fill-opacity', 1e-6);

            // --- Links Logic ---
            const link = vis.selectAll('path.link')
                .data(links, d => d.target.id);

            // Enter any new links
            link.enter().insert('path', 'g')
                .attr('class', 'link')
                .attr('d', d => {
                    const o = { x: source.x0, y: source.y0 };
                    return linkPathGenerator({ source: o, target: o });
                })
                .style('fill', 'none')
                .style('stroke', '#ccc')
                .style('stroke-width', '1.5px')
                .transition()
                .duration(duration)
                .attr('d', d => linkPathGenerator(d));

            // Update existing links
            link.transition()
                .duration(duration)
                .attr('d', d => linkPathGenerator(d));

            // Remove exiting links
            link.exit().transition()
                .duration(duration)
                .attr('d', d => {
                    const o = { x: source.x, y: source.y };
                    return linkPathGenerator({ source: o, target: o });
                })
                .remove();

            // Store old positions for transitions
            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });

            // Auto-scroll to ensure clicked node is visible
            if (source !== root) {
                const container = containerRef.current;
                if (container) {
                    const nodeX = source.x + verticalMargin;
                    const nodeY = source.y + horizontalMargin;
                    
                    // Calculate scroll positions
                    const scrollX = nodeY - dimensions.width / 2;
                    const scrollY = nodeX - dimensions.height / 2;
                    
                    // Smooth scroll to center the node
                    container.scrollTo({
                        left: Math.max(0, scrollX),
                        top: Math.max(0, scrollY),
                        behavior: 'smooth'
                    });
                }
            }
        };

        // Text wrapping function to prevent text overflow
        function wrapText(selection, width) {
            selection.each(function() {
                const text = d3.select(this);
                const words = text.text().split(/\s+/).reverse();
                let word;
                let line = [];
                let lineNumber = 0;
                const lineHeight = 1.1;
                const y = text.attr("y");
                const dy = parseFloat(text.attr("dy"));
                let tspan = text.text(null)
                    .append("tspan")
                    .attr("x", text.attr("x"))
                    .attr("y", y)
                    .attr("dy", dy + "em");
                
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan")
                            .attr("x", text.attr("x"))
                            .attr("y", y)
                            .attr("dy", ++lineNumber * lineHeight + dy + "em")
                            .text(word);
                    }
                }
            });
        }

        // Initial rendering
        update(root);

    }, [treeData, dimensions, innerWidth, innerHeight, duration, nodeDepthSpacing, collapse, toggle, horizontalMargin, verticalMargin, nodeRadius]);
    
    return (
        <div 
            ref={containerRef}
            style={{ 
                width: '100%', 
                height: '100%', 
                position: 'relative',
                overflow: 'auto',
                background: '#1a1a1a'
            }}
        >
            <svg
                ref={svgRef}
                style={{ 
                    minWidth: '100%', 
                    minHeight: '100%',
                    background: '#1a1a1a'
                }}
                width={dimensions.width}
                height={dimensions.height}
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Optional: Add a background for better visualization */}
                <rect 
                    width="100%" 
                    height="100%" 
                    fill="#1a1a1a"
                />
            </svg>
        </div>
    );
}
