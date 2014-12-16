var links = []
var nodes = {}
var subjs = []
var subjs_loc = []
var floors = []
var r = 6

d3.csv("../data/Subjects.csv", function(error, data) {
	data.forEach( function(d,i) {
		subjs_loc.push( 
					{ 	uid: d.user_id , 
						floor: d.floor 
				  	} 
				  )
	})
	
	return getProximityData()
})

function getProximityData() {

	d3.csv("Proximity-small.csv", function(error, data) {

		data.forEach( function(d,i) {
			var thisuser = d["user.id"]
			var thisuser_floor = ''
			
			subjs.push(thisuser)
			subjs_loc.forEach ( function(s) {
				if (s.uid == thisuser) { thisuser_floor = s.floor; floors.push(s.floor); }
			})
			
			links.push( 
						{ 	timestamp: new Date(d.time) , 
							source: d["user.id"] , 
							target: d["remote.user.id.if.known"] ,
							proxprob: d["prob2"] ,
							floor: thisuser_floor
						} 
					  )
		})
		links.forEach(function(link) {
		  link.source = nodes[link.source] || (nodes[link.source] = {name: link.source, floor: link.floor});
		  link.target = nodes[link.target] || (nodes[link.target] = {name: link.target, floor: link.floor});
		});	
	
		var colors = d3.scale.category20().domain(floors)
		var width = 960,
		height = 650;

		var force = d3.layout.force()
			.nodes(d3.values(nodes))
			.links(links)
			.size([width, height])
			.linkDistance(400)
			.charge(-50)
			.friction(.2)
			.gravity(.3)
			.on("tick", tick)
			.start();
	
		var svg = d3.select("#graph").append("svg")
			.attr("width", width)
			.attr("height", height);

	

		var path = svg.append("g").selectAll("path")
			.data(force.links())
		  .enter().append("path")
			.attr("class", "link")
			.style("stroke-width", function(d) {return (4*(Math.pow(d.proxprob,2)))+"px"});
			
	var circle = svg.append("g").selectAll("circle")
		.data(force.nodes())
	  .enter().append("circle")
		.attr("r", r)
		.style("fill", function(d) {return colors(d.floor)})
		.call(force.drag);
	
	var text = svg.append("g").selectAll("text")
		.data(force.nodes())
	  .enter().append("text")
		.attr("x", 8)
		.attr("y", ".31em")
		.text(function(d) { return d.name; });
	
		// Use elliptical arc path segments to doubly-encode directionality.
	function tick() {
	  path.attr("d", linkArc);
      circle
        .attr("cx", function(d) { return d.x = Math.max(r, Math.min(width - r, d.x)); })
        .attr("cy", function(d) { return d.y = Math.max(r, Math.min(height - r, d.y)); });
	  text.attr("transform", transform);
	}

	function linkArc(d) {
	  var dx = d.target.x - d.source.x,
		  dy = d.target.y - d.source.y,
		  dr = Math.sqrt(dx * dx + dy * dy);
	  return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
	}

	function transform(d) {
	  return "translate(" + d.x + "," + d.y + ")";
	}
	})
}