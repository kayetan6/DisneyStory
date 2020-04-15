class Area {
  constructor(_config) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 900,
      containerHeight: _config.containerHeight || 300
    };
    this.config.margin = _config.margin || {
      top: 10,
      bottom: 45,
      right: 20,
      left: 50
    };
  }

  initVis(props) {
    let vis = this;

    let {data} = props;

    vis.data = data;

    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    vis.svg = d3.select(vis.config.parentElement)
        .attr('width', this.config.containerWidth)
        .attr('height', this.config.containerHeight);
    vis.chart = vis.svg.append("g")
      .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);
    
    const xAxisLabel = 'Year';
    const yAxisLabel = 'Annual Gross Revenue (in USD)';
    const yValue = d => d.total;
    const xValue = d => d.year;
    const yearLabels = vis.data.map(d => d.year).filter(d => d % 2 == 0);
    yearLabels.unshift(1991);
    vis.categories = ['studio' ,'consumer','interactive','parks_resorts','media'];

    // initialize and set axes
    vis.xScale = d3.scaleLinear()
      .domain(d3.extent(vis.data, xValue))
      .range([0, vis.width]);
    
    vis.yScale = d3.scaleLinear()
      .domain([0, d3.max(vis.data, yValue)])
      .range([vis.height, 0])
      .nice();
    
    vis.colour = d3.scaleOrdinal()
      .domain(vis.categories)
      .range(['#0077BB', '#EE3377', '#009988', '#EE7733', '#CC3311'])
    
    const xAxis = d3.axisBottom(vis.xScale).tickFormat(d3.format("d")).tickValues(yearLabels);

    const yAxis = d3.axisLeft(vis.yScale).ticks(4).tickFormat(d => (d == 0)? 0 : (d/1000 + 'B'));
  
    const yAxisG = vis.chart.append('g').call(yAxis);
    yAxisG.selectAll('.domain, .tick line').remove();
    yAxisG.append('text')
      .attr('fill', 'black')
      .attr('class', 'axis-label')
      .attr('y', -40)
      .attr('x', -(vis.height / 3) + 10)
      .attr('transform', 'rotate(-90)')
      .text(yAxisLabel);
  
    const xAxisG = vis.chart.append('g').call(xAxis).attr("transform", `translate(0,${vis.height})`);
    xAxisG.append('text')
      .attr('class', 'axis-label')
      .attr('fill', 'black')
      .attr('x', vis.width)
      .attr('y', 40)
      .text(xAxisLabel);

    const guidelines = vis.chart.selectAll('.guidelines')
      .data([0, 20000, 40000, 60000]);
    
    guidelines.enter().append('line')
      .attr('class', 'guidelines')
      .attr('x1', 0)
      .attr('x2', vis.width)
      .attr('y1', d => vis.yScale(d))
      .attr('y2', d => vis.yScale(d))
      .attr('stroke', 'grey')
      .attr('stroke-width', 1)
      .attr('opacity', 0.5);
    
    vis.tooltip = document.getElementById('area-tooltip');
    vis.tooltipSelection = d3.select('#area-tooltip')
      .style('position', 'absolute')
      .style('opacity', 0);

    vis.update();
  }

  update() {
    let vis = this;
    vis.stackedData = d3.stack()
      .keys(vis.categories)(vis.data)

    vis.render();
  }

  render() {
    let vis = this;

    let area = d3.area()
      .x((d,i) => vis.xScale(d.data.year))
      .y0(d => vis.yScale(d[0]))
      .y1(d => vis.yScale(d[1]));

    vis.chart.selectAll('.layers')
      .data(vis.stackedData)
      .enter()
      .append('path')
      .attr('class', d => `layers ${d.key}`)
      .style('fill', d => vis.colour(d.key))
      .attr('d', area);
    
    vis.renderMarkers();
    vis.renderLegend();
  }

  renderMarkers() {
    let vis = this;
    let flatStack = vis.stackedData.flatMap(arr => {
      let res = arr.map(d => {
        return {
          key: arr.key,
          y: d[1],
          value: d.data[arr.key],
          year: d.data.year
      }})
      return res
    });

    let nestedStack = d3.nest()
      .key(d => d.year)
      .entries(flatStack);

    let mouseLine = vis.chart.append('g').attr('class', 'mouseover-tooltip');

    mouseLine.append('line')
      .attr('class', 'mouseline')
      .style('stroke', '#A9A9A9')
      .style('stroke-width', 2)
      .style('opacity', 1);
    
    let mousePerLine = mouseLine.selectAll('.mousePerLine')
      .data(nestedStack)
      .enter()
      .append('g')
      .attr('class', d => `mousePerLine year${d.key}`);
    
    mousePerLine.selectAll('.points')
      .data((d, i) => d.values)
        .enter()
        .append('circle')
        .attr('class', d => `points year${d.year}`)
        .attr('fill',  d => vis.colour(d.key))
        .attr('stroke', 'black')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.4)
        .attr('cy', d => vis.yScale(d.y))
        .attr('cx', d => vis.xScale(d.year))
        .attr('r', 4)
        .style('opacity', 0);
    
    mouseLine.append('rect')
      .attr('width', vis.width)
      .attr('height', vis.height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseout', function() {return vis.hideRevenueTooltip(vis)})
      .on('mousemove', function() {
        return vis.showRevenueToolTips(vis, d3.mouse(this))})
  }

  renderLegend() {
    let vis = this;
    let size = 10;
    let legend = vis.chart.append('g').attr('class', 'area-legend');
    legend.selectAll('myrect')
      .data(vis.categories.reverse())
      .enter()
      .append('rect')
      .attr('x', 25)
      .attr('y', (d, i) => 10 + i * (size + 8))
      .attr("width", size)
      .attr("height", size)
      .style("fill", d => vis.colour(d))
      .on("mouseover", vis.highlight)
      .on("mouseleave", vis.noHighlight);

    legend.selectAll('mylabels')
      .data(vis.categories)
      .enter()
      .append('text')
      .attr('x', 30 + size * 1.2)
      .attr('y', (d, i) => 10 + i * (size + 9) + (size / 2))
      .style('fill', d => vis.colour(d))
      .style('font-size', 11)
      .text(d => vis.label(d))
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")
      .on("mouseover", vis.highlight)
      .on("mouseleave", vis.noHighlight);
  }

  highlight(d) {
    d3.selectAll('.layers').style('opacity', 0.1)
    d3.select('.'+d).style('opacity', 1)
  }

  noHighlight(d) {
    d3.selectAll('.layers').style('opacity', 1)
  }

  hideRevenueTooltip(vis) {
    d3.select('.mouseline')
      .style('opacity', 0);
    d3.selectAll('.mousePerLine circle')
      .style('opacity', 0);
    vis.tooltipSelection.style('opacity', 0);
  }

  showRevenueToolTips(vis, mouse) {
    let year = Math.floor(vis.xScale.invert(mouse[0]) +0.2);
    d3.selectAll('.points')
      .style('opacity', 0);
    d3.selectAll(`.year${year}`)
      .style('opacity', 1)
    
    d3.select('.mouseline')
      .style('opacity', 1)
      .attr('x1', vis.xScale(year))
      .attr('x2', vis.xScale(year))
      .attr('y1', 0)
      .attr('y2', vis.height)
    
    vis.updateToolTipContent(year, vis);
  }

  updateToolTipContent(year, vis) {
    let obj = vis.data.find(d => d.year == year);
    let revenueContainer = document.createElement('div');

    vis.formatToolTipData({vis, year, obj, div: revenueContainer});
    if (vis.tooltip.children.length !== 0) {
      vis.tooltip.replaceChild(revenueContainer, vis.tooltip.childNodes[0]);
    } else {
      vis.tooltip.appendChild(revenueContainer);
    }

    let xpos = year > 2012 ? d3.event.pageX - 250: d3.event.pageX + 5;
    vis.tooltipSelection
      .style('opacity', 1)
      .style("top", (d3.event.pageY + 15)+"px")
      .style("left",(xpos)+"px")
  }

  formatToolTipData(props) {
    let {vis, year, obj, div} = props;

    // Year
    let yearElem = document.createElement('h4');
    yearElem.className = "year";
    let yearNode = document.createTextNode(year);
    yearElem.appendChild(yearNode);

    // Media
    let mediaElem = document.createElement('p');
    mediaElem.className = "area-media";
    mediaElem.style.color = vis.colour('media');
    let media = document.createTextNode(`Media Networks: ${vis.formatRevenue(obj.media)}`);
    mediaElem.appendChild(media);

    // Parks & Resorts
    let parksElem = document.createElement('p');
    parksElem.className = "area-parks";
    parksElem.style.color = vis.colour('parks_resorts');
    let parks = document.createTextNode(`Parks & Resorts: ${vis.formatRevenue(obj.parks_resorts)}`);
    parksElem.appendChild(parks);

    // Interactive Media
    let interactiveElem = document.createElement('p');
    interactiveElem.className = "area-interactive";
    interactiveElem.style.color = vis.colour('interactive');
    let interactive = document.createTextNode(`Interactive Media: ${vis.formatRevenue(obj.interactive)}`);
    interactiveElem.appendChild(interactive);

    // Consumer Products
    let consumerElem = document.createElement('p');
    consumerElem.className = "area-consumer";
    consumerElem.style.color = vis.colour('consumer');
    let consumer = document.createTextNode(`Consumer Products: ${vis.formatRevenue(obj.consumer)}`);
    consumerElem.appendChild(consumer);

    // Studio Entertainment
    let studioElem = document.createElement('p');
    studioElem.className = "area-studio";
    studioElem.style.color = vis.colour('studio');
    let studio = document.createTextNode(`Studio Entertainment: ${vis.formatRevenue(obj.studio)}`);
    studioElem.appendChild(studio);

    div.appendChild(yearElem);
    div.appendChild(mediaElem);
    div.appendChild(parksElem);
    div.appendChild(interactiveElem);
    div.appendChild(consumerElem);
    div.appendChild(studioElem);
  }

  formatRevenue(val) {
    return val == 0? `$ ${val}` : (val > 1000)? `$ ${(val/1000).toFixed(2)}B` : `$ ${val}M`;
  }

  label(d) {
    switch(d) {
      case 'studio':
        return 'Studio Entertainment';
      case 'consumer':
        return 'Disney Consumer Products';
      case 'interactive':
        return 'Disney Interactive Media';
      case 'parks_resorts':
        return 'Parks & Resorts';
      case 'media':
        return 'Disney Media Networks';
      default:
        return d;
    }
  }
}
