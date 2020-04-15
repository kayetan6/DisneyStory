class DataProcessor {

    static movieEras = [
        'Pre-Golden Age', 'Golden Age', 'Wartime Era', 'Silver Age', 'Dark Age',
        'Disney Renaissance', 'Post-Renaissance', 'Second Disney Renaissance'
    ];

    static movieColourEras = [
        '#FFAABB', '#BA971A', '#77AADD', '#EE8866', '#66CCEE',
        '#AA4499', '#7270CB', '#44BB99'
    ];

    static processMovieData(moviesRaw, nodes) {
        let countMap = {};
        moviesRaw.forEach(movie => {
            let releaseDate = new Date(movie["release_date"]);
            movie["release_date"] = releaseDate;

            const year = releaseDate.getFullYear();
            movie["year"] = year;

            countMap[year] = (!Object.keys(countMap).includes(year.toString())) ? 0 : countMap[year] + 1;
            movie["count"] = countMap[year];

            let disneyEra = DataProcessor.getDisneyEra(year);
            movie["disney_era"] = disneyEra;

            movie["rating"] = +movie["rating"];
            movie["box_office"] = +movie["box_office"];

            let movieObj = {
                type: "movie",
                id: movie["movie_title"],
                director: movie["director"],
                release_date: releaseDate,
                rating: +movie["rating"],
                box_office: +movie["box_office"],
                era: disneyEra,
                award: movie["Award"]
            };
            nodes.push(movieObj);
        });
    }

    static getDisneyEra(year) {
        if (year >= 1928 && year <= 1936) {
            return DataProcessor.movieEras[0];
        } else if (year >= 1937 && year <= 1942) {
            return DataProcessor.movieEras[1];
        } else if (year >= 1943 && year <= 1949) {
            return DataProcessor.movieEras[2];
        } else if (year >= 1950 && year <= 1969) {
            return DataProcessor.movieEras[3];
        } else if (year >= 1970 && year <= 1988) {
            return DataProcessor.movieEras[4];
        } else if (year >= 1989 && year <= 1999) {
            return DataProcessor.movieEras[5];
        } else if (year >= 2000 && year <= 2009) {
            return DataProcessor.movieEras[6];
        } else if (year >= 2010 && year <= 2019) {
            return DataProcessor.movieEras[7];
        }
    }

    static processVoiceActorData(actorsRaw, nodes, links) {
        actorsRaw.forEach(vActor => {
            if (nodes.find(node => node.type === 'actor' && node.id === vActor['voice-actor']) === undefined) {
                // we only want to create and add the node to the array if the actor doesn't exist yet
                let vActorNode = {
                    type: "actor",
                    id: vActor['voice-actor'],
                    award: vActor['Award']
                };
                nodes.push(vActorNode);
            }

            let link = {
                source: vActor['voice-actor'],
                target: vActor['movie'],
                role: vActor['character']
            };
            links.push(link);
        });
    }

    static groupNodeLinkByEra(nodes, links, result, era) {
        let matchingMovieNodes = nodes.filter(node => node.type === "movie" && node.era === era);
        let movies = matchingMovieNodes.map(node => node.id);
        let matchingLinks = links.filter(link => movies.includes(link.target));
        let voiceActors = matchingLinks.map(link => link.source);
        let matchingVoiceActorNodes = nodes.filter(node => node.type === "actor" && voiceActors.includes(node.id));
        let neighbours = {};
        matchingLinks.forEach((d) => {
            neighbours[d.source + " , " + d.target] = 1;
            neighbours[d.target + " , " + d.source] = 1;
        })
        result[era] = {
            nodes: matchingMovieNodes.concat(matchingVoiceActorNodes),
            links: matchingLinks,
            neighbours
        };
    }

    /**
     * Returns the nodes and links of a single movie
     * @param era
     * @param title
     * @param nodeLinkDataByEra
     *
     */
    static getMovieNodeLinkDataByMovie(era, title, nodeLinkDataByEra) {
        let eraNodeData = nodeLinkDataByEra[era].nodes;
        let eraLinkData = nodeLinkDataByEra[era].links;
        let filteredLinks = eraLinkData.filter(link => link.target === title);
        let actors = filteredLinks.map(link => link.source);
        let movieNode = eraNodeData.find(node => node.type === 'movie' && node.id === title);
        let actorNodes = eraNodeData.filter(node => node.type === 'actor' && actors.includes(node.id));
        let movieNodes = actorNodes.concat(movieNode);
        return {filteredLinks, movieNodes};
    }

    static getMovieNodeLinkDataByYearRange(start, end, nodeLinkDataByEra) {
        let startEra = this.getDisneyEra(start);
        let endEra = this.getDisneyEra(end);

        if (startEra === endEra) {
            return this.getMoviesWithinRange(nodeLinkDataByEra, startEra, start, end);
        } else {
            let nodes = [];
            let links = [];
            let neighbours = {};
            let eras = [];
            let startIndex = this.movieEras.findIndex(era => era === startEra);
            let endIndex = this.movieEras.findIndex(era => era === endEra);
            for(let i = startIndex; i <= endIndex; i++) {
                let data = this.getMoviesWithinRange(nodeLinkDataByEra, this.movieEras[i], start, end);
                let currNodeIds = nodes.map(node => node.id);
                // there may be actors that are common in different eras.
                // we need to only push actor nodes that do not yet exist in the node array
                data.nodes.forEach(dataNode => {
                    if (!currNodeIds.includes(dataNode.id)) {
                        nodes.push(dataNode);
                    }
                });
                links = links.concat(data.links);
                let neighborKeys = Object.keys(data.neighbours);
                neighborKeys.forEach(key => {
                    neighbours[key] = data.neighbours[key];
                })
                eras = eras.concat(data.eras);
            }
            return { links: links, nodes:nodes, neighbours: neighbours, eras: eras };
        }
    }

    static getMoviesWithinRange(nodeLinkDataByEra, era, start, end) {
        let eraNodeData = nodeLinkDataByEra[era].nodes;
        let eraLinkData = nodeLinkDataByEra[era].links;
        let movieNodes = eraNodeData.filter(node => {
            let year = new Date(node.release_date).getFullYear();
            return node.type === 'movie' && year >= start && year <= end;
        });
        let movieTitles = movieNodes.map(node => node.id);
        let filteredLinks = eraLinkData.filter(link => movieTitles.includes(link.target));
        let actorList = filteredLinks.map(link => link.source);
        let actorNodes = eraNodeData.filter(node => {
            return node.type === 'actor' && actorList.includes(node.id);
        });
        let nodes = movieNodes.concat(actorNodes);
        let neighbours = nodeLinkDataByEra[era].neighbours;
        return {links: filteredLinks, nodes: nodes, neighbours: neighbours, eras: [era] };
    }

    static getMovieColor(era) {
        switch (era) {
            case DataProcessor.movieEras[0]:
                return DataProcessor.movieColourEras[0];
            case DataProcessor.movieEras[1]:
                return DataProcessor.movieColourEras[1];
            case DataProcessor.movieEras[2]:
                return DataProcessor.movieColourEras[2];
            case DataProcessor.movieEras[3]:
                return DataProcessor.movieColourEras[3];
            case DataProcessor.movieEras[4]:
                return DataProcessor.movieColourEras[4];
            case DataProcessor.movieEras[5]:
                return DataProcessor.movieColourEras[5];
            case DataProcessor.movieEras[6]:
                return DataProcessor.movieColourEras[6];
            case DataProcessor.movieEras[7]:
                return DataProcessor.movieColourEras[7];
            default:
                return "black";
        }
    }

    static getMoviesCountForBigGroupLabels(moviesRaw) {
        let moviesCount = d3.nest()
            .key(d => d["disney_era"])
            .key(d => d["release_date"].getFullYear())
            .entries(moviesRaw);

        moviesCount = moviesCount.map(d => {
            return {
                disney_era: d.key,
                count: d.values.length
            };
        });

        moviesCount = moviesCount.map((d, i) => {
            const prev = moviesCount[i - 1];
            const cumsum = prev ? d.count + prev.cumsum : d.count;
            d.cumsum = cumsum;
            return d;
        });

        return moviesCount
    }

    static wrapText(text, width) {
        text.each(function () {
            var text = d3.select(this),
                words = text.text().split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, // ems
                x = text.attr("x"),
                y = text.attr("y"),
                dy = 0,
                tspan = text.text(null)
                    .append("tspan")
                    .attr("x", x)
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
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em")
                        .text(word);
                }
            }
        });
    }
}
