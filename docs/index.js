const PROTOCOL = "https";
const HOST = "vormleer.indriapollo.be";

var filter = {};
filter.voice = "*";
filter.mood = "*";
filter.tense = "*";

function createcard(voice, mood, tense, infinitive, conjugation) {

	/*
	 *	card html dom
	 *	
	 *	<div class=card>
	 *		<nav class=breadcrumb card-header>
	 *			<span class=breadcrumb-item>
	 *				voice
	 *			</span>
	 *			<span>...</span>
	 *		</nav>
	 *		<div class=card-block>
	 *			<p class=card-text>
	 *				<span class=text-person>
	 *					person
	 *				</span>
	 *				<span class=text-conjugation>
	 *					conjugation
	 *				</span>
	 *				<span>...</span>
	 *			</p>
	 *	</div>
	 */

	var cont = document.getElementById("content-container");
	
	var card = document.createElement("div");
	card.className = "card";

	var nav = document.createElement("nav");
	nav.className = "breadcrumb card-header";

	// populate breadcrumb
	function createSpan(pname, pval) {
		var span = document.createElement("span");
		span.className = "breadcrumb-item";
		// _ to spaces
		span.textContent = pval.replace(/_/g," ");
		span.pval = pval;
		span.pname = pname;
		span.onclick = function() {
			handleBreadcrumbClick(this, pname);
		};
		nav.appendChild(span);
	}
	
	createSpan("infinitive", infinitive);
	createSpan("voice", voice);
	createSpan("mood", mood);
	if(tense != "none") createSpan("tense", tense);

	card.appendChild(nav);

	var div = document.createElement("div");
	div.className = "card-block";

	// create all person/name pairs
	for(var i = 0;i<conjugation.length; i++) {
		var key = Object.keys(conjugation[i])[0];
		var str = conjugation[i][key];

		
		var p = document.createElement("p");

		var span = document.createElement("span");
		// ex : sing1 become sing 1
		// if person is none with display the tense instead
		span.textContent = (key != "none")? key.substr(0,4)+" "+key.substr(4,1) : tense.replace(/_/g," ");
		span.className = "text-person";
		p.appendChild(span);

		span = document.createElement("span");
		span.textContent = str;
		span.className = "text-conjugation";
		p.appendChild(span);

		p.className = "card-text";
		div.appendChild(p);
	}

	card.appendChild(div);
	cont.appendChild(card);
}

function handleBreadcrumbClick(el, pname) {
	var nav = el.parentElement;

	// by default we don't filter anything
	filter.voice = "*";
	filter.mood = "*";
	filter.tense = "*";
	// we get every breadcrumb-item
	for(var i = 0; i < nav.children.length; i++) {
		// we populate the filter with the values of the breadcrumb-items
		filter[nav.children[i].pname] = nav.children[i].pval;
		// we only apply the filter up until the clicked breadcrumb-item
		if(nav.children[i].pname == pname)
			break;
	}

	for(var key in filter) {
		// we display the filter values to the user
		if(key == "infinitive")
			document.getElementById("inf-input").value = filter[key];
		else 
			document.getElementById("header-"+key).textContent = (filter[key] != "*")? filter[key] : "Any";
	}

	getConjugation();
}

function search(query) {
	// we first clear the container
	document.getElementById("content-container").innerHTML = "";
	// we don't handle less than 2 chars queries
	if(!query || query.length < 2) return;

	request("verbs/search/"+query, function(s,r) {
		if(s != 200) {
			console.log(r.message);
		} else {
			if(r.length >= 1) {
				// if results, display them all with createcard
				for(var i = 0;i<r.length; i++) {
					// createcard expects conjugation as a person/name pair
					var conj = {};
					conj[r[i].person] = r[i].name;
					createcard(r[i].voice, r[i].mood, r[i].tense, r[i].infinitive, [conj]);
				}
			}
		}
	});
}

function getConjugation() {
	// we first clear the container
	document.getElementById("content-container").innerHTML = "";
	// we cant get anything without an infinitive
	if(!filter.infinitive) return;
	// we request the conjugation according to our filter
	var uri = "verbs/conjugation/"+filter.infinitive+"/"+filter.voice+"/"+filter.mood+"/"+filter.tense;
	request(uri, function(s,r){
		if(s != 200) {
			console.log(r.message);
		} else {
			if(r.length >= 1) {
				// if results, display the conjugation with createcard
				for(var i = 0;i<r.length; i++) {
					createcard(r[i].voice, r[i].mood, r[i].tense, filter.infinitive, r[i].conjugation);
				}
			}
		}
	});
}

function setInf(inf) {
	// we cant set the var from inside an event attribute
	filter.infinitive = inf;
}

function setFilter(el, param) {
	// we set the filter and update the displayed values
	var h = document.getElementById("header-"+param);
	var a = el.getAttribute("data-field");
	h.textContent = el.textContent;
	filter[param] = a;

}

function request(uri,callback) {

    var url = PROTOCOL+"://"+HOST+"/"+uri;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
        	try {
				var r = JSON.parse(xhr.responseText);
			} catch(e) {
				console.log("Invalid json: "+e);
				return;
			}
            callback(xhr.status ,r);
        }
    };
    xhr.open("GET", url);
    xhr.send();
}

window.onload = function() {
	//we set events on the filter selectors
	function setEvent(param) {
		var els = document.getElementsByClassName("selector-"+param);
		for (var i = 0; i < els.length ; i++) {
			els[i].addEventListener("click", function(){setFilter(this, param)}, false);
		}
	}

	setEvent("voice");
	setEvent("mood");
	setEvent("tense");

	//Browsers leave the input values displayed between reloads. It messes with our filter.
	document.getElementById("search-input").value = "";
	document.getElementById("inf-input").value = "";
}
