class Dotplot {
    constructor(_config) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 900,
            containerHeight: _config.containerHeight || 175,
        };
        this.config.margin = _config.margin || { top: 0, right: 10, bottom: 100, left: 10 };
    }

    initVis(movies, moviesCount, columns, labels, tooltipDivId) {
        this.setWidthHeight();
        this.movies = movies;
        this.moviesCount = moviesCount;
        this.columns = columns;
        this.labels = labels;
        this.tooltip_div_id = tooltipDivId;
        this.setColours();
        this.setMarksClassname();
        this.setValues();
        this.setScales();
        this.setAxes();
        this.setTooltip();
        this.svg = d3.select(this.config.parentElement)
            .style("height", `${this.config.containerHeight}px`)
            .style("width", `${this.config.containerWidth}px`);
        this.chart = this.svg.append("g").attr("transform", `translate(${this.config.margin.left},${this.config.margin.top})`);
        this.markGapYears();
        this.initBrushSelection();
    }

    setMarksClassname() {
        this.markClassName = "movie";
    }

    initBrushSelection() {
        this.brush = this.chart.append('g')
            .attr('class', 'brush')
            .call(d3.brushX()
                .extent([[0, 0], [this.width, this.height]])
                .on('end', () => { this.brushEnd() }));
    }

    brushEnd() {
        const maxBound = 99; // spans max of 6 years
        if (!d3.event.sourceEvent) return;
        if (!d3.event.selection) return;

        let upperBound = d3.event.selection[0];
        let lowerBound = Math.min(d3.event.selection[1], upperBound + maxBound);
        let upperYear = this.scale_x.invert(upperBound);

        // need to take into account the padding so additional computations are made
        let domain = this.scale_x.domain();
        let lowerBoundIndex = domain.findIndex(val => val === this.scale_x.invert(lowerBound));
        let lowerYear = domain[lowerBoundIndex - 1] ? domain[lowerBoundIndex - 1] : 2016;

        setYearSelection({ start: upperYear, end: lowerYear });

        // adjust selection to the years
        let adjustedUpperBound = this.scale_x(upperYear) - this.scale_x.step()/2;
        let adjustedLowerBound = this.scale_x(lowerYear) + this.scale_x.step()/2;

        d3.select('.brush').transition().call(d3.event.target.move, [adjustedUpperBound, adjustedLowerBound]);
    }

    clearBrush() {
        d3.select('.brush').call(d3.brushX().move, null);
    }

    markGapYears() {
        this.chart.selectAll('.gap-years')
            .data([1929, 1937, 1943, 1951, 1953, 1955, 1959, 1961, 1963, 1967, 1970, 1973, 1977, 1981, 1986, 1992])
            .enter().append('line')
            .attr('class', 'gap-years')
            .attr('x1', d => this.scale_x(d) + (this.scale_x.step() / 2))
            .attr('x2', d => this.scale_x(d) + (this.scale_x.step() / 2))
            .attr('y1', this.height)
            .attr('y2', 0)
            .attr('stroke', '#786d4c')
            .attr('stroke-width', 1)
            .attr('opacity', 0.2);
    }

    setColours() {
        this.colour_normal = "#000000";
        this.colour_hover = "#f2bf33";
        this.colour_select = "#dea814";
    }

    setWidthHeight() {
        this.width = this.config.containerWidth - this.config.margin.left - this.config.margin.right;
        this.height = this.config.containerHeight - this.config.margin.top - this.config.margin.bottom;
    }

    setValues() {
        // Methods to set values 
        this.value_x = d => d[`${this.columns.x}`];
        this.value_y = d => d[`${this.columns.y}`];
        this.value_size = d => d[`${this.columns.size}`];
        this.value_colour_era = d => d[`${this.columns.era}`];
    }

    setScales() {
        this.setScaleX();
        this.setScaleY();
        this.setScaleSize();
        this.setScaleColourEra();
    }

    setScaleX() {
        const domain_x = this.movies.map(this.value_x);
        const range_x = [0, this.width];
        this.scale_x = this.getScaleBand(domain_x, range_x, 0, 1);
        this.scale_x.invert = (value) => {
            let step = this.scale_x.step();
            let index = Math.floor((value / step));
            let domain = this.scale_x.domain();
            return domain[index];
        }
    }

    setScaleY() {
        const domain_y = this.movies.map(this.value_y);
        const range_y = [this.height, 0];
        this.scale_y = this.getScaleBand(domain_y, range_y, 1, 1);
    }

    setScaleSize() {
        const domain_size = d3.extent(this.movies, this.value_size);
        const range_size = [1, 8];
        this.scale_size = this.getScaleSqrt(domain_size, range_size);
    }

    setScaleColourEra() {
        const domain_colour = DataProcessor.movieEras;
        const range_colour = DataProcessor.movieColourEras;
        this.scale_colour_era = this.getScaleOrdinal(domain_colour, range_colour);
    }

    getScaleSqrt(domain, range) {
        return d3.scaleSqrt()
            .domain(domain)
            .range(range);
    }

    getScaleBand(domain, range, paddingInner = 0, paddingOuter = 0) {
        return d3.scaleBand()
            .domain(domain)
            .range(range)
            .paddingInner(paddingInner)
            .paddingOuter(paddingOuter);
    }

    getScaleOrdinal(domain, range) {
        return d3.scaleOrdinal()
            .domain(domain)
            .range(range);
    }

    setAxes() {
        this.setAxisX();
        this.setAxisY();
    }

    setAxisX() {
        this.axis_x = this.getAxisBottom(this.scale_x);
    }

    setAxisY() {
        this.axis_y = this.getAxisLeft(this.scale_y);
    }

    getAxisBottom(scale) {
        return d3.axisBottom(scale)
            .tickSizeOuter(0)
        // .tickSize(-this.height)
    }

    getAxisLeft(scale) {
        return d3.axisLeft(scale)
            .tickPadding(2)
            .tickSize(-this.width)
            .tickSizeOuter(0);
    }

    renderData() {
        this.renderCircles(this.markClassName);
    }

    render() {
        // this.renderAxisY(this.axis_y);
        this.renderAxisX(this.axis_x);
        this.renderAxisEra(90);
        this.tiltTickAxisX(-45, "-0.8em", "-0.15em");
        this.renderData();
    }

    renderCircles(className) {
        const circles = this.chart.selectAll(`.${className}`).data(this.movies);
        circles
            .enter().append("circle")
            .attr("class", className)
            .attr("opacity", 0.7)
            .attr("r", d => this.scale_size(this.value_size(d)))
            .attr("cx", d => this.scale_x(this.value_x(d)))
            .attr("cy", d => this.scale_y(this.value_y(d)))
            .merge(circles)
            .attr('stroke', 'black')
            .attr('stroke-width', 0.5)
            .attr("fill", d => this.scale_colour_era(this.value_colour_era(d)))
            .on("mouseover", d => {
                setHoveredNode(d.movie_title, "movie", d.disney_era);
                this.showTooltip(d)
            })
            .on("mouseout", () => {
                resetHoveredNode();
                this.hideTooltip()
            })
            .on("click", d => {
                nodeSelectionHandler(d.movie_title, d.disney_era)
            })
            .transition().duration(1000)
            .attr("r", d => this.scale_size(this.value_size(d)))
            .attr("cy", d => this.scale_y(this.value_y(d)))
            .attr("cx", d => this.scale_x(this.value_x(d)));
        circles.exit().remove();
    }

    tiltTickAxisX(rotation = -45, dx = "-0.8em", dy = "-0.15em") {
        this.axis_x_g.selectAll("text:not(.x-axis-label)")
            .attr("fill", d => this.scale_colour_era(DataProcessor.getDisneyEra(d)))
            .style("font-size", 10)
            .style("text-anchor", "end")
            .attr("dx", `${dx}`)
            .attr("dy", `${dy}`)
            .attr("transform", `rotate(${rotation})`);
    }

    renderAxisX(x_axis) {
        this.axis_x_g = this.chart.append("g").call(x_axis)
            .attr("transform", `translate(0,${this.height})`);

        this.axis_x_g.append("text")
            .attr("fill", "black")
            .attr("class", "x-axis-label")
            .attr("y", -3)
            .attr("x", this.width - 13)
            .text(this.labels.x)
            .style("font-size", 12)
            .style("font-weight", "bold");
    }

    renderAxisEra(rotation = 90) {
        this.axis_era_g = this.chart.append("g")
            .attr("class", "era-axis-group")
            .attr("transform", `translate(0,${this.height + 30})`); // adjust y so that the group-labels are below labels

        const era = this.axis_era_g.selectAll(".era-axis-group").data(this.moviesCount);
        era.enter().append("text")
            .attr("fill", d => this.scale_colour_era(this.value_colour_era(d)))
            .attr("class", "era-axis-elements")
            .attr("y", 0)
            .attr("x", (d, i) => (this.scale_x.bandwidth() * d.cumsum) - (this.scale_x.bandwidth() * d.count / 2))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-size", 10)
            .style("font-weight", "bold")
            .style('pointer-events', 'auto')
            .on('click', d => updateNodeGraphByEraLabel(d.disney_era))
            .text(d => this.value_colour_era(d).includes("Pre-Golden") ? "Pre- Golden Age" : this.value_colour_era(d))
            .call(DataProcessor.wrapText, 5);
        era.exit().remove();

        this.axis_era_g.append("text")
            .attr("fill", "black")
            .attr("class", "era-axis-label")
            .text(this.labels.era)
            .style("font-size", 13)
            .style("font-weight", "bold")
            .attr("transform", `translate(${this.width - 15}, -25), rotate(${rotation})`);
    }

    // Tool tip
    setTooltip() {
        this.tooltip = d3.select(this.tooltip_div_id).attr("class", "movie-tooltip").style("visibility", "hidden");
    }

    showTooltip(row) {
        this.tooltip
            .style("visibility", "visible")
            .style("left", () => this.getXposition())
            .style("top", () => this.getYposition());
        this.createTooltipData(row);
    }

    hideTooltip() {
        this.tooltip.style("visibility", "hidden");
        this.removeTooltipData();
    }

    createTooltipData(row) {
        this.tooltip_data = this.tooltip.append("div").attr("class", "tooltip-data");
        const movie_title = `${row["movie_title"]}`;
        const movie_rating = `Rating: ${row["rating"]}`;
        const movie_gross_revenue = `Gross Revenue: $${this.formatThousandCommas(row["box_office"])}`;
        this.tooltip_data.append("h4").attr("class", "movie-title").text(movie_title);
        this.tooltip_data.append("p").text(movie_rating);
        this.tooltip_data.append("p").text(movie_gross_revenue);
    }

    removeTooltipData() {
        this.tooltip_data.remove();
    }

    getXposition() {
        if (d3.event.pageX < 850) {
            return (d3.event.pageX - 50) + "px";
        } else {
            return (d3.event.pageX - 200) + "px";
        }
    }

    getYposition() {
        if (d3.event.pageY > 300) {
            return (d3.event.pageY - 120) + "px";
        } else {
            return (d3.event.pageY + 50) + "px";
        }
    }

    formatThousandCommas(number) {
        return d3.format(',.2f')(number);
    }

    selectMovie(name) {
        d3.selectAll(`circle.${this.markClassName}`).transition().attr('opacity', 0.3);
        d3.selectAll(`circle.${this.markClassName}`).filter(d => {
            return d.movie_title == name
        }).transition()
            .attr('opacity', 0.9)
            .attr('stroke-opacity', 1)
            .attr('stroke', 'black')
            .attr('stroke-width', 1.5)
    }

    deselectMovie() {
        d3.selectAll(`circle.${this.markClassName}`).transition()
            .attr('opacity', 0.7)
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 1)
    }
}
