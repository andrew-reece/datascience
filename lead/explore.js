/*

########################################################################################################
#
#  PROJECT 		DSSG: CDPH Lead Exposure Team
#
#  AUTHOR		Andrew Reece [reece@g.harvard.edu]
#
#  FILE 		/explore.js
#
#
#  DESCRIPTION 	- Provides interactivity and AJAX functionality for explore page (/explore.php)
#
#  LIBRARIES	D3
#				JQuery
#				Google Maps
#				Spin.js 
#					This is a Javascript library for 'loading' spinner graphics
#					http://fgnass.github.io/spin.js/
#
#
########################################################################################################

*/

/*

Notes: 

	   -This file has gone through a LOT of iterations.  I haven't always been good about cleaning up defunct variables,
		once they're no longer needed.  It may be helpful to just run a search for each of the global variables and see
		if they even show up in the actual code, after they're defined.  If not, feel free to delete them.

*/



/////// PUBLIC DEMO SETTING
//
//		Do you want to show the app as a public (ie. non-confidential) demo? 
//		(hides addresses and names if set to true)


	var public_demo = true;



///////
/////// GLOBAL VARIABLES
///////
var pageview, graphview, old_pview, tabview, 
	bldg_id, current_building_id, getevents,
	current_bounds, current_tool_bounds, rectangle, circles,
	map, mapbox_listener, maptool_listener, 
	referred, spinner, alldata, last_clicked, clickcount, 
	post_params, current_params, domain_values, search_criteria,
	ajax_search_addr, multidata, indivdata, eventsdata, dunit,
	svg, svgline, focus, scales, x, y, y_axis, x_axis, g_xax, g_yax, 
	height, focus_height, focus_width, thresh, dims, radius_scale,
	current_addr_full, current_addr_short, current_graph,
	rows, head_table, table, dcomplete_PERM, dunit_PERM;

///////
/////// TOGGLE VARIABLES
//////
var toggles, search_crit_popup_toggle, table_exists, 
	showunit, show_barlevel_data, toggles, showmap, 
	nohide, noswitch, thresh, active_focus; 


// opts are for 'loading status' spinner
// see: http://fgnass.github.io/spin.js/
var opts = {
	lines: 13, // The number of lines to draw
	length: 20, // The length of each line
	width: 10, // The line thickness
	radius: 30, // The radius of the inner circle
	corners: 1, // Corner roundness (0..1)
	rotate: 0, // The rotation offset
	direction: 1, // 1: clockwise, -1: counterclockwise
	color: '#5287B3', // #rgb or #rrggbb or array of colors
	speed: 1, // Rounds per second
	trail: 60, // Afterglow percentage
	shadow: false, // Whether to render a shadow
	hwaccel: false, // Whether to use hardware acceleration
	className: 'spinner', // The CSS class to assign to the spinner
	zIndex: 2e9, // The z-index (defaults to 2000000000)
	top: '80%', // Top position relative to parent
	left: '50%' // Left position relative to parent
};

// jquery extension function to extract unique elements from array
// 	see: http://stackoverflow.com/questions/5381621/jquery-function-to-get-all-unique-elements-from-an-array
	$.extend({
		distinct : function(anArray) {
		   var result = [];
		   $.each(anArray, function(i,v){
			   if ($.inArray(v, result) == -1) result.push(v);
		   });
		   return result;
		}
	});

// Firefox bug with JQuery .submit() fix:
// http://stackoverflow.com/questions/10108330/firefox-jquery-form-submission-not-working

// all .landing-link <a> tags (Home, City of Chicago icon, and "Lead Inspections Data Portal") use this
// these links load the landing page (/index.php), but we want to pass in any query data that has already been retrieved
// so we turn the objects we want into a JSON string, and pass that as a POST variable in a fake <form> object.
d3.selectAll('.landing-link')
	.on('click', function() {

		current_params.returncount = post_params.returncount;
		var qstring = JSON.stringify({params:current_params,data:multidata});

		$.when( $('#container').fadeOut(500) )
			.done( function() { 
				startSpinner('midpage');
				setTimeout( function() { 
					var form = $("<form />")
								.attr({ method: "POST", action: "/lead/" })
								.append( $('<input />').attr({
								            type: 'hidden',
								            name: 'json',
								            value: '{"postdata":'+qstring+'}'
								        	}) 
								);
		        	$("body").append(form);
		        	form.submit();
		        }, 500);
			});
		return false;
	});


// global vars that hold AJAX data: 	multidata, indivdata, eventsdata


// if we have query data from POST, assign to multidata and post_params.
post_params = (postdata !== undefined) 	? postdata.params 	: null;
multidata   = (postdata !== undefined) 	? postdata.data 	: null;

// other global ajax vars are null
indivdata = null;
eventsdata = null;

// current_params: 	gets updated throughout the app with current query parameters
// 					here it starts with whatever got passed in from POST, or just null
current_params = post_params;

// ajax_search_addr: 	"value", holds AJAX response from address search query (where matching is done on address string)
ajax_search_addr = null;

// pageview: 	keeps track of whether we're in 'multi' or 'indiv' views
pageview = (post_params.pview !== undefined) ? post_params.pview : "multi";

// graphview: 	keeps track of whether we're in "map" or "scatter" (for multi), or "histogram" or "linegraph" (for indiv)
//			  	default starting page for multi is "map", for indiv, "histogram"
graphview = (pageview == "multi") ? "map" : "histogram"; 

// current_building_id, bldg_id: 	tracks building id#, a unique number from assessor data for every building in chicago
//									used for SQL lookups when we load indiv pages
current_building_id = bldg_id = (post_params.bldg_id !== undefined) ? post_params.bldg_id : "";

// define default y-axis measure
var current_response = "p_high_g5_build";

// old_pview: 	when transitioning from graph to graph, it's helpful to know whether we're coming from multi or indiv
//				old_pview keeps track of this (compared with pview/pageview, which tracks the view we're going to)
old_pview = null;

// tabview: 	tracks which tab (usually "display", "map", "control") we have visible in the control panel area
tabview = "display-tab";

// getevents: 	used for AJAX queries for indiv building data.  
// 				we have a separate call for querying events and tests data, i don't remember why.
// 				more on this in callAjax() documentation.
getevents = "false";

// search_crit_popup_toggle: 	toggles hide/show of search criteria popup window
search_crit_popup_toggle = false;

// last_clicked: 	used in indiv view.  there are a lot of ways to display information in the table at bottom right.
//					depending on whether you click on a histogram bar, a table row, or the 'Show All' link at the bottom,
// 					there's different behavior that happens with the table display.  there were a lot of little bugs with
// 					this network of click possibilities, so this variable is used to keep track of where the most recent
//					table display command came from.  
// 					see: createHistogram(), createTable()
last_clicked = "";

// clickcount: 		not sure if we still need this one.  it was originally used around line 386, where we have an onclick
// 					trigger for the scatter plot.  it has to do with the fact that clicking a multi on the plot sets
// 					the building id related to that multi, but i wanted to be able to just click anywhere else on the screen
//  				and have it un-set that building id (rather than having to reclick the multi to unselect it.)
// 					this used to be more of an issue when the display tab had a histogram view, instead of a table view,
// 					and i'm not sure if this variable is still necessary.
clickcount = 0;

// get height from css defs in /explore.css 
height = d3.select("#vis").style("height").substr(0,3);

// holds threshold booleans for scatter, linegraph 
thresh = { "5":false, "10":false, "first-bad":false, "first-insp":false, "comply":false };

// define dimensions for graph formatting
dims = setDims(height);

// boolean for createTable() (should we wipe out existing table elements upon creation?)
table_exists = false;

// boolean for createTable() (should we show table data per-test or per-apt-unit?)
showunit = false;

// boolean for indiv-histogram/table (should we show only records for a given bar on the histogram?)
show_barlevel_data = false;

// for column sorting in indiv. graph (is sorting asc or desc for each column in the table?)
toggles = []; 

// for multi page - tells createScatter() whether map view is currently showing (to know whether to hide map div)
showmap = false;

// urls for kml files 
// (google maps api doesn't like local filepaths, 
//  although i guess now that we have a dedicated AWS instance we can use that instead of my own server space)
var kml_urls = {
				corridors: 'http://datapsych.com/test/chicago_industrial_corridors.kml', 
				tracts:'http://datapsych.com/test/chicago_tracts.kmz', 
				communities:'http://datapsych.com/test/chicago_communities.kml'
				};

// for secondary sort key - default -> age_at_sample (indiv.histogram)
var secondary_key = "age_at_sample";

// intro text printed at top of screen (single.b gets replaced dynamically)
var intro_text = {
	multi:	"Circles represent buildings which match search criteria (<a id='search-criteria-popup-link' href='#'>click to view search criteria</a>)",
	single: {a:"Lead exposure report for ", b:"a given building"}
};

// text for #return-count div at bottom right of multi table
var result_count_text = {a:"Query returned ", b:0, c:" records."};

// this is for the search criteria dropdown in #intro
// the idea is to translate variable names into more readable descriptions of each parameter
var criteria_dict = {
	keys: {
		n_high_tests_build: "Limit var. min.",
		n_high_g5_build: 	"Limit var. min.",
		n_high_g10_build: 	"Limit var. min.",
		p_high_g5_build: 	"Limit var. min.",
		p_high_g10_build: 	"Limit var. min.",
		init_date: 			"Initial inspection date: ",
		comply_date: 		"Compliance date: ",
		minlat: 			"Min. latitude",
		maxlat: 			"Max latitude",
		minlon: 			"Min. longitude",
		maxlon: 			"Max longitude",
		qlimit: 			"# results",
		abatement: 			"Has remediated",
		addr_vector: 		"Address vector",
		housebuilt: 		"Construction era",
		housetype: 			"Residence type",
		meas: 				"Limiting variable",
		sample_when: 		"Blood test dates",
		sincelast: 			"Days since"
	},
	vals: {
		n_high_tests_build: "# tests (total)",
		n_high_g5_build: 	"# tests over BLL 5",
		n_high_g10_build: 	"# tests over BLL 10",
		p_high_g5_build: 	"% of all tests over BLL 5",
		p_high_g10_build: 	"% of all tests over BLL 10",
	}
};

// same idea as criteria_dict, but for the indiv-linegraph tooltips
var tooltip_dict = {
	event_date: "Date",
	event_code: "Event code",
	event_text: "Event",
	event_comments: "Comments",
	age_at_sample_yrs: "Age at test",
	apt_num: "Apt #",
	bll: "BLL",
	fullname: "Name"
};

// toggles for showLayers() 
var layers = {
	corridors: { kml: null , show: false },
	tracts: { kml: null , show: false },
	communities: { kml: null , show: false }
};


// on open queries (ie. queries that come from Apply Filter button in Multi control panel with geo-boundaries turned off),
// it's possible that the whole database can get returned, or at least very large chunks of it.  query_limit is used to 
// set off a warning popup when a large number of hits is returned.  set it at any number that seems reasonable.  500 default.
var query_limit = 500;

// current_params keeps getting updated throughout script; these are starting values (mostly from post_params)
current_params.getevents = getevents;  
current_params.pview = pageview;  
current_params.gview = graphview;  
current_params.tview = tabview; 
current_params.bldg_id = bldg_id;
current_params.has_initdate = 'false';
current_params.minlat = post_params.minlat;
current_params.maxlat = post_params.maxlat;
current_params.minlon = post_params.minlon;
current_params.maxlon = post_params.maxlon;

// this is how we know whether to re-query DB on loading Multi pages, or whether to just keep current query object
filters_updated = false;



// render page
startload( current_params );



/*

//////////////////////////////////////
//
//
// 			FUNCTIONS
// 
//
//////////////////////////////////////


	- most important functions are listed first: 

		startload()

		loadMulti()
		createMainMap()
		createScatter()

		loadIndiv()
		createLineGraph()
		createHistogram()

		createTable()

		graph()

		getQueryParams()
		callAjax()

	- the rest are listed in no particular order
*/

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: startload(params)
// Purpose:  initiates pageload, either from landing, after AJAX or Multi/Indiv switch
//
//////////////////////////////////////////////////////////////////////////////////////
function startload(params) {

	// set global 'current_params' to whatever current query parameters come into startload()
	current_params = params;

	// if pview = indiv, initiate indiv page loading sequence
	if (params.pview == 'indiv') {

		preploadIndiv( params );

	// if we've arrived here after clicking Apply Filters in Multi control panel,
	// we need to re-query DB, so callAjax()
	} else if ((params.pview == "multi") && (filters_updated)) { 
		
		startSpinner();
		filters_updated = false;
		setTimeout( function() { callAjax(params, query_limit); }, 500);

	// otherwise, we default to loadMulti() with current query set
	} else { 

		loadMulti(params); 
	}
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: loadMulti(params)
// Purpose:  loads multi view (either map or scatterplot) 
//
//////////////////////////////////////////////////////////////////////////////////////
function loadMulti(params) {

	// set global 'current_params' to whatever current query parameters are passed in
	current_params = params;

	// set domains for graph scales
	setDomainValues();

	// set range, text, etc for graph scales
	setScales(domain_values);	

	// set globals 'graphview' and 'tabview', based on current params
	graphview = params.gview;
	tabview = params.tview;

	// set up tab highlighting on Details pane
	changeTab(tabview);

	// if svg exists, remove it so we can start over
	if(svg !== undefined) {svg.remove();}
	
	// toggles for control panel switches
	nohide = false;
	noswitch = false;
	active_focus = false;

	// write #intro text
	d3.select("#intro").html(intro_text.multi);

	// write #search-criteria-popup text using populateCriteriaBox()
	d3.select("#search-criteria-popup").html(function() { return populateCriteriaBox( params ); });

	// set click behavior for search criteria popup link (it's actually a dropdown)
	d3.select("#search-criteria-popup-link")
		.on('click', function() { 

			search_crit_popup_toggle = (search_crit_popup_toggle) ? false : true; 
			if (search_crit_popup_toggle) 	{ $('#search-criteria-popup').slideDown(500); } 
			else 							{ $('#search-criteria-popup').slideUp(500); }
		});

	// click behavior for 'X' closer on search criteria dropdown
	d3.select("#popup-x")
		.on('click', function() { search_crit_popup_toggle = false; $('#search-criteria-popup').slideUp(500); });

	// make query results string (positioned underneath details box)
	result_count_text.b = multidata.length;

	d3.select("#return-count")
		.style("display", "inline-block")
		.html(d3.values(result_count_text).join(""));

	// sets text of display tab (this changes between "Building Data" for Multi and "Map View" for Indiv)
	setDisplayTabText("multi");

	// sets highlight/click behavior for all title tabs on Detail pane
	setTabEvents("multi");

	// initialize main svg for Multi graph area
	svg = d3.select("#vis").append("svg")
			.attr('id','multi-box')
			.attr({
				width: dims.multi.scatter.w,
				height: dims.multi.scatter.h
			  })
			.on('click', function() {
				clickcount++; 
				if (noswitch && clickcount > 2) {
					nohide = (nohide) ? false : true;
					noswitch = (noswitch) ? false : true;
					eraseFocus(); 
					clickcount = 0;
				}
			});
	
	// setParams() automates assigning all the styles for whatever object gets passed in
	// it's not really necessary, just de-clutters things a bit
	setParams("#tab-bar", dims.multi.tabbar);
	setParams("#detail-box", dims.multi.detailbox);

	d3.select("#detail-control-group")
		.style("top", dims.multi.controlbox.top)
		.style("width", dims.multi.controlbox.width);

	// this tabname/table_divs thing was a late modification, after I switched out the mini histogram for the table in Multi
	// there was some difficulty with getting the right Detail pane tab to show, so this was the hack I used to solve it.
	var tabname = tabview.split("-")[0];
	var table_divs = (tabname == "display") ? "#table-container, #header-table," : "";

	// fade in page elements
	$("#container, #vis, #intro, #detail-box, #tab-bar, .multi."+tabname+", .overlay2, "+table_divs+" #return-count").fadeIn(1000);
	d3.select('#container').style('opacity', 1.0);
					
	// if spinner is going, stop it
	if (spinner !== undefined) { spinner.stop(); }

	// if showing #display-tab, generate the table of building data
	if (tabname == "display") { createTable(params.pview, multidata); }

	// define submit button behavior for search bar
	d3.select('#search-submit')
		.on('click', function() { 

			var search_term = d3.select('#search-box').property('value').toUpperCase();
			var search_id = null;
			var search_data = null;

			// if the search box is empty, nothing happens on submit
			if (search_term !== "") {

				// first try and match address string to a bldg_id in the current query set
				multidata.forEach( function(addr) {
					if ( addr.address.toUpperCase() === search_term ) {
						search_id = addr.bldg_id;
						search_data = addr;
					}
				});

				// if that works, then we're done, and we can call transition() (which brings us to Indiv pages)
				if (search_id !== null) {

					transition( null, search_id, search_data ); 

				// if that doesn't work, query DB and look for building data matching on address string
				} else {

					callAjax( {getevents:'false', search:'true', addr:search_term} );					

					search_id = (ajax_search_addr !== null) ? ajax_search_addr[0].bldg_id : null;

					// if that works, then we're done and we call transition()
					if (search_id !== null) { transition(null, search_id, ajax_search_addr); } 
					// if we can't find the address in the DB, we give up.
					else { alert('Sorry, address not found'); }

				}
			} 
		});

////
//// SET EVENT BEHAVIORS FOR CONTROL PANEL 
////

	// shows different control panel options for map vs scatterplot
	changeControlFeatures();

	// switches between the four graph views of explore.php (Map, Scatterplot, Histogram, Timeline)
	// ** CONSIDER PLACING THIS SOMEWHERE MORE PROMINENT ON PAGE **
	d3.selectAll(".graphview")
		.on('change', function() {
			transition( d3.select(this) );
		});

	// #filter-mapbox determines whether to limit query to viewable onscreen map area 
	d3.select('#filter-mapbox')
		.on('click', function() {

			if (d3.select(this).property('checked')) {

				mapbox_listener = google.maps.event.addListener(map, "bounds_changed", function() { 

					current_bounds = rectangle.getBounds(); 

					bounds_arr = current_bounds.toUrlValue().split(",");

					current_params.minlat = bounds_arr[0];
					current_params.minlon = bounds_arr[1];
					current_params.maxlat = bounds_arr[2];
					current_params.maxlon = bounds_arr[3];
				});

			// if not, we use landing page bounding box as search area
			// ** SHOULDN'T IT BE COMPLETELY UNBOUNDED THOUGH?? **
			} else {

				google.maps.event.removeListener(mapbox_listener);

				current_params.minlat = post_params.minlat;
				current_params.minlon = post_params.minlon;
				current_params.maxlat = post_params.maxlat;
				current_params.maxlon = post_params.maxlon;
			}
		});

	// if selected, summons map rectangle, just like on landing page
	// bounding box is continuously updated when rectangle is moved
	d3.select('#filter-maptool')
		.on('click', function() {
			
			var bounds_arr;
			if (d3.select(this).property('checked')) {

				var center = map.getCenter();
				setRectangle(center);
				maptool_listener = google.maps.event.addListener(rectangle, "bounds_changed", function() { 

					current_tool_bounds = rectangle.getBounds(); 

					bounds_arr = current_tool_bounds.toUrlValue().split(",");

					current_params.minlat = bounds_arr[0];
					current_params.minlon = bounds_arr[1];
					current_params.maxlat = bounds_arr[2];
					current_params.maxlon = bounds_arr[3];
				});

			} else {

				rectangle.setMap(null);
				google.maps.event.removeListener(maptool_listener);

					bounds_arr = current_bounds.toUrlValue().split(",");

					current_params.minlat = bounds_arr[0];
					current_params.minlon = bounds_arr[1];
					current_params.maxlat = bounds_arr[2];
					current_params.maxlon = bounds_arr[3];
			}
		});

	// changes the y-axis variable (eg. avg bll changes to % bll > 5)
	d3.select("#yscale")
		.on("change", function() {
			current_response = d3.select(this).node().value;
			y.domain(scales.multi.y[current_response].domain);
			svg.select(".yaxis").transition()
					.duration(1000)
					.ease("sin-in-out")
					.call(y_axis)
					.call(updateAxisText,"y",current_response,"multi")
					.call(updateMain,current_response);
		});

	// controls changing the y-transformation (eg. log, sqrt) of scatterplot
	// NB: this was more useful when we had hundreds or thousands of points on the graph
	// 	 	now we generally have fewer than 500, so it might just clutter up the control panel
	d3.select("#ytransform")
		.on("change", function() {
			var transform = d3.select(this).node().value;
			if (transform == "linear") {
				y = d3.scale.linear().domain(scales.multi.y[current_response].domain).range(scales.multi.y[current_response].range);
			} else if (transform == "log") {
				y = d3.scale.log().domain(scales.multi.y[current_response].domain).range(scales.multi.y[current_response].range);
			} else if (transform == "sqrt") {
				y = d3.scale.sqrt().domain(scales.multi.y[current_response].domain).range(scales.multi.y[current_response].range);
			}
			svg.select(".yaxis").transition()
					.duration(1000)
					.ease("sin-in-out")
					.call(y_axis.scale(y))
					.call(updateMain,current_response);
		});		

	// adds/removes KML layers on map (eg. industrial corridors)
	d3.select("#map-layer-select")
		.on('change', function() {
			showLayers( d3.select(this).node().value );
		});

	// chooses Cutoff Type for filtering
	// slider behavior is adjusted with updateMeasureSlider(), based on choice.
	d3.select("#filter-bll-measure-category")
		.on('change', function() {

			var thisid = d3.select(this).node().value;

			if 		(thisid == "p_high_g5_build" || thisid == "p_high_g10_build") 	{ updateMeasureSlider(0.1,1,0.1,0.1); } 
			else if (thisid == "n_high_g5_build" || thisid == "n_high_g10_build") 	{ updateMeasureSlider(0,100,5,5); } 
			else if (thisid == "mean_high_bll_build") 								{ updateMeasureSlider(5,20,2,5); }
		});

	// sets text for min/max sliders values at either end of actual slider
	d3.selectAll(".filter-bookend.bookend-min")
		.text( function() {
			var sliderid = d3.select(this).attr("id").slice(7,-4); //slices off 'filter-' and '-low'
			return d3.select("#"+sliderid).property("min");
	});

	d3.selectAll(".filter-bookend.bookend-max")
		.text( function() {
			var sliderid = d3.select(this).attr("id").slice(7,-5); //slices off 'filter-' and '-high'
			return d3.select("#"+sliderid).property("max");
	});

	// updates #filter-<sliderid>-current to show current slider value at right of slider
	d3.selectAll(".filter-slider")
		.on('change', function() {
			var textval = d3.select(this).property("value");
			var sliderid = d3.select(this).attr("id");
			d3.select("#filter-"+sliderid+"-current").text( textval );
		});	

	// click behavior for Apply Filters ( leads to getQueryParams() )
	d3.select("#filter-submit")
		.on('click', function() {

			filters_updated = true;

			$('#container').fadeTo(500, 0.1, function() { 
					startSpinner('midpage');
					setTimeout( function() { getQueryParams(); }, 300);
				});
			
		});

	// hide/show legend-box for scatter plot
	d3.selectAll(".show-legend")
		.on("change", function() {
			var command = d3.select(this).attr("id");
			showLegend(command);
		});


	// draw threshold lines at 5/10 bll, just a visual aid
	d3.selectAll(".threshold")
		.on("change", function() {
			var val = d3.select(this).attr("id");
			updateThreshold(val, "scatter", null);
		});


/////
///// LOAD MULTI GRAPH 
/////
							
	graph( "multi", pageview, graphview, multidata );
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: 	createMainMap(addr)
// PURPOSE:  	makes map for Multi-map view (with google map api)
// Reference:  	http://bl.ocks.org/mbostock/899711
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function createMainMap(addr) {

	// default lat/lon centered on Chicago's West Loop district, downtown
	var chi_lat = 41.821;
	var chi_lon = -87.6613;
	var chicago = new google.maps.LatLng(chi_lat, chi_lon);

	// create map object
	map = new google.maps.Map(d3.select("#map-canvas").node(), {
	  zoom: 10,
	  center: chicago,
	  mapTypeId: google.maps.MapTypeId.ROADMAP,
	  // if streetview is turned on, it causes problems - hard to get back to normal view with d3 layers
	  streetViewControl: false
	});

	// set zoom level and centering of map based on selected building locations
	setZoom(map);

	// global var 'current_bounds' keeps track of current lat/lon boundaries for query
	current_bounds = map.getBounds();

	// set global var 'mapbox_listener' to change whenever map is moved/zoomed/panned etc
	if (mapbox_listener === undefined) { mapbox_listener = google.maps.event.addListener(map, "bounds_changed", function() { current_bounds = map.getBounds(); }); }
	
	// resets maptool checkbox to 'unchecked'
	d3.select('#filter-maptool').property('checked', false);

	// resets d3 building overlay (ie. red dots)
	if (overlay !== undefined)  {overlay.setMap(null);}

	// NB: most of the "if blah-blah !== undefined" conditionals are in case we're creating a new map over an old one
  	var overlay = new google.maps.OverlayView();


  // Add the container when the overlay is added to the map
  	overlay.onAdd = function() {

	    var layer = d3.select(this.getPanes().overlayMouseTarget).append("div")
	        .attr("class", "map-box");

	    // Draw each marker as a separate SVG element.
	    overlay.draw = function() {
		      var projection = this.getProjection(),
		          padding = 8;

		      var marker = layer.selectAll("svg")
		          .data(multidata)
		          .each(transform) // update existing markers
		        .enter().append("svg")
		          	.each(transform);

		      // Add a circle.
		      marker.append("svg:circle")
		          .attr("r", 4)
		          .attr("cx", padding)
		          .attr("cy", padding)
		          .attr("id", function(d) { return "dot-"+d.bldg_id; })
		          // mouseover circle turns circle pink, larger
		          // also highlights related table row
		          .on("mouseover", function(d,i){
						d3.select('[data-rowid=row-'+d.bldg_id+']').classed('zebrafinch', true);
						d3.select(this).attr('r', 7);
						d3.select(this).style('fill', 'magenta');
					})
					.on("mouseout", function(d){
						d3.select('[data-rowid=row-'+d.bldg_id+']').classed('zebrafinch', false);
						d3.select(this).attr('r', 4);
						d3.select(this).style('fill', 'red');
					})
					// click circle enters address of building into search box
					// also sets global 'current_building_id'
					.on("click", function(d) {
						current_building_id = d.bldg_id;
						d3.select('#search-box').property('value', function() { return (public_demo) ? "1234 XXXXX ST" : d.address; });
					})
					// dbl-click calls transition() for Indiv pages
					.on("dblclick", function(d) { 
						transition(null, d.bldg_id);
					});

			// taken directly from Bostock - converts lat/lon to pixel x/y coords
			function transform(d) {
				d = new google.maps.LatLng(d.civis_latitude, d.civis_longitude);
				d = projection.fromLatLngToDivPixel(d);
				return d3.select(this)
			    	.style("left", (d.x - padding) + "px")
			    	.style("top", (d.y - padding) + "px");
			}
	    };
  	};

  // Bind our overlay to the map…
  overlay.setMap(map);

  // global because createScatter() checks it
  showmap = true;

}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: createScatter(focus)
// Purpose:  creates multi building scatterplot
//
//////////////////////////////////////////////////////////////////////////////////////
	
function createScatter(data) {

	/* Note: most x-axis options (especially 'days since inspection', the only one that works right now)
			 will exclude some buildings, since not all buildings have the requisite data for that dimension.
			 for instance, many buildings have never been inspected, so they can't have a value on 
			 'days since inspection'.  If there are missing buildings, on loading scatterplot there's a 
			 box that shows up and notes how many are missing and why.  

			 so, this 'excluded' var is a counter that keeps track of how many buildings aren't shown.
	*/

	var excluded = 0;

	data.forEach( function(x) {
		if (x.init_date === null && x.comply_date === null) { excluded++; }
	});

	// if there are any excluded buildings, show warning
	if (excluded > 0) {
		$.when( $('#container').fadeTo(500, 0.1) )
			.done( function() {
				d3.select('#scatter-exclude-size').html(excluded);
				d3.select('#scatter-total-size').html(data.length);
				d3.select('#scatter-exclude-popup').style('display', 'inline-block');
			});
	}
	d3.select('#scatter-exclude-submit')
		.on('click', function() { 
			d3.select('#scatter-exclude-popup').style('display', 'none'); 
			$('#container').fadeTo(100, 1.0);
		});

	// radius scale for size of building circles (between 4 and 28px)
	// radius is based on # tests/bldg
	radius_scale = d3.scale.linear()
						.domain( [ domain_values.min_n_tests, domain_values.max_n_tests ])
						.range([4,28]);

	// define x/y scales for scatterplot
	
	// default y variable is % tests > 5 bll
	y = d3.scale.linear()
			.domain(scales.multi.y[current_response].domain)
			.range(scales.multi.y[current_response].range);

	// default x variable is # days since inspection of any kind (including compliance date)
	x = d3.scale.linear()	
				.domain(scales.multi.x.all.domain)
				.range(scales.multi.x.all.range);
		
	// now define axes based on those scales
	x_axis = d3.svg.axis()
					.scale(x)
					.orient("bottom");
	y_axis = d3.svg.axis()
					.scale(y) 
					.ticks(8)
					.orient("left");
	
	// set 'group' objects to contain both axis and axis text				
	// set up placement for axis texts

	g_yax = setAxisGroup('yaxis','multi','scatter',svg);
		g_yax.call(y_axis);
	g_xax = setAxisGroup('xaxis','multi','scatter',svg);
		g_xax.call(x_axis);

	var yaxis_text = setAxisText('yaxis','multi','scatter',g_yax);
	var xaxis_text = setAxisText('xaxis','multi','scatter',g_xax);

	// write in axis text (see function below)
	updateAxisText("","y",current_response,"multi");
	updateAxisText("","x","all","multi");

	// if map was previously showing, that means graph elements were hidden...so unhide them
	if (showmap) {
		g_yax.style('display','inline-block');
		g_xax.style('display', 'inline-block');
		svg.style('display','inline-block');
		showmap = false;
	}

	// make circles for scatterplot, bound to query data
	circles = svg.selectAll(".bldg-circle")
		.data(data)
		.enter()
		.append("circle")
			.attr("class", "bldg-circle")
			.attr("id", function(d) { return d.bldg_id; })
			.attr("data-bldgid", function(d) { return 'circle-'+d.bldg_id; })
				.style("stroke-width", "1px")
				.style("stroke", "darkgray")
				.style("fill", function(d) { 
					// color by n/s/e/w address label
					if (d.dir == "S") 		{ return "#e7298a"; }
					else if (d.dir == "N") 	{ return "#7570b3"; }
					else if (d.dir == "E") 	{ return "#1b9e77"; }
					else if (d.dir == "W") 	{ return "#d95f02"; }
				})
				// hides circles with no valid x-axis value (ie. never had comply or init date)
				.style('visibility', function(d) { return (computeSinceLast(d,"single")) ? 'visible' : 'hidden'; })

			// mouseover highlights circle and associated table row
            .on("mouseover", function(d,i){
          		d3.select(this).style('fill-opacity', 1.0);
				d3.select('[data-rowid=row-'+d.bldg_id+']').classed('zebrafinch', true);
			})
			.on("mouseout", function(d){
          		d3.select(this).style('fill-opacity', 0.4);
				d3.select('[data-rowid=row-'+d.bldg_id+']').classed('zebrafinch', false);
			})

			// click enters address into search box and assigns 'current_building_id'
			.on("click", function(d) {
				current_building_id = d.bldg_id;
						d3.select('#search-box').property('value', function() { return (public_demo) ? "1234 W XXXXX ST" : d.address; });
					
			})
			// dbl-click calls transition() to Indiv pages
			.on("dblclick", function(d) { 
				transition(null, d.bldg_id);
			})
				
		// define circle parameters
		.transition()
		.duration(1000)
			// radius based on # tests at this building
			.attr("r", function(d,i) { return radius_scale(d.n_high_tests_build); })
			// x dim based on days since last inspection
			.attr("cx", function(d) { return x( computeSinceLast(d,"single") ); })
			// y dim based on whatever 'current_response' variable is set to
			.attr("cy", function(d) { 
				
				var maxh = y(d[current_response]) - radius_scale(d.n_high_tests_build);
				var minh = (dims.multi.scatter.h-y(d[current_response])) - radius_scale(d.n_high_tests_build);
				if (maxh <= 20) {
					return (y(d[current_response]) + 1.2*radius_scale(d.n_high_tests_build));
				} else if (minh < 50) {
					return (y(d[current_response]) - 1.2*radius_scale(d.n_high_tests_build));
				} else {
					return y(d[current_response]);
				}
			})
			// circles are slightly opaque (and fill in on mouseover)
			.attr("fill-opacity", 0.4);
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: loadIndiv(id)
// Purpose:  loads individual-building view (including Histogram and Timeline)
//
//////////////////////////////////////////////////////////////////////////////////////
function loadIndiv() { 

	// reset secondary sort key to default
	secondary_key = "age_at_sample";

	// dccomplete and dunit are used to hold data for an entire building, and per-unit information, respectively
	// i think these are their global 'permanent' versions, as they can switch around in other functions
	dcomplete_PERM = [];
	dunit_PERM = [];

	// used in createTable(), if true, delete old table elements
	table_exists = false;

	// get rid of existing svg from multi (if applicable)
	d3.selectAll("svg").remove();

	// starting tab is highlighted to #display-tab (here, it reads: 'Map View')
	changeTab("display-tab");
	// set text of display tab
	setDisplayTabText("indiv");
	// set default detail-pane load to 'display'
	tabview = "display-tab";
	setTabEvents("indiv");

	// update contents of detail box to indiv map view
	changeDetailContent("#display-tab","indiv");

	// take address string with ", Chicago, IL" taken off the end
	// the shortened version makes it easier to put in narrow table cells
	var addr = indivdata[0].address.split(",")[0];

	// set text and link of building address in intro text (link opens to google maps)
	var intro_addr = (public_demo) ? "1234 XXXX ST, Chicago, IL 60654" : addr;
	intro_text.single.b = '<a href="https://maps.google.com/?q='+intro_addr+'"" target="_blank">'+intro_addr+'</a>';

	// write intro text
	d3.select("#intro").html(d3.values(intro_text.single).join(""));

	// create streetview map
	makeStreetviewMap(indivdata[0]); 


	// bins will store the individual samples by rounding up to next multiple of 5 on bll
	// eg. an individual test with bll 7 will go in bin #2, representing 5 < bll <= 10
	var bins = [[], [], [], [], [], [],[], [], [],[], [], [],[], [], [],[], [], [],[], []];
	
	var aptnum_list = [];
	// assign samples to bins (minus 1 for zero-indexing)
	indivdata.forEach( function(addr_record) {
		var num = (addr_record.apt_num === null) ? null : addr_record.apt_num;
		aptnum_list.push(num);
		var rounded = nextNearest(addr_record.bll, 5);
		var idx = rounded/5 - 1;
		bins[idx].push(addr_record);
	});

	// global var 'dunit' holds apartment-level data, see getAptLevelData()
	dunit = getAptLevelData( indivdata, aptnum_list, true );

	// set dimensions for detail/tab panes
	setParams("#detail-box", dims.indiv.detailbox);
	setParams("#details-box-upper", dims.indiv.detailupper);
	setParams("#tab-bar", dims.indiv.tabbar);

	// stop loading spinner animation 
	d3.select('#loading').style('display','none');
	if (spinner !== undefined) { spinner.stop(); }

	// fade in page elements, draw graph
	$.when($("#intro, #vis, .detail-family-upper, .detail-family-box, .display.container, #upper-display-group, #individual-map, #tab-bar, #show-all").fadeIn(1050, "linear"))
		.done( function() {

			// set event behaviors for Indiv control panel
			setControls(indivdata, bins, dunit);

			// we set the PERM versions so that barlevel data doesn't screw up 'show all'
			dcomplete_PERM = indivdata;
			dunit_PERM = dunit;

			if (graphview == "histogram") 		{ createHistogram( bins, indivdata, dunit ); } 
			else if (graphview == "linegraph") 	{ createLineGraph( indivdata, dunit, "cardinal" ); 					}
		});

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: 	createLineGraph(data, dunit, smoothing)
// PURPOSE:  	creates line graph of building testing & events history
//
// PARAMETERS: 	Object data: 	all data for building
//				Object dunit: 	per-unit information 
// 				Str smoothing: 	defines smoothing type (eg. linear, cardinal, etc)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function createLineGraph(data, dunit, smoothing) {

	d3.selectAll('.svg').remove();

	svg = d3.select('#vis')
			.style('width', '600px')
			.append('svg')
				.attr({
					class: 'svg',
					width: dims.indiv.linegraph.w,
					height: dims.indiv.linegraph.h
				});

	// we made this extra div/svg combo just to print the linegraph on
	// (otherwise the tooltip tracker ball would start at #vis.offsetLeft and not at the beginning of the line)
	svgline = d3.select('#line-canvas')
					.style('display', 'inline-block')
					.append('svg')
						.attr('class', 'svg')
							  .attr({
								width: 522,
								height: 550
							  });

	// set linegraph domain based on min, max dates (either extrema for blood sample dates or inspection events)
	scales.individual.x.linegraph.domain = [
		new Date(d3.min(data, function(d) { return (d.sample_date !== undefined) ? d.sample_date : d.event_date; })),
		new Date(d3.max(data, function(d) { return (d.sample_date !== undefined) ? d.sample_date : d.event_date; }))
	];

	// x-axis is always time
	x = d3.time.scale()	
				.domain(scales.individual.x.linegraph.domain)
				.range(scales.individual.x.linegraph.range);
	// y-axis is always BLL bins
	y = d3.scale.linear()	
				.domain(scales.individual.y.linegraph.domain)
				.range(scales.individual.y.linegraph.range);
			
	y_axis = d3.svg.axis()
					.scale(y) 
					.ticks(20)
					.orient("left");

	x_axis = d3.svg.axis()
					.scale(x)
					.ticks(8)
					.orient("bottom");

	g_yax = setAxisGroup('yaxis','indiv','linegraph',svg);
		g_yax.call(y_axis);
	g_xax = setAxisGroup('xaxis','indiv','linegraph',svg);
		g_xax.call(x_axis);

	var yaxis_text = setAxisText('yaxis','indiv','linegraph',g_yax);
	var xaxis_text = setAxisText('xaxis','indiv','linegraph',g_xax);

	updateAxisText("","y","linegraph","individual");
	updateAxisText("","x","linegraph","individual");	

	var line = d3.svg.line()
		.interpolate(smoothing)
	    .x(function(d) { return x(new Date(d.event_date)); })
	    .y(function(d) { return y(d.bll); });

	// I guess this reveals control panel elements for linegraph?  not sure we need this anymore.
	d3.selectAll('.linegraph-control').style('display', 'inline-block');

	// click behavior for #smoothing, basically redraws line with/without smoothing function
	d3.select('#smoothing')
		.on('click', function() {
			
			var smoothing = (d3.select('#smoothing').property('checked')) ? 'cardinal' : 'linear';
			createLineGraph( data, dunit, smoothing );

		});

	// this 'allevents' definition deals with there being different object proerties (.sample_date, .event_date_actual),
	// where we really would prefer all 'event' type properties to be of the same name.  so we call them all 'event_date'
	var allevents = [];

	// for merging two arrays of objects:
	// http://stackoverflow.com/questions/14665295/merging-two-object-arrays-in-javascript
	allevents.push.apply(allevents, eventsdata);
	allevents.push.apply(allevents, data);

	for (var i = 0; i < allevents.length; i++) {
		if (allevents[i].sample_date !== undefined) {
			allevents[i].event_is_test = true;
			allevents[i].event_date = allevents[i].sample_date;
		} else if (allevents[i].event_date_actual !== undefined) {	
			allevents[i].event_is_test = false;
			allevents[i].event_date = allevents[i].event_date_actual;
			delete allevents[i].event_date_actual;
		}
	}

	// sort by date
	data.sort(
      	function(a, b) { 
      		return d3.ascending(a.event_date, b.event_date); 
      	});

	allevents.sort(
		function(a,b) {
			return d3.ascending(a.event_date, b.event_date);
		});

	// draw path, using line()
	var path = svgline.append("path")
		.attr("class","line")
		.attr("id", "linepath")
      	.attr("d", line(data));

    // this whole next section with path_obj, path_len, and stroke-dash attributes is all part of the effort
    // to get the line to actually draw from left to right when it renders.  

	// explanation of stroke-dasharray vs -dashoffset:
	// http://css-tricks.com/svg-line-animation-works/

	// linegraph tracker ball based off of:
	// http://stackoverflow.com/questions/12431595/how-do-i-return-y-coordinate-of-a-path-in-d3-js


	var path_obj = path.node();
	var path_len = path_obj.getTotalLength();

    path
      .attr("stroke-dasharray", path_len )
      .attr("stroke-dashoffset", path_len)
      .transition()
        .duration(2000)
        .ease("linear")
        .attr("stroke-dashoffset", 0)
      	.each("end", drawPoints);

	var accuracy = 2; 

	// hover_circle is an svg circle element that shows up on top of tooltip circles when moused-over, giving
	// the appearance that the moused-over circles get a color fill (invisible otherwise)
	var hover_circle = svgline.append("circle")
					      .attr("r", 5)
					      .attr("class", "zebrafinch")
					      .style('visibility','hidden');

	// drawPoints() makes a circle over each x/y coordinate on our path where some event occurs
	//
	// 				each circle looks 'hollow', and is filled in on mouseover using 
	// we keep it inside createLineGraph() because it's called from .each(), and I didn't both to make a function
	// wrapper so I could pass arguments.  instead, i just made the scope of 'allevents' global within the
	// createLineGraph() function, so we can refer to it within drawPoints() directly.  kind of hacky.
	function drawPoints() {

		// bind 'allevents' to circles, set positions
	    svgline.selectAll(".event-point")
			.data(allevents)
			.enter()
			.append("circle")
				.attr('class', 'event-point')
				.attr('r', 3)
				.attr('cx', function(d) { 
					return x(new Date(d.event_date));
				})
				.attr('cy', function(d) {
					return (d.event_is_test) ? y(d.bll) : findYatXbyBisection(x(new Date(d.event_date)), path_obj, 0.1);
				})
				.style('visibility', 'hidden');
	}

	// click behavior for show tooltip - reveals .event-point class circles
	d3.select('#show-tooltip')
		.on('click', function() {
			d3.selectAll('.event-point')
				.style('visibility', function() { 
					return (d3.select('#show-tooltip').property('checked')) ? 'visible' : 'hidden'; 
				});
		});

	// set movement behavior when tooltips are turned on
	// we track the cursor's x position within our svg, and highlight events marked along the path object that 
	// align with the cursor's X.  
	//
	// we're basically constantly computing the cursor's X and comparing it with any known events that have nearby Xs.
	// this gets a little clunky if there are, say, hundreds of events, but most buildings don't have that many, and it
	// works well enough as-is.  i looked around online, and couldn't find a better implementation than this one.

	var offset_left = parseInt(d3.select('#line-canvas').style('left').slice(0,-2));

	svgline
		.on("mousemove", function() {
			if (d3.select('#show-tooltip').property('checked')) {

				// show hover-circle
				hover_circle.style('visibility','visible');

				// get x coord (we subtract offset_left, which is offset of #line-canvas div from the left edge of window)
			    var x = d3.event.pageX - offset_left; 
				var pos;
				// .getPointAtLength(i) method gets X coord at given point in path
				// here, we go through all the paths up until the current X position, and then stop
				// the purpose is to figure out the X coord that the path is on, that corresponds to mouse position anywhere
				// along the y-dimension on the graph canvas.  (so you don't have to trace the path line exactly)
			     for (i = x; i < path_len; i+=accuracy) {
			        pos = path_obj.getPointAtLength(i);
			         if (pos.x >= x) {
			           break;
			         }
			      }

			    // now that we have the corresponding path position, display the hover_circle at that point.
				hover_circle
					.attr("cx", pos.x)
					.attr("cy", pos.y);

				// check if we're hovering over an Event along the path, then get the text info for that event
				var tooltip_html = findEvent(pos.x, allevents);
				
				// if there's Event data to show, then show it in the tooltip box (which floats near the path line)
				if (tooltip_html !== undefined) {

					d3.select('#tooltip')
						.style('display', 'inline-block')
						.style('left', function() { return String( Math.floor( pos.x +110))+"px"; })
						.style('top', function()  { return String( Math.floor( pos.y + 20))+"px"; })
						.html(tooltip_html);

				// otherwise, keep tooltip from displaying
				} else {

					d3.select('#tooltip').style('display', 'none');
				}
			}
		})
		.on("mouseout", function() { 
			d3.select('#tooltip').style('display', 'none');
			hover_circle.style('visibility', 'hidden'); 
		});
    
    // draw the unit or test-level data table which appears to the lower right of the screen
	if (!table_exists) { createTable( "indiv", data, dunit, "unit" ); }

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: createHistogram( bins, indiv_bldg, dcomplete, dunit)
// PURPOSE:  creates histogram for individual-building page (frequency of tests at bins spaced every 5 bll)
//
// PARAMETERS: 	Array bins: 	array of arrays, keeps track of how many tests fall into each 5-BLL bin
//				Obj dcomplete:  all data for this single building
//				Obj dunit: 		unit-level information (ie. for each apartment, if we have that info)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function createHistogram( bins, dcomplete, dunit) {

	d3.selectAll('.svg').remove();

	// if linegraph was on before, hide controls 
	d3.selectAll('.linegraph-control').style('display', 'none');
	
	// find which bin has the highest frequency of tests, then set the x-scale domain by maxfreq
	var maxfreq = 0;
	bins.forEach( function(x) { if (x.length > maxfreq) {maxfreq=x.length; } });
	scales.individual.x.histogram.domain = [0, maxfreq];
	
	// histogram can be drawn on #vis div
	var svg = d3.select("#vis")
			.style('width', function() { return dims.indiv.histogram.w+'px'; })
			.append("svg")
				.attr({
					class: 'svg',
					width: dims.indiv.histogram.w,
					height: dims.indiv.histogram.h
				});
	
	// y scale is ordinal because we use bins from 0-100, by jumps of 5
	var y = d3.scale.ordinal()
			.domain(scales.individual.y.histogram.domain)
			.rangePoints(scales.individual.y.histogram.range, 1);

	var x = d3.scale.linear()	
				.domain(scales.individual.x.histogram.domain)
				.range(scales.individual.x.histogram.range);

	var y_axis = d3.svg.axis()
					.scale(y) 
					.tickValues(y.domain().map(function(d, i) { return (i+1)*5; }))
					.orient("left");

	// getting ticks right for this graph x-axis is annoying
	// basically we want them to be evenly spaced, based on the range
	// this may be overthinking it, but it's what i came up with awhile ago and i haven't touched it since.
	var x_axis = d3.svg.axis()
					.scale(x)
					.tickValues( function() {
						var dmax = x.domain()[1];
						var digits = dmax.toString().length-1 ;
						var dmax_roundedup = Math.ceil(dmax/(Math.pow(10,digits)))*(Math.pow(10,digits));
						var first_tick = Math.ceil(dmax_roundedup/10);
						var ticks = [];
						for (var i = 0; i <= 8; i++) { ticks.push(first_tick*i); }
						return ticks;
					})
					.orient("bottom");

	var g_yax = setAxisGroup('yaxis','indiv','histogram',svg);
		g_yax.call(y_axis);
	var g_xax = setAxisGroup('xaxis','indiv','histogram',svg);
		g_xax.call(x_axis);

	var yaxis_text = setAxisText('yaxis','indiv','histogram',g_yax);
	var xaxis_text = setAxisText('xaxis','indiv','histogram',g_xax);

	updateAxisText("","y","histogram","individual");
	updateAxisText("","x","histogram","individual");	

	// draw histogram bars		
	var bars = svg.selectAll(".bars")
			.data(bins)
			.enter()
			.append("rect")
				.attr("class", "bars")
				.attr("id", function(d,i) {return "bin"+i;})
					
					// on mouseover, change color
					.on("mouseover", function(d,i){ d3.select(this).attr("class","zebrafinch"); })
					.on("mouseout", function(){ d3.select(this).attr("class","bluebar"); })

					// on click (should be dbl-click?), change table display to show only blood tests from this bin
					// it's a bit of a pain to keep track of where changes to the table display are coming from,
					// that's why we have classes like 'barlevel_on' and vars 'show_barlevel_data'...
					// see createTable() for more on this.
					.on("click", function(d) {
					
						var already_on = d3.select(this).classed("barlevel_on");
						var ttype;

						last_clicked = "bar";

						d3.select(this).classed("barlevel_on", function() { return (already_on) ? false : true; });
						show_barlevel_data = (already_on) ? false : true;
						
						if( show_barlevel_data ) {
							var barlevel_apt_array = getAptLevelData( d, [], false );
							ttype = "person";
							if (showAllStatus() === true) {toggleShowLink();}
							createTable("indiv", d, barlevel_apt_array, ttype);
						} else {
							ttype = "unit";
							if (showAllStatus() === false) {toggleShowLink();}
							createTable("indiv", dcomplete, dunit, ttype);
						}
					})
					
			// load actual bars
			.transition()
			.duration(1050)
				.attr("x", function() { return dims.indiv.histogram.xscale_start; })
				.attr("y", function(d,i) { return y((i+1)*5)-10; })
				.attr("height", 21)
				.attr("width", function(d,i) { return x(d.length)-dims.indiv.histogram.xscale_start; })
				.attr("class", "bluebar");
	
	if (!table_exists) { createTable( "indiv", dcomplete, dunit, "unit" );	}		
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: createTable(page, dcomplete, dunit, tabletype)
// ARGS: 	 Str page: 		'multi' or 'indiv'
//			 Obj dcomplete: full data for either all buildings in query ('multi') or single bldg ('indiv')
//			 Obj dunit: 	(for indiv) apt-level aggregate information for a single bldg
//			 Str tabletype: determines whether table will display dunit or dcomplete data
//			 
// PURPOSE:  generates table containing high-level building info (address, inspection status, risk factor)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function createTable(page, dcomplete, dunit, tabletype) {

	var div, row_data, column_data, header_data, cells;

	if (page == 'multi') {

		div = "#table-container";
		header_div = "#detail-display-group";

		table_exists = true;

		row_data = dcomplete;

	/* 	I don't remember my reasoning when I build this column_data object (and, in the page=='indiv' case, 
		the column_data_person and _unit objects), but it seems a bit weird to me now.
		
		The key names for each sub-object are also repeated as key/value pairs inside each sub-object,
		...this may just have been tiredness/laziness on my part.  I never bothered to fix it, but it's ugly.
	 	It may also have something to do with the way we load header_data, using the $.map() method, below.	
	*/	
		column_data = {
			address: {key: "address", description: "Address", width: "40%"}, 
			risk_level: {key: "risk_level", description: "Code", width: "10%"}, 
			predicted: {key: "predicted", description: "Risk", width: "15%"}, 
			init_date: {key: "init_date", description: "Insp", width: "10%"}, 
			comply_date: {key: "comply_date", description: "Comply", width: "13%"},
			n_high_tests_build: {key: "n_high_tests_build", description: "Tests", width:"12%"}
		};

	// put header values into useable form for .enter() when we make the header table <td> elements		
		header_data = $.map(column_data, function(value, index) { return [value]; });	

	// resize table for 'multi' page view
		d3.selectAll('#details-table, #header-table').style('width', '360px');
	
	} else if (page == 'indiv') {

		/* 	within the 'indiv' table rendering, the difference between 'unit' and 'person' keeps showing up.

			this refers to the fact that users can either select a per-apartment-unit view of the data, or 
			a per-person view (actually, per-blood-test).  There are a few toggles and variables that keep
			track of which view we're in. 

			users can go back and forth between the unit and person views by either clicking the link at
			the bottom right of the table ("Show All" vs "Show by unit"), or by double-clicking a table
			row in the "Show by unit" view.

			in the histogram view, it gets a bit more confusing because users can also click on histogram bars
			to populate the table with only the blood tests that belong in that bin/bar.  so we need to keep 
			track of what's happening here, too - for example, the bottom-right link text changes based on what's
			hapenning with histogram-bar clicks.  

			a lot of the variables and toggles in this section are used
			to keep track of what state the table should be in, and how it got there.
		*/

		div = "#table-container";
		header_div = "#detail-display-group";

		// clear any current tables
		if (head_table !== undefined) { removeTableElements(); }

		// unless we have unusual circumstances, dcomplete and dunit are assigned to their 'permanent' values
		if (!show_barlevel_data || (tabletype == "unit" && last_clicked == "link")) { 
			dcomplete = dcomplete_PERM;
			dunit = dunit_PERM;
		}

		table_exists = true;
		
		row_data = (tabletype == "unit") ? dunit : dcomplete;

		var column_data_person = {
			apt_num: {key: "apt_num", description: "Apt #", width: "10%"}, 
			last_name: {key: "last_name", description: "Last Name", width: "26%"}, 
			first_name: {key: "first_name", description: "First Name", width: "24%"}, 
			bll: {key: "bll", description: "BLL", width: "10%"}, 
			sample_date: {key: "sample_date", description: "Sample Date", width: "20%"}, 
			age_at_sample_yrs: {key: "age_at_sample_yrs", description: "Age", width: "10%"}
		};	
		
		var column_data_array_person = $.map(column_data_person, function(value, index) { return [value]; });	
		
		var column_data_unit = {
			apt_num: {key: "apt_num", description: "Apt #", width: "10%"}, 
			num_tests: {key: "num_tests", description: "# Tests", width:"10%"},
			bll: {key: "bll", description: "Mean BLL", width: "13%"}, 
			most_recent_sample: {key: "most_recent_sample", description: "Recent Sample", width: "20%"}, 
			most_recent_insp: {key: "most_recent_insp", description: "Recent Inspection", width: "20%"}, 
			compliance: {key: "compliance", description: "Complied", width: "12%"}, 
			risk_level: {key: "risk_level", description: "Risk Factor", width: "15%"}
		};
		
		var column_data_array_unit = $.map(column_data_unit, function(value, index) { return [value]; });	
		column_data = (tabletype == "unit") ? column_data_unit : column_data_person;
		header_data = (tabletype == "unit") ? column_data_array_unit : column_data_array_person;
	}

	// we ended up making two tables here - one just for the header row
	// this isn't desirable, but we want header row's position stable as we scroll down 
	// there's a jquery table.floatThead() method, but it had resizing issues that looked bad...so this.

	// make header table	
		head_table = d3.select(header_div)
			.append("table")
				.attr("id", "header-table")
				.style('top', function() {return (page == 'multi') ? "0px" : "0px";})
				.style('width', function() { return (page=='indiv') ? '565px' : '390px'; })
			.append("tr");

		// load header <td> content from header_data var
		var heads = head_table.selectAll("td")
			.data(header_data);

		heads.enter()
				.append("td")
					.attr('class', 'header-td')
					.style("width", function(d,i) { return d.width; })
					.text(function(d,i) { 
						toggles[i] = 0;
						return d.description; 
					}) 
					.on("click", function(d,i) {
						toggles[d.key] ? sortTable(d.key, 1, secondary_key) : sortTable(d.key, 0, secondary_key);	// sort asc/desc
						toggles[d.key] = toggles[d.key] ? 0 : 1;	// update toggle
						setZebraShades(); 		
						toggleCursor(d.key, this);	// toggle cursor shape
						last_clicked = "table";
					})
					.on("mouseover", function(d,i) {
						toggleCursor(d.key, this);	// toggle cursor shape
					});

	// add table elements
		table = d3.select(div).append("table")
					.attr("id", "details-table")
					// table should be wider on the indiv pages than on the multi pages
					.style('width', function() { return (page=='indiv') ? '565px' : '390px'; });

	// add rows based on queried building data
		rows = table.selectAll("tr")
			.data(row_data);

		rows.enter()
			.append("tr")
				.style('height', '25px')
				.attr("data-rowid", function(d) { return "row-"+d.bldg_id; })
				.on("mouseover", function(d,i) { 
					// highlight row with orangey color (class:zebrafinch, not sure why i called it that)
					d3.select(this).classed("zebrafinch", true);  
					/* 	the 'code yellow' circle is actually the same color as the row highlight color
						any kind of yellow or orange doesn't contrast well with the row highlight, and i 
						kind of like the orange highlight color...so this function figures out whether it's
						a <td> with a 'code yellow' circle, and if so, replaces the &bull; character with a 
					 	ringed circle (HTML code: &#9702;).  it's kind of a hack, but i only noticed it at the end.
					*/
					d3.select(this).selectAll("td").html(function(d,i) { 
						return (i == 1) 
							? (page == 'multi') 
								? (d3.select(this).select("div").attr("class") == "yellow")
									? '<div class="ringed" style="margin-top:3px;font-size:34pt;">&#9702;</div>'
									: d3.select(this).html()
								: d3.select(this).html()
							: d3.select(this).html();
					});
					// enlarge and highlight building dots on map
					d3.select('#dot-'+d.bldg_id).attr('r', 7);
					d3.select('#dot-'+d.bldg_id).style('fill', 'magenta');
					// highlight building dots on scatterplot
					d3.select('[data-bldgid=circle-'+d.bldg_id+']').style('stroke-width', "5px");
				})
			// change back to original bg-color on mouseout
				.on("mouseout", function(d) { 
					d3.select(this).classed("zebrafinch", false); 
					d3.select(this).selectAll("td").html(function(d,i) { 
						// now return any yellow circles to their &bull; character
						return (i == 1) 
							? (page == 'multi') 
								? (d3.select(this).select("div").attr("class") == "ringed")
									? '<div class="yellow" style="margin-top:3px;font-size:34pt;color:#fdae6b">&bull;</div>'
									: d3.select(this).html()
								: d3.select(this).html()
							: d3.select(this).html();
					});
					d3.select(this).classed("zebrafinch", false); 
					// return map dots to normal
					d3.select('#dot-'+d.bldg_id).attr('r', 4);
					d3.select('#dot-'+d.bldg_id).style('fill', 'red');
					// return scatterplot dots to normal
					d3.select('[data-bldgid=circle-'+d.bldg_id+']').style('stroke-width', "1px");
				})	
				// onclick, set current_building_id with bldg_id, enter address string into search box
				.on("click", function(d) {
						current_building_id = d.bldg_id;
						d3.select('#search-box').property('value', function() { return (public_demo) ? "1234 XXXXX ST" : d.address; });
					
				})
				// dblclick loads /explore.php "Indiv-histogram" page view
				// passes query object as JSON string, fake <form>, POST method
				.on("dblclick", function(d) { 
					if (page == "multi") {
						transition(null, d.bldg_id); 
					} else if (page == "indiv") {
						if (tabletype == "unit") {
							removeTableElements();
							var ttype = toggleShowLink();
							createTable("indiv", dcomplete, dunit, ttype);
						}
					}
				});
	
	if (page == "multi") {

	// add cells based on building query data
		cells = rows.selectAll("td")
		.data(function(row) {
			return d3.keys(column_data).map( function(colname) {
				return { column: colname, value: row[colname], proba: String(parseFloat(row.predicted).toFixed(3) * 100).substr(0,4) };
			});
		  })		
	// for more on d3 tables see: http://www.d3noob.org/2013/02/add-html-table-to-your-d3js-graph.html
		.enter()
		.append("td")
			// i don't think we use all these classes anymore.
			.attr("class", function(d,i) { return d.column+" clickable-td details-table-td"; })
			.style("width", function(d,i) { return column_data[d3.keys(column_data)[i]].width; })
			.style("height", "20px")
			// format table cell values based on field content
			.html(function(d) { 

				if (d.column == "predicted") {

					return '<span style="font-size:10pt;">'+d.proba+'%'+'</span>';

				} else if (d.column == "risk_level") {

					var col,colclass;
					if 		(d.proba > 60) { col = '#d1303b'; colclass = 'notyellow'; 	}
					else if (d.proba > 30) { col = '#fdae6b'; colclass = 'yellow';		}
					else if (d.proba > 0)  { col = 'green';   colclass = 'notyellow';	}
					return '<div class="'+colclass+'" style="margin-top:3px;font-size:34pt;color:'+col+';">&bull;</div>';

				} else if (d.column == "address") {

					var addr = d.value.split(",")[0];
					var short_addr = addr.slice(0, addr.lastIndexOf(" "));

					// this is for public demo purposes, we hide the address names:
					var parts = short_addr.split(" ");
					var scrambled = parts[2].replace(/\w/g, "X");
					var scrambled_addr = parts[0] + " " + parts[1] + " " + scrambled;

					return (public_demo) ? scrambled_addr : short_addr; // takes off 'chicago, il' from address ending, as well as st/ave/rd/etc

				} else if (d.column == "init_date" || d.column == "comply_date") {

					if (d.value !== null) {
						var topmargin = "";
						if (page == 'multi') { topmargin = 'style="margin-top:6px;height:70%;"'; }
						return '<img class="checkmark" '+topmargin+' src="http://datapsych.com/test/black-check.png" />';
					} else {
						return '<div style="margin-top:3px;font-size:12pt;color:black;">&#10006;</div>';
					}

				} else if (d.column == "n_high_tests_build") {

					var num = (d.value !== null) ? d.value : 1;
					return '<div style="margin-top:4px;font-weight:900;">'+num+'</div>';
				}
				
			});

	} else if (page == "indiv") {

		// table is default sorted by either apt_num or sample_date, depending on unit/person view
		var sort_field = (tabletype == "unit") ? "apt_num" : "sample_date";

		cells = rows.selectAll("td")
			.data(function(row) {
				return d3.keys(column_data).map( function(colname) {
					return { column: colname, value: row[colname] };
				});
			  })		
		// for more on d3 tables see: http://www.d3noob.org/2013/02/add-html-table-to-your-d3js-graph.html
			.enter()
			.append("td")
				.attr("class", function(d,i) { return d.column; })
				.style("width", function(d,i) { return column_data[d3.keys(column_data)[i]].width; })
				.style('height', '20px')
				.html(function(d) { 
					var cell_value;
					if ((d.column == 'last_name' || d.column == 'first_name') && public_demo) {
						cell_value = d.value.replace(/\w/g, "X");
					} else {
						cell_value = d.value;
					}
					return cell_value; 

				});

		// now that the table is rendered, sort by ascending Rate (col index 2)
			sortTable(sort_field, 1);

		d3.select("#show-all")
			.on("click", function() {
				removeTableElements();
				var ttype = toggleShowLink();
				last_clicked = "link";
				createTable("indiv", dcomplete, dunit, ttype);
			});

	}

	// fade in table elements
	$('#detail-display-group, #table-container, #details-table, #header-table').fadeIn(500); 

	// set alternating row colors
	setZebraShades();
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: graph( old_pview, pview, gview, d, bins, bldg, dunit )
// ARGS: 	 Str old_pview: 'multi' or 'indiv', to know where we're coming from
//			 Str pview: 	'multi' or 'indiv', to know where we're going to
//			 Str gview: 	'map', 'scatter', 'histogram', 'linegraph'
//			 Obj d: 		full building dataset
//			 Array bins: 	histogram bins for single building, see loadIndiv()
// 			 Obj dunit: 	per-unit data, see loadIndiv() 
//			 
// PURPOSE:  main graph switching function between all four graph views on /explore.php
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function graph( old_pview, pview, gview, d, bins, dunit ) {

	/*	Notes:

		- graph() is the main view-switching workhorse - anytime we switch page views or graph views,
		it happens through this function.  

		- 'view' var is a hyphenated, two-part string: part 1 = page view, part 2 = graph view.

		- there are five possibilities: home-home (landing page)
										multi-map 
										multi-scatter
										indiv-histogram
										indiv-linegraph

		- the function is basically one large conditional statement that branches into each of these 5 choices

		- within each choice, we check to see whether the transition is only graph view (ie. within the same pageview),
		  or requires a page view transition as well as a graph view transition.  
	*/

	var view = pview+"-"+gview;
	pageview = pview;
	graphview = gview;

	// set 'Graph View' dropdown to current view
	$(".graphview").val(view);

	// "home-home" = go to landing page (/index.php)
	// pass data via JSON string
	if (view == "home-home") {

		current_params.returncount = current_params.returncount;
		var qstring = JSON.stringify({params:current_params,data:postdata.data});

		$.when( $('#container').fadeOut(500) )
			.done( function() { 
				startSpinner('midpage');
				setTimeout( function() { 
					var form = $("<form />")
								.attr({ method: "POST", action: "/lead/" })
								.append( $('<input />').attr({
								            type: 'hidden',
								            name: 'json',
								            value: '{"postdata":'+qstring+'}'
								        	}) 
								);
		        	$("body").append(form);
		        	form.submit();
		        }, 500);
			});
		return false;

	// load multi view, scatterplot
	} else if (view == "multi-scatter") {

		// first check to see if we need pview (ie. multi-to-indiv or vice-versa) transition
		// if so, transition with proper parameters
		// if not, do in-page transition
		if (old_pview == "multi") {

			d3.select('#map-canvas').style('display','none');
			d3.select('#multi-box').style('display','inline-block');

			showLegend("yes");
			createScatter(multidata);
			changeControlFeatures();

        	d3.select('#loading').style('display','none');
        	$('#container').fadeIn(300);

		} else if (old_pview == "indiv") {

			// first, fade out page elements - there are probably extra/redundant elements here, fyi.
			$.when($("g, #intro, .bars, .svg, table, #line-canvas, #individual-controls, #upper-control-group, .linegraph-control, .upper.control, .detail-family-upper, #detail-box, #tab-bar, #show-all").fadeOut(1000))
				.done(function() {

					// then erase svg/html elements that will be replaced
					d3.selectAll("g, .bars, .svg, table, tr, td").remove();

					// now begin page load process
					startload( {addr:d, pview:pview, gview: "scatter", tview:"display-tab"} );
				});
		}

	// load multi view, google maps with building-dot overlay
	} else if (view == "multi-map") {

		if (old_pview == "multi") {

			if (g_xax !== undefined) { g_xax.style('display','none'); g_yax.style('display','none'); }

			d3.select('#map-canvas').style('display','inline-block');
			d3.select('#multi-box').style('display','none');

			showLegend("no");

			createMainMap(multidata);
			changeControlFeatures();	

			d3.select('#loading').style('display', 'none');

	  	} else if (old_pview == "indiv") {
			
			$.when($("g, #intro, .bars, .svg, table, #line-canvas, #individual-controls, #upper-control-group, .upper.control, .linegraph-control, .detail-family-upper, #detail-box, #tab-bar, #show-all").fadeOut(1000))
				.done(function() {
					d3.selectAll("g, .bars, .svg, table, tr, td").remove();
					startload( { addr:d, pview:pview, gview:gview, tview:"display-tab" } );
				});
	  	}

	// load indiv view, histogram
	} else if (view == "indiv-histogram") {

		if (old_pview == "multi") { 

			startSpinner('midpage');
			
			$.when(
				$("#intro, .detail-family, .detail-family-box, svg, #tab-bar, #table-container, .detail-family-upper, #header-table, #legend-box, .overlay2, #map-canvas, #return-count").fadeOut( 500, "linear")
			).done( function() { preploadIndiv( {bldg_id:d.bldg_id, getevents:"false", pview:pview, gview:gview, oldpview:old_pview } ); });

		} else if (old_pview == "indiv") { 
			d3.selectAll('.linegraph-control').style('display', 'none');
			createHistogram(bins, d, dunit); 
		}

	// load indiv view, linegraph (aka Timeline)
	} else if (view == "indiv-linegraph") {

		if (old_pview == "multi") { 

			startSpinner('midpage');	

			$.when(
				$("#intro, .detail-family, .detail-family-box, svg, #tab-bar, #table-container, #header-table, #legend-box, .overlay2, #map-canvas, #return-count").fadeOut( 500, "linear")
			).done( function() { preploadIndiv( {bldg_id:d.bldg_id, getevents:"false", pview:pview, gview:gview, oldpview:old_pview } ); });
		} 

		else if (old_pview == "indiv") { 

			var smoothing = (d3.select('#smoothing').property('checked')) ? 'cardinal' : 'linear';
			createLineGraph(d, dunit, smoothing); }
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: callAjax()
// PURPOSE:  sends query parameters to /ajax.php, controls response and next steps
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function callAjax(params, limit) {

	$.ajax({
		// async set to false here because otherwise we don't get ajax response set to variables in time for them
		// to be used in subsequent lines of code
		async: false,
	    url: "ajax.php",
	    type: "POST",
	    dataType: "json",
	    data: params,
	    error: function(requestObject, error, errorThrown) {
            console.log(error);
            console.log(errorThrown);
        },
	    success: function(response) {

	    	// set Graph View dropdown to current selection
			$(".graphview").val(params.pview+'-'+params.gview);

			/* .getevents = true occurs for indiv pageload, but it's only set to true once we run through a first ajax call
				which gets indiv bldg data without events data. this seems unnecessary to me now, my guess is i was just 
				rusty with SQL and didn't want to take the time to figure out the right kind of join to get all data at once.

				see /ajax.php for more.
			*/
	        if (params.getevents == 'true') {

	        	eventsdata = response;
	        	loadIndiv();

	        /* 	get multi-bldg data (usually this is coming from an updated filters/search parameters request)
	        	on return, check to see if # bldgs exceeds the set 'limit' var.  if so, popup a warning and ask what
	        	user wants to do.  

	        	see responseChoice() for more.
	        */
	        } else if (params.pview == "multi") {

	        	// hide loading animation div
	        	d3.select('#loading').style('display','none');

	        	// fade back in page elements
	        	$('#intro, #vis, #map-canvas, #detail-box, #tab-bar, #header-table, #table-container').fadeIn(300);

	        	// if response is too big, throw warning
	        	if (response.length > limit) {	

					d3.select('#response-size').html(response.length);
					d3.select('#response-choice-submit')
						.on('click', function() {
							responseChoice( $('input:radio[name=response-choice]:checked').val(), response, params);
						});
					d3.select("#response-popup").style("display", "inline-block");

	        	} else {

	        		// set global
	        		multidata = response;
					loadMulti(params);
	        	}
	        
	        // indiv-bldg query, round 1 (round 2 gets events data, see above)
	        } else if (params.pview == "indiv") {

	        	// set global
	        	indivdata = response;

				setDomainValues();
				setScales(domain_values);	

				// making a fullname field is useful for table display later on.  
				// probably easier just to make this a field in DB...never got around to it.
	        	for (var i = 0; i < indivdata.length; i++ ){
	        		indivdata[i].fullname = indivdata[i].first_name + " " + indivdata[i].last_name;
	        	}
				params.getevents = 'true';
				params.insp_id = indivdata[0].insp_id;

				// here we check to see if this building has ever been inspected by CDPH
				// if so, it has events data, and we want to go and retrieve that, too, so re-query DB
				if (params.insp_id !== null) { callAjax(params); } 
				else { loadIndiv(); }

			// indiv-bldg search from search query box
	        } else if (params.pview == "search") {

	        	ajax_search_addr = response;
	        }
	    }
	});
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: getQueryParams()
// Purpose:  assembles query parameters for AJAX DB call
//
//////////////////////////////////////////////////////////////////////////////////////
function getQueryParams() {

	var bounds_arr, minlat, minlon, maxlat, maxlon = "";

	if (d3.select('#filter-maptool').property('checked')) {

		bounds_arr = current_tool_bounds.toUrlValue().split(",");

		minlat = bounds_arr[0];
		minlon = bounds_arr[1];
		maxlat = bounds_arr[2];
		maxlon = bounds_arr[3];

	} else if (d3.select('#filter-mapbox').property('checked')) {

		bounds_arr = current_bounds.toUrlValue().split(",");

		minlat = bounds_arr[0];
		minlon = bounds_arr[1];
		maxlat = bounds_arr[2];
		maxlon = bounds_arr[3];
	} 

	var measure = d3.select("#filter-bll-measure-category").node().value;
		var measure_val = d3.select("#bllmeasure").property("value");

	var abatement = d3.selectAll("#filter-compliance-group").property("value");

	var ntests = "n_high_tests_build";
		var ntests_val = d3.select("#n_high_tests_build").property("value");

	var samplewhen = d3.select("#filter-testperiod").node().value;

	var sincetype = d3.select("#filter-sincetype").node().value;

	var sincelast = d3.select("#sincelast").property("value");

	var housebuilt = d3.select("#filter-housebuilt").node().value;

	var housetype = d3.select("#filter-htype").node().value;

	var addr_vector = [];

	$("input:checkbox[name=address-vector]:checked")
						.each(function() {
						    addr_vector.push( $(this).val().split("-")[1] );
						});
	addr_vector = addr_vector.join(",");

	var params = { 	
					"getevents":'false',
					"oldpview":"multi",
					"pview":pageview, 
					"gview":graphview,
					"tview":"control-tab",
					"meas": measure, 
					"meas_val": measure_val, 
					"abatement": abatement,
					"n_high_tests_build":ntests_val, 
					"sample_when":samplewhen, 
					"sincetype":sincetype, 
					"sincelast":sincelast,
					"housebuilt":housebuilt, 
					"housetype":housetype, 
					"addr_vector":addr_vector,
					"minlat":minlat,
					"maxlat":maxlat,
					"minlon":minlon,
					"maxlon":maxlon
				};

	startload(params);

}




/*
//////////////////////////////////////////////////////////////////////////////////////

					END MAJOR FUNCTIONS:
					
					startload()

					loadMulti()
						createMainMap()
						createScatter()

					loadIndiv()
						createHistogram()
						createLineGraph()

					createTable()

					graph()

					callAjax()
					getQueryParams()

//////////////////////////////////////////////////////////////////////////////////////
*/


	
//					BEGIN MINOR FUNCTIONS


//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION:  drawRectangle()
// Purpose:   draws selector rectangle on map
// Reference: https://developers.google.com/maps/documentation/javascript/examples/rectangle-event
//
//////////////////////////////////////////////////////////////////////////////////////
function drawRectangle() {
	
	// Define the rectangle and set its editable property to true.
	rectangle = new google.maps.Rectangle({
		bounds: initial_bounds,
		editable: true,
		draggable: true
	});
  
	rectangle.setMap(map);
	bounds = initial_bounds;
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: updateMain(val)
// Purpose:  updates multi scatterplot after applying axis transformation (log, sqrt, etc)
//
//////////////////////////////////////////////////////////////////////////////////////

	function updateMain(d,key) {

		svg.selectAll(".bldg-circle")
			.transition()
			.duration(2000)
			.delay( function(d,i)   { return i*2; })
			.attr("cy", function(d) { 
				var maxh = y(d[key]) - radius_scale(d.n_high_tests_build);
				
				var minh = (dims.multi.scatter.h-y(d[key])) - radius_scale(d.n_high_tests_build);
				if (maxh <= 20 ) {
					return (y(d[key]) + 1.2*radius_scale(d.n_high_tests_build));
				} else if (minh < 50) {
						return (y(d[key]) - 1.2*radius_scale(d.n_high_tests_build));
				} else {
					return y(d[key]);
				}
			});
	}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setParams(paramset)
// Purpose:  shortcut function for updating/assigning lots of attributes to a d3 element
//
//////////////////////////////////////////////////////////////////////////////////////
function setParams(obj,paramset) {

	var vals = d3.values(paramset);
	
	for (var item in paramset) {
		item = item.replace("_","-");
		d3.select(obj)
			.style(item, paramset[item]);
	}
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: findEvent(xpos, d)
// PURPOSE:  checks to see if there is an Event at the current X coord of cursor, if so, get Event info
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function findEvent(xpos, d) {

	var target;
	d.forEach( function(thiscase) {

		var datatype = (thiscase.event_is_test) ? "test" : "events";

		// +/- 2px to allow for a bit of precision wiggle room on xpos
		if ( (x(new Date(thiscase.event_date)) <= (xpos + 2)) && (x(new Date(thiscase.event_date)) >= (xpos - 2)) ) {

			target = populateTooltip( thiscase, datatype );
		} 
	});
		return target;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: populateTooltip(d, type)
// PURPOSE:  fills tooltip with event data, using more readable language from tooltip_dict
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function populateTooltip(d, type) {

	var keys = { 
				test: 	["event_date", "fullname", "age_at_sample_yrs", "bll"],
				events: ["event_date", "event_text", "event_code", "event_comments"]
			   };

	var html = "";

	keys[type].forEach( function(k) {
		var usename;
		if (tooltip_dict[k] !== undefined) {

			if (k == "fullname" && public_demo) {

				usename = 'XXXX';
			} else {
				usename = d[k];
			}
			html += "<span class='search-value'>"+ tooltip_dict[k] + ":</span>"+
					"<span class='search-term'> " + usename + "</span> <br />";
		}
	});

	return html;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: responseChoice()
// PURPOSE:  determines behavior after 'too many query results' warning appears and user selects option
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function responseChoice(choice, response, params) {
	if (choice == "showall") {
		multidata = response;
	} else if (choice == "first1000") {
		// return subset based on user selection of 100/500/1000 results. default = 1000
		multidata = response.slice(0,$('#choose-result-size').val());
	} else if (choice == "cancel") {
		multidata = multidata;
	}
	d3.select('#response-popup').style('display', 'none');
	loadMulti(params);
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: preploadIndiv()
// PURPOSE:  takes necessary elements from params, passes them into callAjax()
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function preploadIndiv( params ) {

	indivdata = null;

	var ajax_params = {bldg_id:params.bldg_id, getevents:params.getevents, pview:params.pview, gview:params.gview, oldpview:params.old_pview };

	setTimeout( function() { callAjax(ajax_params, query_limit); }, 500);
	
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: removeTableElements()
// PURPOSE:  wipes out table elements before entering new data/new page view
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function removeTableElements() {

	d3.select('#header-table').selectAll("tr").remove();
	d3.select('#header-table').remove();
	table.selectAll("tr").remove();
	table.remove();
	rows.selectAll("td").remove();
	rows.remove();
	head_table.selectAll('td').remove();

}
	
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: 	findYatXbyBisection(x, path, error)
// PURPOSE: 	interpolates path pos.y from path pos.x (where no real coordinate exists)
// REFERENCE: 	http://stackoverflow.com/questions/11503151/in-d3-how-to-get-the-interpolated-line-data-from-a-svg-line
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function findYatXbyBisection (x, path, error){
	var length_end = path.getTotalLength();
	var length_start = 0;
	var point = path.getPointAtLength((length_end + length_start) / 2) ;// get the middle point
	var bisection_iterations_max = 50;
	var bisection_iterations = 0;

	error = error || 0.01;

	while (x < point.x - error || x > point.x + error) {
	// get the middle point
	point = path.getPointAtLength((length_end + length_start) / 2);

	if (x < point.x) {
	  length_end = (length_start + length_end)/2;
	} else {
	  length_start = (length_start + length_end)/2;
	}

	// Increase iteration
	if(bisection_iterations_max < ++ bisection_iterations)
	  break;
	}
	return point.y;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: toggleShowLink()
// PURPOSE:  switches show link form 'Show All' to 'Show by unit' (for Indiv table)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function toggleShowLink() {
	showunit = (showunit) ? false : true;
	var text = (showunit) ? "Show by unit" : "Show all";
	var left = (showunit) ? "1120px" : "1155px";
	var ttype = (showunit) ? "person" : "unit";
	d3.select("#show-all").style("left", left);
	d3.select("#show-all-link").html(text);
	return ttype;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: showAllStatus()
// PURPOSE:  for Indiv table, identifies whether show all link is currently available
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function showAllStatus() {
	return (d3.select("#show-all-link").html() == "Show all");
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: updateAxisText(d, axis, key, graphtype)
// Purpose:  changes axis text when graphs are drawn or transforms are made
//
//////////////////////////////////////////////////////////////////////////////////////

	function updateAxisText(d,axis,key,graphtype) {
		if (graphtype == "focus") {
			key = "all";
			d3.selectAll("."+axis+"axis-text-focus").html(scales[graphtype][axis][key].axis_text);
		} else {
			d3.selectAll("."+axis+"axis-text").html(scales[graphtype][axis][key].axis_text);

		}
	}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: 	sortTable(colname, dir, secondary)
// Purpose:  	sorts table on individual graph page with primary, secondary keys
//
// Reference: 	http://stackoverflow.com/questions/4576714/sort-by-two-values-prioritizing-on-one-of-them
//
//////////////////////////////////////////////////////////////////////////////////////
	 
function sortTable(colname, dir, secondary) {
			
	if (colname == "age_at_sample") { secondary = "last_name"; }

	d3.select("#details-table").selectAll("tr")
	.sort(function(a, b) {

		var compareA, compareB, compare2A, compare2B;

		if (!(secondary == "apt_num" || secondary == "last_name" || secondary == "first_name")) {
			compare2A = parseFloat(a[secondary]);
			compare2B = parseFloat(b[secondary]);
		} else {
			compare2A = a[secondary];
			compare2B = b[secondary];
		}
		
		if (colname == "sample_date") {
			compareA = dateToTimestamp(a[colname]);
			compareB = dateToTimestamp(b[colname]);
		} else if (colname == "bll" || colname == "age_at_sample") {
			compareA = parseFloat(a[colname]);
			compareB = parseFloat(b[colname]);
		} else {
			compareA = a[colname];
			compareB = b[colname];
		}

		return dir 
				? (d3.ascending(compareA, compareB) !== 0)
					? d3.ascending(compareA, compareB)
					: d3.ascending(compare2A, compare2B)
				: (d3.descending(compareA, compareB) !== 0)
					? d3.descending(compareA, compareB)
					: d3.descending(compare2A, compare2B)
	});
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setZebraShades()
// PURPOSE:  set all even-numbered rows to css class with gray bg-color 
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function setZebraShades() {
	d3.selectAll("tr")
		.attr("class", function(d,i) { 
			if (i%2===0) { return "greyback"; }
		});
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: toggleCursor()
// PURPOSE:  switches cursor symbol depending on which sort occurs onclick
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
	function toggleCursor(tog, obj) {
		var cursor = toggles[tog] ? "s-resize" : "n-resize";
		d3.select(obj).style("cursor", cursor);
	}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: dateToTimestamp(d)
// PURPOSE:  converts date object 'd' to milliseconds timestamp
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function dateToTimestamp(d) {
	var segments = d.split("-");
	return parseFloat(new Date(segments[0], segments[1], segments[2]).getTime());
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: changeTab(tabname)
// Purpose:  changes appearance/highlighting of tabs based on current selection
//
//////////////////////////////////////////////////////////////////////////////////////
function changeTab(tabname) {
	d3.selectAll(".selected").classed("selected", false);
	d3.select("#"+tabname).classed("selected", true);
}

		
//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: nextNearest(number, multiple)
// Purpose:  rounds up to the next nearest <multiple>
//
//////////////////////////////////////////////////////////////////////////////////////
function nextNearest( number, multiple ){
	return Math.ceil(number/multiple)*multiple;
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: highlightTab(obj)
// Purpose:  highlights tab on hover
//
//////////////////////////////////////////////////////////////////////////////////////

function highlightTab(obj) {
	var hover = d3.select(obj).classed("tab-hover");
	d3.selectAll(".tab").classed("tab-hover", false);
	d3.select(obj).classed("tab-hover", function() { return (hover) ? false : true; });
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setControls()
// Purpose:  sets behaviors for controls in indiv graph page
//
//////////////////////////////////////////////////////////////////////////////////////

function setControls(data, bins, dunit) {

	d3.selectAll(".graphview")
		.on("change", function() {

			var temp = d3.select(this).node().value;
			var new_pview = temp.split("-")[0];
			var new_gview = temp.split("-")[1];

			if (new_pview !== pageview) {

				$.when( $('#container').fadeOut(500) )
					.done( function() { 
						setTimeout( function() { 

							startSpinner('midpage');

							graph( pageview, new_pview, new_gview, data, bins, dunit ); 
						}, 500);
					});
			} else {
				graph( pageview, new_pview, new_gview, data, bins, dunit ); 
			}
		});

	d3.select("#secondary-sort-select")
		.on("change", function() {
			secondary_key = d3.select(this).node().value;
		});

	d3.select("#histogram").property("checked", true);
	d3.selectAll(".indiv-graph-toggle")
		.on("change", function() {
			if (d3.select(this).attr("id") == "linegraph") {
				var smoothing = (d3.select('#smoothing').property('checked')) ? 'cardinal' : 'linear';
				createLineGraph(data, dunit, smoothing);
			} else {
				createHistogram(bins, data, dunit);
			}

		});

	d3.selectAll(".threshold")
		.on("change", function() {
			var val = d3.select(this).attr("id");
			var event_date = null;
			if (val == "first_bad") {
				var max = 0;
				var max_ix;
				var ct = 0;
				data.forEach( function(d) {
					if (parseInt(d.bll) > max) { max = parseInt(d.bll); max_ix = ct; }
					ct++;
				});
				event_date = data[max_ix].event_date;
			} else if (val == "init_date") {
				// we need to break the loop because there are sometimes more than one INSSA date per building
				// rather than use a for-loop/break statement, we can use .every()
				// see: http://stackoverflow.com/questions/6260756/how-to-stop-javascript-foreach
				eventsdata.every( function(d) { 
					if (d.event_code == "INSSA" || d.event_code == "INSFS") { 
						event_date = d.event_date; 
						return false;
					} else {
						return true;
					}
				});
			} else if (val == "comply_date") {
				eventsdata.every( function(d) { 
					if (d.event_code == "CMPLY") { 
						event_date = d.event_date; 
						return false;
					} else {
						return true;
					}
				});
			}
			updateThreshold( val, "linegraph", event_date ); 
		});
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setTabEvents
// Purpose:  sets interactive mouse events for graph tabs
//
//////////////////////////////////////////////////////////////////////////////////////

function setTabEvents(page) {

	d3.selectAll(".tab")
		.on("click", function() { 
			if (tabview !== d3.select(this).attr("id")) { return changeDetailContent(this, page); }
		})
		.on("mouseover", function() { return highlightTab(this); })	
		.on("mouseout", function()  { return highlightTab(this); });	
}

//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: changeDetailContent(obj,page)
// Purpose:  changes content of Detail pane, depending on multi/indiv pageview
//
//////////////////////////////////////////////////////////////////////////////////////

function changeDetailContent(obj, page) {

// define graph object	
	var graph = d3.select(obj).attr("id");
	var control_id, display_id;

	if (page == "multi") {
		control_id = '#detail-control-group';
		display_id = '#detail-display-group';
	} else if (page == "indiv") {
		control_id = '.upper.control';
		display_id = '#upper-display-group';
	}

// render whatever detail-box type is selected	
	if (graph == "control-tab") {
		changeTab(graph);
		d3.select(display_id).style('display', 'none');
		d3.selectAll(control_id).style('display', 'inline-block');
		if (page == "multi") { d3.select("#multi-controls").style("display", "inline-block"); }
	} else if (graph == "display-tab") {
		changeTab(graph);
		d3.selectAll(control_id).style('display', 'none');
		d3.select(display_id).style('display', 'inline-block');
	}
// global var
	tabview = graph;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setDisplayTabText()
// PURPOSE:  determines the actual text shown on Display Tab ( see: setDims() )
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setDisplayTabText(page) {
	d3.select('#display-tab').html(dims[page].displaytab.text);
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setScales(domvals)
// PURPOSE:  sets scales for all graph objects in /explore.php
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setScales(domvals) {
	scales = {
		multi: {
			y: {
			"mean_high_bll_build":{
				domain:[ 100 , 1 ], 
				range:[dims.multi.scatter.yaxis_start, dims.multi.scatter.yaxis_finish],
				"axis_text":"Average Building Blood Lead Levels (&micro;-grams)"
				},
			"n_high_g5_build":{
				"domain":[ domvals.max_n_g5 , 0 ], 
				range:[dims.multi.scatter.yaxis_start, dims.multi.scatter.yaxis_finish],
				"axis_text":"5+ BLL Tests Per Building"
				},
			"n_high_g10_build":{
				"domain":[ domvals.max_n_g10 , 0 ],  
				range:[dims.multi.scatter.yaxis_start, dims.multi.scatter.yaxis_finish],
				"axis_text":"10+ BLL Tests Per Building"
				},
			"p_high_g5_build":{
				"domain":[1,0],   
				range:[dims.multi.scatter.yaxis_start, dims.multi.scatter.yaxis_finish],
				"axis_text":"Percentage 5+ BLL Tests Per Building"
				},
			"p_high_g10_build":{
				"domain":[1,0],  
				range:[dims.multi.scatter.yaxis_start, dims.multi.scatter.yaxis_finish],
				"axis_text":"Percentage 10+ BLL Tests Per Building"
				}
			},
			x: {
			"all": { 
				domain:[ 0 , domvals.max_sincelast ],
				range:[dims.multi.scatter.xscale_start, dims.multi.scatter.xscale_finish],
				"axis_text":"Days since last building inspection"
				}
			}
		},
		focus: {
			y: {
				all: {
					axis_text:"Blood-lead level"
				}
			},
			x: {
				all: {
					axis_text:"Samples in building"
				}
			}
		},
		individual: {
			y: {
				histogram:{
					domain:[100,95,90,85,80,75,70,65,60,55,50,45,40,35,30,25,20,15,10,5], 
					range:[(dims.multi.scatter.yaxis_start+15), dims.multi.scatter.yaxis_finish],
					axis_text:"Sample Blood Lead Levels (&micro;-grams)"
					},
				linegraph: {
					domain:[100,0],
					range:[(dims.multi.scatter.yaxis_start+15), dims.multi.scatter.yaxis_finish],
					axis_text:"Sample Blood Lead Levels (&micro;-grams)"
				}
			},
			x: {
				histogram: {
					domain:[0,100], 
					range:[dims.indiv.histogram.xscale_start, dims.indiv.histogram.xscale_finish],
					axis_text:"Number of individual samples"
				},
				linegraph: {
					domain:[new Date("1994-01-01"), new Date("2014-07-01")], //d3.extent(data, function(d) { return d.date; })
					range:[dims.indiv.linegraph.xrange_start, dims.indiv.linegraph.xrange_finish],
					axis_text:"Date of BLL Test"
				}
			}		
		}		
	};	
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setDims(h)
// PURPOSE:  sets dimensions for most graph objects in /explore.php
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setDims(h) {

	return {
		multi: {
			scatter: {
				h: h,
				w: 900,
				yaxis_start: 10,
				yaxis_finish: h - 50,
				yaxis_horiz: 90,
				yaxis_vert: 0,
				xscale_start: 100,
				xscale_finish: 870,
				xaxis_start: 135,
				xaxis_finish: 870,
				xaxis_horiz: -5,
				xaxis_vert: height-50,
				x_buffer_to_yaxis: 10,
				yaxis_text_vert_offset: 400,
				yaxis_text_horiz_offset: -60,
				xaxis_text_vert_offset: 40,
				xaxis_text_horiz_offset: 350
			},
			detailbox: {	
				position: d3.select("#detail-box").style("position"),
				top: d3.select("#detail-box").style("top"),
				left: d3.select("#detail-box").style("left"),
				width: d3.select("#detail-box").style("width"),
				display: d3.select("#detail-box").style("display"),
				height: d3.select("#detail-box").style("height"),
				border: d3.select("#detail-box").style("border"),
				border_left: d3.select("#detail-box").style("border-left"),
				border_right: d3.select("#detail-box").style("border-right"),
				border_bottom: d3.select("#detail-box").style("border-bottom"),
				border_top: d3.select("#detail-box").style("border-top"),
				color: d3.select("#detail-box").style("color"),
				padding: d3.select("#detail-box").style("padding"),
				font_size: d3.select("#detail-box").style("font-size"),
				font_weight: d3.select("#detail-box").style("font-weight"),
				line_height: d3.select("#detail-box").style("line-height"),
			},
			controlbox: {
				position: 	d3.select("#detail-control-group").style('position'),
				top: 		d3.select("#detail-control-group").style("top"),
				width: 		d3.select("#detail-control-group").style("width")
			},
			tabbar: {
				position: 	d3.select("#tab-bar").style('position'),
				top: 		d3.select("#tab-bar").style('top'),
				left: 		d3.select("#tab-bar").style('left'),
				width: 		d3.select("#tab-bar").style('width')
			},
			displaytab: {
				text: "Building Data"
			}
		},
		indiv: {
			histogram: {
				w:630,
				h:height,
				xscale_start:94,
				xscale_finish: 600,
				yaxis_horiz:90,
				yaxis_vert:0,
				yaxis_text_horiz_offset:-60,
				yaxis_text_vert_offset:400,
				xaxis_horiz:0,
				xaxis_vert:height-45,
				xaxis_text_horiz_offset:230,
				xaxis_text_vert_offset:41
			},
			linegraph: {
				w:630,
				h:height,
				xrange_start:0,
				xrange_finish:522,
				xscale_start:100,
				xscale_finish: 622,
				yaxis_horiz:90,
				yaxis_vert:0,
				yaxis_text_horiz_offset:-60,
				yaxis_text_vert_offset:400,
				xaxis_horiz:95,
				xaxis_vert:height-45,
				xaxis_text_horiz_offset:170,
				xaxis_text_vert_offset:41
			},
			detailbox: {	
				top:"380px",
				left: "650px",
				width: "565px",
				height: "245px",
				overflow: "auto",
				border: "solid 2px rgb(120,120,120)",
				padding: "0px"
			},
			detailupper: {
				position: 	"absolute",
				top: 		"95px",
				width: 		"565px",
				display: 	"inline-block"
			},
			tabbar: {
				position: 	"absolute",
				top: 		"145px",
				left: 		"650px",
				width: 		"230px"
			},
			displaytab: {
				text: "Map View"
			}
		}
	};
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setAxisText(axis, page, graph, axg)
// PURPOSE:  sets text for various graph axes
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setAxisText(axis, page, graph, axg) {

	var horiz_offset = dims[page][graph][axis+'_text_horiz_offset'];
	var vert_offset = dims[page][graph][axis+'_text_vert_offset'];
	var rotate = (axis == "yaxis") ? "rotate(-90)" : "";

	return axg.append('text')
			.attr('class', 'label '+axis+'-text')
			.attr('text-anchor', 'start')
			.attr('transform', 'translate(' + horiz_offset + ',' + vert_offset + ')'+rotate);
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setAxisGroup(axis, page, graph, obj)
// PURPOSE:  sets offsets for various graph axes
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setAxisGroup(axis, page, graph, obj) {

	var horiz_offset = dims[page][graph][axis+'_horiz'];
	var vert_offset = dims[page][graph][axis+'_vert'];

	return obj.append('g')
		.attr('class', 'axis '+axis)
		.attr('transform', 'translate(' + horiz_offset + ',' + vert_offset + ')');
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: makeStreetviewMap(addr_data)
// PURPOSE:  makes StreetView map for Indiv view
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function makeStreetviewMap(addr_data) {


	var lat = addr_data.civis_latitude;
	var lon = addr_data.civis_longitude;
	var loc = new google.maps.LatLng(lat, lon);

	var options = {
	    center: loc,
	    zoom: 14
	};

	var map = new google.maps.Map( document.getElementById('hidden-map'), options );
  	
  	var pano_options = {
    	position: loc,
	    pov: {
	      heading: 90,
	      pitch: 1
	    }
  	};
  	
  	var panorama = new google.maps.StreetViewPanorama( document.getElementById('individual-map'), pano_options );
  	map.setStreetView(panorama);

	google.maps.event.clearListeners(window, 'mousemove');
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: showLayers(layer)
// PURPOSE:  hide/show kml overlays on Multi-map view
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function showLayers( layer ) {

	if (layer == "none") {

		d3.entries(layers).forEach( function(x) {
			if (x.value.kml !== null) { x.value.kml.setMap(null); x.value.show = false; }
		});

	} else {

		if (layers[layer].kml === null) {

			layers[layer].kml = new google.maps.KmlLayer({
		   		url: kml_urls[layer],
		    	map: map
			});
		}

		layers[layer].kml.setMap(map);
		layers[layer].show = true;
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: showLegend(command)
// PURPOSE:  hides/shows legend for scatter plot (multi view)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function showLegend(command) {
	if (command == "no") {
		d3.select("#legend-box").style("visibility", "hidden");
		d3.select("#legend-box").style("display", "none");
	} else if (command == "yes") {
		d3.select("#legend-box").style("visibility", "visible");
		d3.select("#legend-box").style("display", "block");
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: computeSinceLast(d, scope)
// PURPOSE:  figure out how long it's been since the most recent CDPH visit to a building
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function computeSinceLast(d, scope) {

	var now = new Date();
	var most_recent = new Date();
	var nodata = false;

	if (scope == "multiple") {

		var this_most_recent;
		d.forEach( function(elem) {

			if (elem.comply_date !== null && elem.init_date !== null) {
				this_most_recent = (elem.comply_date > elem.init_date) ? new Date(elem.comply_date) : new Date(elem.init_date);
				if (this_most_recent < most_recent) { most_recent = this_most_recent; }
			} else if (elem.init_date !== null) {
				if (elem.init_date < most_recent) { most_recent = elem.init_date; }
			}
		});

	} else if (scope == "single") {
		if (d.comply_date !== null || d.init_date !== null) {
			most_recent = (d.comply_date > d.init_date) ? new Date(d.comply_date) : new Date(d.init_date);
		}
	}

	if (most_recent < now) {
		return Math.floor( ( now - most_recent ) / (1000*60*60*24)); //turns time diff into days
	} else {
		return false;
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setZoom(map)
// PURPOSE:  zooms google map to bounding box that most closely contains selected buildings in query set
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setZoom(map) {

	var boundbox = new google.maps.LatLngBounds();

	multidata.forEach( function(addr) {
		var latlon = new google.maps.LatLng(addr.civis_latitude, addr.civis_longitude);
	    boundbox.extend(latlon);
	});

	map.fitBounds(boundbox);
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setBuildingID(id)
// PURPOSE:  sets current bldg_id to global var: current_building_id
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setBuildingID(id) {

	current_building_id = id;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: changeControlFeatures()
// PURPOSE:  switches which features can be seen in control panel tab
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function changeControlFeatures() {

	d3.selectAll("#scatter-control") .style("display", function() { return (graphview == "scatter") ? "inline-block" : "none"; });
	d3.selectAll("#map-control") 	 .style("display", function() { return (graphview == "map") ? "inline-block" : "none"; });
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: transition( obj, bldg_id, d )
// PURPOSE:  prepares transition from Multi to Indiv views (and vice versa)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function transition( obj, bldg_id, d ) {
	
	var valid_call, gview, pview, old_pview, addrdata, bldg;

	bldg = (bldg_id !== undefined) ? bldg_id : (current_building_id !== "") ? current_building_id : undefined;

	valid_call = false;

	if (d !== undefined ) {

		addrdata = d;
		valid_call = true;

	} else if (bldg !== undefined) {

		multidata.forEach( function(addr) {
			if (addr.bldg_id == bldg) { addrdata = addr; }
		});
		valid_call = true;

	} else if (obj !== null && obj.node().value.split("-")[0] == "multi") {

		valid_call = true;
	}

	if (valid_call) {
		old_pview = "multi";
		pview = (obj === null) ? "indiv" : obj.node().value.split("-")[0];
		gview = (obj === null) ? "histogram" : obj.node().value.split("-")[1];

		graph( old_pview, pview, gview, addrdata );
	}
}

	
//////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: updateThreshold(val)
// Purpose:  draws/removes threshold lines at 5/10 bll for multi plot
//
//////////////////////////////////////////////////////////////////////////////////////
	
	function updateThreshold(val, from, constant) {
	
		var y1, y2, x1, x2, color, obj;

		thresh[val] = (thresh[val]) ? false : true;

		if (from == "linegraph") {

			y1 = 0; y2 = 100; x1 = new Date(constant); x2 = new Date(constant);

			if (val == "init_date") 	{ color = "purple"; } 
			else if (val == "comply_date") 	{ color = "red"; 	}
			else if (val == "first_bad"){ color = "blue"; 	}

			obj = svgline;

		} else if (from == "scatter") {

			y1 = val; y2 = val; x1 = x.domain()[0]; x1 = x.domain()[1];
			color = "red";
			obj = svg;
		}

		if (thresh[val]) {
			obj.append("line")
				.attr("id", "thresh"+val)
				.style("stroke", color)
				.style("stroke-width", "3px")
				.attr("y1", function () { return y(y1); })
				.attr("y2", function () { return y(y2); })
				.attr("x1", function () { return x(x1); })
				.attr("x2", function () { return x(x2); })
				.style("visibility", "visible");
		} else {
			d3.select("#thresh"+val).remove();
		}
   

	}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: getAptLevelData( data, aptnum_list, aptnums_ready )
// PURPOSE:  collects summary statistics for each apt in building (for Indiv table)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function getAptLevelData( data, aptnum_list, aptnums_ready ) {

	if (!aptnums_ready) { data.forEach( function(addr_record) { aptnum_list.push(addr_record.apt_num); }); }

	// get unique apt num elements for aggregation
	var uq_apts = $.distinct(aptnum_list);

	var output = [];
	
	uq_apts.forEach( function(apt) {
		var total = 0;
		var mostrecent_sample = 0;
		var mostrecent_insp = 0;
		var ever_complied = false;
		var bldg_id = data[0].bldg_id;
		var thisapt_data = [];

		data.forEach( function(d) {  if (d.apt_num == apt) { thisapt_data.push(d); }  });

		for( var i = 0; i < thisapt_data.length; i++ ) {

			var tempdate, formatted_date;
			if (thisapt_data[i].comply_date !== "NA" && thisapt_data[i].comply_date !== null) { ever_complied = true; }

			total += parseFloat(thisapt_data[i].bll);

			var this_sample_date = dateToTimestamp(thisapt_data[i].sample_date);

			var this_insp_date = (thisapt_data[i].comply_date !== null) ? dateToTimestamp(thisapt_data[i].comply_date) : (thisapt_data[i].init_date !== null) ? dateToTimestamp(thisapt_data[i].init_date) : 0;

			if (this_sample_date > mostrecent_sample) { 
				tempdate = new Date(this_sample_date) ;
				formatted_date = tempdate.getFullYear() + "-" + tempdate.getMonth() + "-" + tempdate.getDate();
				mostrecent_sample = formatted_date;
			} 

			if (this_insp_date > mostrecent_insp) { 
				tempdate = new Date(this_insp_date) ;
				formatted_date = tempdate.getFullYear() + "-" + tempdate.getMonth() + "-" + tempdate.getDate();
				mostrecent_insp = formatted_date;
			} 
		}
		var avg_bll = Math.round((total/parseFloat(thisapt_data.length)*100))/100;
		var num_tests = data.length;
		var proba = data[0].predicted;
		var risk;
		if 		(proba > 0.50) 	{ risk = 'high'; 	}
		else if (proba > 0.30) 	{ risk = 'medium'; 	}
		else if (proba >   0) 	{ risk = 'low'; 	}

		if (mostrecent_sample === 0) 	{ mostrecent_sample = "never"; }
		if (mostrecent_insp   === 0) 	{ mostrecent_insp   = "never"; }

		output.push({ 
			apt_num: apt, 
			bldg_id:bldg_id,
			bll: avg_bll, 
			most_recent_sample: mostrecent_sample,
			most_recent_insp: mostrecent_insp,
			compliance: ever_complied,
			risk_level: risk,
			num_tests: num_tests
		});

	});
	
	return output;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: setDomainValues()
// PURPOSE:  sets domain values for graph axes
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setDomainValues() {

	var sincelast;

	if (multidata !== null) { 
		sincelast = computeSinceLast(multidata, "multiple");
	} else if ( indivdata !== null) { 
		sincelast = 0;
	}

	domain_values = {
		min_n_tests: 0, 
		max_n_tests: 0,
		max_bll_freq: 0,
		max_bll: 0,
		max_n_g5: 0,
		max_n_g10: 0,
		max_sincelast: sincelast
	};
	
	if (multidata !== null) {
		multidata.forEach( function(elem) {
			if(elem.n_high_tests_build > domain_values.max_n_tests) { domain_values.max_n_tests = parseInt(elem.n_high_tests_build); }
			if(elem.bll_freq_max_high > domain_values.max_bll_freq) { domain_values.max_bll_freq = parseInt(elem.bll_freq_max_high); }
			if(elem.max_bll > domain_values.max_bll) 				{ domain_values.max_bll = parseInt(elem.max_bll); }
			if(elem.n_high_g5_build > domain_values.max_n_g5) 		{ domain_values.max_n_g5 = parseInt(elem.n_high_g5_build); }
			if(elem.n_high_g10_build > domain_values.max_n_g10) 	{ domain_values.max_n_g10 = parseInt(elem.n_high_g10_build); }
		});
	}	

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: startSpinner(where)
// PURPOSE:  starts/shows loading spinner div
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function startSpinner(where) {

	d3.select('#loading').style('display', 'inline-block');
	d3.select('#loading').style('left', function() { return (where == 'result-table') ? '990px' : '600px'; });
	var target = document.getElementById('loading');
    if (spinner === undefined) { 
    	spinner = new Spinner(opts).spin(target); 
    } else { 
    	spinner.spin(target); 
    }

}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: populateCriteriaBox(vals)
// PURPOSE:  fills search criteria dropdown (#intro) with correct information 
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function populateCriteriaBox(vals) {

	var html = "";
	var ckeys = [];
	var cvals = [];


	d3.entries(vals).forEach( function(kv) {

		var relevant_key = false;
		d3.entries(criteria_dict.keys).forEach(function(x) { if (x.key == kv.key) { relevant_key = true; } });

		if (relevant_key) {

			var fkey = criteria_dict.keys[kv.key];

			var fval = (kv.key == "p") ? String(kv.value * 100)+"%" : kv.value;

			if (kv.key == "sincelast") { 

				fkey += " "+vals.sincetype; 

			} else if (kv.key == "meas") {

				d3.entries(criteria_dict.vals).forEach( function(x) { if (x.key == kv.val) { fval = x.value; } });

			} 

			ckeys.push(fkey);
			cvals.push(fval);
		}
	});

	for (var i = 0; i < ckeys.length; i++) {
		html += "<span class='search-term'>"+ ckeys[i] + ": </span> <span class='search-value'>" + cvals[i] + "</span><br />";
	}

	var box_height = ckeys.length * 22;
	d3.select("#search-criteria-popup").style("height", String(box_height)+"px");

	html += '<div id="popup-topbar">Search Query Parameters <div id="popup-x">X</div> </div> ';

	return html;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: updateMeasureSlider(min, max, step, value)
// ARGS: 	 min/max/step/value are standard attributes for <input type="range"> (ie. slider)
// PURPOSE:  updates #bllmeasure slider values based on cutoff metric (eg. Avg BLL, % BLL >5, etc)
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function updateMeasureSlider(min, max, step, value) {
	d3.select("#bllmeasure").property( { min: min, max: max, step: step, value: value } );
	d3.select("#filter-bllmeasure-low").text( d3.select("#bllmeasure").property("min") );
	d3.select("#filter-bllmeasure-high").text( d3.select("#bllmeasure").property("max") );
	d3.select("#filter-bllmeasure-current").text( d3.select("#bllmeasure").property("value") );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// FUNCTION: 	setRectangle(center)
// Purpose:  	sets rectangle around center of map boundaries (used with Google Maps API)
//
// Reference:  	http://stackoverflow.com/questions/11880441/how-to-convert-latlng-to-x-y-pixels-and-vice-versa
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////	
function setRectangle(center){

    var scale = Math.pow(2,map.getZoom());
    var proj = map.getProjection();
    var wc = proj.fromLatLngToPoint(center);
    var bounds = new google.maps.LatLngBounds();
    var sw = new google.maps.Point(((wc.x * scale) - 80)/ scale, ((wc.y * scale) - 50)/ scale);
    bounds.extend(proj.fromPointToLatLng(sw));
    var ne = new google.maps.Point(((wc.x * scale) + 80)/ scale, ((wc.y * scale) + 50)/ scale);
    bounds.extend(proj.fromPointToLatLng(ne));

    rectangle = new google.maps.Rectangle({
		bounds: bounds,
		editable: true,
		draggable: true
	});
  
	rectangle.setMap(map);
	current_tool_bounds = rectangle.getBounds();

}



