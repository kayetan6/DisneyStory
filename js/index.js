let vh = window.innerHeight * 0.01;
document.documentElement.style.setProperty('--vh', `${vh}px`);

window.addEventListener('resize', () => {
  // We execute the same script as before
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
});

const area = new Area({ parentElement: '#revenue-overall' });
const nodeLink = new NodeLink({ parentElement: '#movie-actors' });
const dotplot = new Dotplot({ parentElement: '#movie-era' });
const legend = new Legend({ parentElement: "#legend-plot" });

let nodes = [];
let links = [];
let nodeLinkDataByEra = {};
let blurbs = {};

let hoveredNode = null;
let selectedNode = null;
let currentEra = [];
let nodeIds = [];
let userSelected = false;

Promise.all([
  d3.csv('data/disney_revenue.csv'),
  d3.csv('data/disney-movies-awards.csv'),
  d3.csv('data/disney-voice-actors-2.csv'),
  d3.json('data/era-blurbs.json')
]).then(files => {
  let revenueRaw = files[0];
  let moviesRaw = files[1];
  let actorsRaw = files[2];
  blurbs = files[3];

  revenueRaw.forEach(val => {
    val.year = +val.year;
    val.studio = +val.studio;
    val.consumer = +val.consumer;
    val.interactive = +val.interactive;
    val.parks_resorts = +val.parks_resorts;
    val.media = +val.media;
    val.total = +val.total;
  });

  DataProcessor.processMovieData(moviesRaw, nodes);
  DataProcessor.processVoiceActorData(actorsRaw, nodes, links);
  DataProcessor.movieEras.forEach(era => {
    DataProcessor.groupNodeLinkByEra(nodes, links, nodeLinkDataByEra, era);
  });

  area.initVis({data: revenueRaw});
  currentEra = [DataProcessor.movieEras[0]];
  nodeIds = nodeLinkDataByEra[currentEra].nodes.map(node => node.id);

  /**
   * Because the nodeLink graph mutates the data that is passed to it, we have to provide it a deep copy rather than
   * a reference to the data. This allows us to keep the original data intact and update the data of the graph based
   * on the user's interactions
   */
  nodeLink.initVis({dataByEra: JSON.parse(JSON.stringify(nodeLinkDataByEra)), initialEra: currentEra});

  dotplot.initVis(
    moviesRaw, DataProcessor.getMoviesCountForBigGroupLabels(moviesRaw),
    { x: "year", y: "count", size: "box_office", era: "disney_era" },
    { x: "Time", y: "None", size: "Gross Revenue", era: "Disney Era" },
    "#movie-era-tooltip"
  );
  dotplot.render();

  legend.initVis(
    JSON.parse(JSON.stringify(moviesRaw)),
    { size: "box_office" },
    { size: "Gross Revenue" },    
  )
  legend.render();
});

// -------- INTERACTIVE CHECKS --------
let updateNodeGraphByEraLabel = function(era) {
  userSelected = false;
  currentEra = [era];
  selectedNode = null;
  nodeIds = nodeLinkDataByEra[currentEra].nodes.map(node => node.id);
  nodeLink.updateEra(
      JSON.parse(JSON.stringify(nodeLinkDataByEra[currentEra].nodes)),
      JSON.parse(JSON.stringify(nodeLinkDataByEra[currentEra].links)),
      JSON.parse(JSON.stringify(nodeLinkDataByEra[currentEra].neighbours)));
  dotplot.clearBrush();
  updateEraBlurb();
  updateEraBlurbButton();
};

let setYearSelection = function (yearRange) {
  userSelected = true;
  let data = DataProcessor.getMovieNodeLinkDataByYearRange(yearRange.start, yearRange.end, nodeLinkDataByEra);
  currentEra = data.eras;
  nodeIds = data.nodes.map(node => node.id);
  nodeLink.updateEra(
      JSON.parse(JSON.stringify(data.nodes)),
      JSON.parse(JSON.stringify(data.links)),
      JSON.parse(JSON.stringify(data.neighbours)));
  selectedNode = null;
  changeToFunFact();
};

let nodeSelectionHandler = function(title, era){
  userSelected = false;
  let nodeData, nodeLinks, nodeNeighbors;
  if(selectedNode === null || selectedNode !== title) {
    selectedNode = title;
    currentEra = [era];
    let {filteredLinks, movieNodes } = DataProcessor.getMovieNodeLinkDataByMovie(era, title, nodeLinkDataByEra);
    nodeData = JSON.parse(JSON.stringify(movieNodes));
    nodeLinks = JSON.parse(JSON.stringify(filteredLinks));
    nodeNeighbors = JSON.parse(JSON.stringify(nodeLinkDataByEra[era].neighbours));
  } else {
    selectedNode = null;
    nodeData = JSON.parse(JSON.stringify(nodeLinkDataByEra[currentEra].nodes));
    nodeLinks = JSON.parse(JSON.stringify(nodeLinkDataByEra[currentEra].links));
    nodeNeighbors = JSON.parse(JSON.stringify(nodeLinkDataByEra[currentEra].neighbours))
  }
  nodeIds = nodeData.map(node => node.id);
  nodeLink.updateEra(nodeData, nodeLinks, nodeNeighbors);
  dotplot.clearBrush();
  updateEraBlurb();
  updateEraBlurbButton();
};

let setHoveredNode = function(node, type, era) {
  hoveredNode = node;

  if(type === "actor" && selectedNode === null) {
    // if we hover over an actor and there's no selected node,
    // then we can show the one hop
    nodeLink.showOneHopNodeLink(node);
  } else if (era && currentEra.includes(era) && nodeIds.includes(node)) {
    // we want to check if the node-link graph is showing the node in the
    dotplot.selectMovie(node);
    nodeLink.showOneHopNodeLink(node);
  } else if (era === undefined) {
    dotplot.selectMovie(node);
    nodeLink.showOneHopNodeLink(node);
  } else {
    dotplot.selectMovie(node);
  }
}

let resetHoveredNode = function() {
  hoveredNode = null;
  dotplot.deselectMovie();
  nodeLink.showAllNodeLink();
}

let updateNodeLinkGraph = function() {
  let era =$(this).val();
  updateNodeGraphByEraLabel(era);
};

let preGoldenBtn = document.getElementById('pre-golden-age-btn');
let goldenBtn = document.getElementById('golden-age-btn');
let wartimeBtn = document.getElementById('wartime-era-btn');
let silverBtn = document.getElementById('silver-age-btn');
let darkAgeBtn = document.getElementById('dark-age-btn');
let renaissanceBtn = document.getElementById('renaissance-btn');
let postRenaissanceBtn = document.getElementById('post-renaissance-btn');
let secondRenaissanceBtn = document.getElementById('second-renaissance-btn');
let previousBtn = document.getElementById('previous-era');
let nextBtn = document.getElementById('next-era');


let eraButtons = [
    preGoldenBtn, goldenBtn, wartimeBtn, silverBtn, darkAgeBtn, renaissanceBtn,
    postRenaissanceBtn, secondRenaissanceBtn
];

eraButtons.forEach(button  => {
  button.addEventListener('click', updateNodeLinkGraph);
  button.style.backgroundColor = DataProcessor.getMovieColor(button.value);
});

let updateEraBlurb = function() {
  let mainContainer = document.getElementById('disney-era-blurb');

  let blurbDetailsContainer = document.createElement('div');
  blurbDetailsContainer.className = 'blurb-details';

  let headerElem = document.createElement('h1');
  let header = document.createTextNode(currentEra);
  headerElem.appendChild(header);

  let yearElem = document.createElement('h3');
  let year = document.createTextNode(blurbs[currentEra].years);
  yearElem.appendChild(year);

  let blurbElem = document.createElement('p');
  let blurb = document.createTextNode(blurbs[currentEra].description);
  blurbElem.appendChild(blurb);

  blurbDetailsContainer.appendChild(headerElem);
  blurbDetailsContainer.appendChild(yearElem);
  blurbDetailsContainer.appendChild(blurbElem);

  mainContainer.replaceChild(blurbDetailsContainer, mainContainer.children[0]);
};

let updateBlurbToFunFact = function() {
  let mainContainer = document.getElementById('disney-era-blurb');
  let factNumber = Math.floor(Math.random() * 40);
  let fact = blurbs['Fun Fact'][factNumber];

  let blurbDetailsContainer = document.createElement('div');
  blurbDetailsContainer.className = 'blurb-details fun-fact';

  let headerElem = document.createElement('h1');
  let header = document.createTextNode('Fun Fact');
  headerElem.appendChild(header);

  let blurbElem = document.createElement('p');
  let blurb = document.createTextNode(fact);
  blurbElem.appendChild(blurb);

  blurbDetailsContainer.appendChild(headerElem);
  blurbDetailsContainer.appendChild(blurbElem);

  mainContainer.replaceChild(blurbDetailsContainer, mainContainer.children[0]);
};

let updateEraBlurbButton = function() {
  let indexOfCurrent = DataProcessor.movieEras.indexOf(currentEra[0]);

  if(userSelected){
    nextBtn.style.visibility = 'hidden';
    previousBtn.style.visibility = 'hidden';
  }else if(indexOfCurrent == 0) {
    previousBtn.style.visibility = 'hidden';
    nextBtn.style.visibility = 'visible';
    nextBtn.style.backgroundColor = DataProcessor.movieColourEras[indexOfCurrent + 1];
  } else if(indexOfCurrent == DataProcessor.movieEras.length - 1) {
    nextBtn.style.visibility = 'hidden';
    previousBtn.style.visibility = 'visible';
    previousBtn.style.backgroundColor = DataProcessor.movieColourEras[indexOfCurrent - 1];
  } else {
    previousBtn.style.visibility = 'visible';
    nextBtn.style.visibility = 'visible';
    previousBtn.style.backgroundColor = DataProcessor.movieColourEras[indexOfCurrent - 1];
    nextBtn.style.backgroundColor = DataProcessor.movieColourEras[indexOfCurrent + 1];
  }
};

let changeToNextEra = function(){
  let indexOfCurrent = DataProcessor.movieEras.indexOf(currentEra[0]);
  currentEra = [DataProcessor.movieEras[indexOfCurrent + 1]];
  updateNodeGraphByEraLabel(currentEra[0]);
}

let changeToPreviousEra = function(){
  let indexOfCurrent = DataProcessor.movieEras.indexOf(currentEra[0]);
  currentEra = [DataProcessor.movieEras[indexOfCurrent - 1]];
  updateNodeGraphByEraLabel(currentEra[0]);
}

previousBtn.addEventListener('click', changeToPreviousEra);
nextBtn.addEventListener('click', changeToNextEra);

let changeToFunFact = function(){
  updateBlurbToFunFact();
  updateEraBlurbButton();
};

// -------- SCROLL ANIMATION --------

// Select all links with hashes
$('a[href*="#"]')
    // Remove links that don't actually link to anything
    .not('[href="#"]')
    .not('[href="#0"]')
    .click(function(event) {
      // On-page links
      if (
          location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '')
          &&
          location.hostname == this.hostname
      ) {
        // Figure out element to scroll to
        var target = $(this.hash);
        target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
        // Does a scroll target exist?
        if (target.length) {
          // Only prevent default if animation is actually gonna happen
          event.preventDefault();
          $('html, body').animate({
            scrollTop: target.offset().top
          }, 1000);
        }
      }
    });
