class NodeLink {
  constructor(_config) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 500,
      containerHeight: _config.containerHeight || 375
    };
    this.config.margin = _config.margin || {
      top: 0,
      bottom: 0,
      right: 0,
      left: 0
    };
    this.config.width = this.config.containerWidth - this.config.margin.left - this.config.margin.right;
    this.config.height = this.config.containerHeight - this.config.margin.top - this.config.margin.bottom;
    this.svg = d3.select(this.config.parentElement)
      .attr('width', this.config.containerWidth)
      .attr('height', this.config.containerHeight);

    this.tooltip = d3.select("#node-link-tooltip").style("visibility", "hidden");

    this.dateFormatter = d3.timeFormat('%B %d, %Y');
    this.amountFormatter = d3.format(',.2f');
  }

  initVis(props) {
    const vis = this;

    vis.chart = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);

    vis.dataByEra = props.dataByEra;
    vis.nodeData = props.dataByEra[props.initialEra[0]].nodes;
    vis.linkData = props.dataByEra[props.initialEra[0]].links;
    vis.neighbours = props.dataByEra[props.initialEra[0]].neighbours;

    vis.nodeScale = d3.scaleSqrt()
      .domain([5, 9])
      .range([0.08, 0.2]);

    vis.hovered = {};

    vis.chart.append('g').attr('class', 'link-group');
    vis.chart.append('g').attr('class', 'node-group');

    vis.render();
  }

  updateEra(node, link, neighbors) {
    const vis = this;
    vis.nodeData = node;
    vis.linkData = link;
    vis.neighbours = neighbors;

    vis.render();
  }

  render() {
    const vis = this;

    vis.simulation = d3.forceSimulation(vis.nodeData)
      .force('charge', d3.forceManyBody().strength(-1))
      .force('center', d3.forceCenter(vis.config.width / 2, vis.config.height / 2))
      .force('collide', d3.forceCollide().radius((d) => vis.getNodeRadius(d)).iterations(2))
      .force('x', d3.forceX(vis.config.width / 2).strength(0.015))
      .force('y', d3.forceY(vis.config.height / 2).strength(0.03))
      .force('link', d3.forceLink().id(d => d.id))
      .on('tick', () => {
        vis.nodeEnter
          .attr('x', node => vis.getNodeXPosition(node))
          .attr('y', node => vis.getNodeYPosition(node))
          .attr('transform', node => vis.adjustNodePosition(node));

        vis.linkEnter
          .attr('x1', link => link.source.x)
          .attr('y1', link => link.source.y)
          .attr('x2', link => link.target.x)
          .attr('y2', link => link.target.y);
      });

    vis.dragDrop = d3.drag()
      .on('start', node => {
        node.fx = node.x
        node.fy = node.y
      })
      .on('drag', node => {
        vis.simulation.alphaTarget(0.7).restart()
        node.fx = d3.event.x
        node.fy = d3.event.y
      })
      .on('end', node => {
        if (!d3.event.active) {
          vis.simulation.alphaTarget(0)
        }
        node.fx = null
        node.fy = null
      });

    vis.links = vis.chart.select('.link-group').selectAll('.link')
      .data(vis.linkData, d => d.source.id + " - " + d.target.id);

    vis.links.exit()
      .transition()
      .attr('stroke-opacity', 0)
      .remove();

    vis.linkEnter = vis.links.enter().append('line')
      .attr('class', 'link')
      .attr('stroke-width', 3)
      .attr('stroke', '#B5B5B5')
      .on('mouseover.tooltip', d => vis.updateLinkTooltip(d))
      .on('mouseout.tooltip', () => vis.updateLinkTooltip(null))
      .merge(vis.links);

    vis.nodes = vis.chart.select('.node-group').selectAll('path')
      .data(vis.nodeData, d => d.id);

    vis.nodes.exit().remove();
    vis.nodeEnter = vis.nodes.enter().append('path')
      .attr('class', 'node')
      .attr('d', d => vis.getPath(d.type))
      .attr('fill', d => vis.getNodeColor(d))
      .attr('stroke-width', d => vis.getNodeStrokeWidth(d.award))
      .attr('stroke', 'black')
      .call(vis.dragDrop)
      .on('mouseover.tooltip', d => {
        setHoveredNode(d.id, d.type);
        vis.updateNodeTooltip(d);
      })
      .on('mouseout.tooltip', () => {
        resetHoveredNode();
        vis.updateNodeTooltip(null);
      })
      // .on('click', d => nodeSelectionHandler(d.id))
      .merge(vis.nodes);

    vis.simulation.force('link').links(vis.linkData);
    vis.simulation.nodes(vis.nodeData);
    vis.simulation.alpha(1).restart();
  }

  updateLinkTooltip(data) {
    const vis = this;
    if (data) {
      vis.createTooltipData_Link(data);
      vis.tooltip.attr("class", "role-tooltip")
        .style("visibility", "visible")
        .style("left", () => vis.getTooltipPositionX_Link())
        .style("top", () => vis.getTooltipPositionY_Link());
    } else {
      vis.tooltip.style("visibility", "hidden");
      vis.tooltip_data.remove();
    }
  }

  createTooltipData_Link(data) {
    const vis = this;

    vis.tooltip_data = vis.tooltip.append("div").attr("class", "tooltip-data");

    const actor = data.source.id;
    const role = data.role;
    const movie = data.target.id;
    const img = data.role == 'Penny' ? `./images/characters/${data.role} ${data.target.id}.png` : `./images/characters/${data.role}.png`;
    const img_on_error = "this.src='./images/characters/default.png';";

    vis.tooltip_data.append("img").attr("class", "character-image").attr("src", img).attr("onerror", img_on_error);
    vis.tooltip_data.append("h4").text(actor);
    vis.tooltip_data.append("p").text("as");
    vis.tooltip_data.append("h4").text(role);
    vis.tooltip_data.append("p").text("in");
    vis.tooltip_data.append("h4").text(movie);
  }

  getNodeColor(node) {
    if (node.type === "movie") {
      return DataProcessor.getMovieColor(node.era);
    } else {
      return '#fcba03';
    }
  }

  getPath(type) {
    if (type === "movie") {
      // mickey path
      return "M88 41.5C88 42.9981 87.9158 44.4777 87.7517 45.9347C93.998 44.0266 100.629 43 107.5 43C114.371 43 121.002 44.0266 127.248 45.9347C127.084 44.4777 127 42.9981 127 41.5C127 18.5802 146.699 0 171 0C195.301 0 215 18.5802 215 41.5C215 64.4198 195.301 83 171 83C170.379 83 169.761 82.9879 169.146 82.9638C172.908 91.3728 175 100.692 175 110.5C175 147.779 144.779 178 107.5 178C70.2208 178 40 147.779 40 110.5C40 100.692 42.0918 91.3728 45.8536 82.9638C45.2389 82.9879 44.621 83 44 83C19.6995 83 0 64.4198 0 41.5C0 18.5802 19.6995 0 44 0C68.3005 0 88 18.5802 88 41.5Z"
    } else {
      // star path
      return "M83.2937 7.56232C85.0898 2.03445 92.9102 2.03444 94.7063 7.5623L111.227 58.4073C112.03 60.8794 114.334 62.5532 116.933 62.5532H170.395C176.207 62.5532 178.624 69.9909 173.922 73.4073L130.67 104.831C128.567 106.359 127.687 109.067 128.491 111.539L145.011 162.384C146.807 167.912 140.48 172.509 135.778 169.093L92.5267 137.669C90.4238 136.141 87.5762 136.141 85.4733 137.669L42.222 169.093C37.5197 172.509 31.1928 167.912 32.9889 162.384L49.5094 111.539C50.3127 109.067 49.4327 106.359 47.3298 104.831L4.07847 73.4073C-0.623809 69.9909 1.79283 62.5532 7.60517 62.5532H61.0668C63.6661 62.5532 65.9699 60.8795 66.7731 58.4073L83.2937 7.56232Z"
    }
  }

  getNodeStrokeWidth(award) {
    return (award === "") ? 2 : 10;
  }

  getNodeXPosition(node) {
    const vis = this;
    let nodeRadius;
    if (node.type === 'actor') {
      nodeRadius = 5;
    } else {
      nodeRadius = vis.getNodeRadius(node) / 2;
    }
    return Math.max(nodeRadius * 4, Math.min((vis.config.width - (nodeRadius * 4)), node.x));
  }

  getNodeYPosition(node) {
    const vis = this;
    let nodeRadius;
    if (node.type === 'actor') {
      nodeRadius = 5;
    } else {
      nodeRadius = vis.getNodeRadius(node) / 2;
    }
    return Math.max(nodeRadius * 4, Math.min((vis.config.height - (nodeRadius * 4)), node.y));
  }

  adjustNodePosition(node) {
    const vis = this;
    let nodeRadius = vis.getNodeRadius(node) / 2;
    let scale = node.type === 'actor' ? 0.08 : vis.nodeScale(node.rating);
    let clipX = Math.max(nodeRadius * 2, Math.min((vis.config.width - (nodeRadius * 2)), node.x));
    let clipY = Math.max(nodeRadius * 4, Math.min((vis.config.height - (nodeRadius * 4)), node.y));
    node.x = clipX;
    node.y = clipY;
    return `translate(${clipX - nodeRadius}, ${clipY - nodeRadius}), scale(${scale})`;
  }

  getNodeRadius(node) {
    const vis = this;
    if (node.type === 'movie') {
      let scale = vis.nodeScale(node.rating);
      return 215 * scale;
    } else {
      return 12;
    }
  }

  updateNodeTooltip(data) {
    const vis = this;
    if (data) {
      vis.tooltip
        .style("visibility", "visible")
        .style("left", () => vis.getTooltipPositionX_Node(data.type))
        .style("top", () => vis.getTooltipPositionY_Node(data.type));

      if (data.type === "movie") {
        vis.tooltip.attr("class", "movie-tooltip");
        vis.createTooltipDate_Movie(data);
      } else {
        vis.tooltip.attr("class", "actor-tooltip");
        vis.createTooltipData_Actor(data);
      }
    } else {
      vis.tooltip.style("visibility", "hidden");
      vis.tooltip_data.remove();
    }
  }

  createTooltipDate_Movie(data) {
    const vis = this;

    vis.tooltip_data = vis.tooltip.append("div").attr("class", "tooltip-data");

    const movie_title = data.id;
    const movie_rating = `Rating: ${data.rating}`;
    const movie_release_date = `Release Date: ${vis.dateFormatter(new Date(data.release_date))}`;
    const movie_directors = `Director(s): ${data.director}`;
    const movie_gross_revenue = `Box Office: USD ${vis.amountFormatter(data.box_office)}`;

    vis.tooltip_data.append("h4").attr("class", "movie-title").text(movie_title);
    vis.tooltip_data.append("p").text(movie_rating);
    vis.tooltip_data.append("p").text(movie_release_date);
    vis.tooltip_data.append("p").text(movie_directors);
    vis.tooltip_data.append("p").text(movie_gross_revenue);

    if (data.award !== "") {
      const awards = data.award.split(";").map(str => str.split(":")[1]).join(", ");
      const movie_award = `Awards: ${awards}`;
      vis.tooltip_data.append("p").text(movie_award);
    }
  }

  createTooltipData_Actor(data) {
    const vis = this;

    vis.tooltip_data = vis.tooltip.append("div").attr("class", "tooltip-data");

    const actor_title = data.id;
    vis.tooltip_data.append("h4").attr("class", "movie-title").text(actor_title);

    if (data.award !== "") {
      const awards = data.award.split(";");
      for (let award of awards) {
        const elems = award.split(":");
        const year = elems[0];
        const name = elems[1];
        vis.tooltip_data.append("p").text(`Year ${year}:`);
        vis.tooltip_data.append("pre").text(`Achieved: ${name}`);
        if (elems[2] !== "nan" && typeof elems[2] !== "undefined") {
          const movie = elems[2];
          vis.tooltip_data.append("pre").text(`Movie: ${movie}`);
        }
      }
    }
  }

  showOneHopNodeLink(node) {
    const vis = this;
    d3.selectAll('.link').transition().style('stroke-opacity', l => {
      return l.target.id == node || l.source.id == node ? 1 : 0.1
    });

    d3.selectAll('.node').transition().style('opacity', n => {
      if (n.id == node) return 1;
      return vis.neighbours[node + ' , ' + n.id] ? 1 : 0.1;
    })
  }

  showAllNodeLink() {
    d3.selectAll('.link').transition().style('stroke-opacity', 1);
    d3.selectAll('.node').transition().style('opacity', 1);
  }

  getTooltipPositionX_Link() {
    if (d3.event.pageX < 750) {
      return (d3.event.pageX + 30) + "px";
    } else {
      return (d3.event.pageX - 200) + "px";
    }
  }

  getTooltipPositionY_Link() {
    if (d3.event.pageY > 2200) {
      return (d3.event.pageY - 300) + "px";
    } else if (d3.event.pageY) {
      return (d3.event.pageY + 20) + "px";
    }
  }

  getTooltipPositionX_Node(type) {
    if (d3.event.pageX < 750) {
      return (type === "movie") ? (d3.event.pageX + 30) + "px" : (d3.event.pageX + 30) + "px";
    } else {
      return (type === "movie") ? (d3.event.pageX - 230) + "px" : (d3.event.pageX - 300) + "px";
    }
  }

  getTooltipPositionY_Node(type) {
    if (d3.event.pageY > 2200) {
      return (type === "movie") ? (d3.event.pageY - 150) + "px" : (d3.event.pageY - 50) + "px";
    } else if (d3.event.pageY) {
      return (type === "movie") ? (d3.event.pageY + 20) + "px" : (d3.event.pageY + 0) + "px";
    }
  }
}
