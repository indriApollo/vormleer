const PROTOCOL = "https";
const HOST = "vormleer.indriapollo.be";

var filter = {};

function createcard(voice, mood, tense, infinitive, conjugation) {

	var cont = document.getElementById("content-container");
	var div = document.createElement("div");
	div.className="col-md-3";
	var card = document.createElement("div");
	card.className = "card";

	//var cardHeader = document.createElement("div");
	//cardHeader.className = "card-header";

	var nav = document.createElement("nav");
	nav.className = "breadcrumb card-header";

	function createSpan(pname, pval) {
		var span = document.createElement("span");
		span.className = "breadcrumb-item";
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

	//cardHeader.appendChild(nav);
	card.appendChild(nav);

	var ul = document.createElement("ul");

	for(var i = 0;i<conjugation.length; i++) {
		var key = Object.keys(conjugation[i])[0];
		var str = conjugation[i][key];

		
		var li = document.createElement("li");
		li.textContent = key+": \t"+str;
		ul.appendChild(li);
	}

	card.appendChild(ul);
	div.appendChild(card);
	cont.appendChild(div);
}

function handleBreadcrumbClick(el, pname) {
	var nav = el.parentElement;

	filter.voice = "*";
	filter.mood = "*";
	filter.tense = "*";
	for(var i = 0; i < nav.children.length; i++) {
		filter[nav.children[i].pname] = nav.children[i].pval;
		if(nav.children[i].pname == pname)
			break;
	}

	for(var key in filter) {

		if(key == "infinitive")
			document.getElementById("inf-input").value = filter[key];
		else 
			document.getElementById("header-"+key).textContent = filter[key];
	}

	getConjugation();
}

function search(query) {
	document.getElementById("content-container").innerHTML = "";
	if(!query) return;
	request("verbs/search/"+query, function(s,r) {
		if(s != 200) {
			console.log(r.message);
		} else {
			if(r.length >= 1) {
				for(var i = 0;i<r.length; i++) {
					var conj = {};
					conj[r[i].person] = r[i].name;
					createcard(r[i].voice, r[i].mood, r[i].tense, r[i].infinitive, [conj]);
				}
			}
		}
	});
}

function getConjugation() {
	document.getElementById("content-container").innerHTML = "";

	if(!filter.infinitive) return;
	if(!filter.voice) filter.voice = "*";
	if(!filter.mood) filter.mood = "*";
	if(!filter.tense) filter.tense = "*";

	var uri = "verbs/conjugation/"+filter.infinitive+"/"+filter.voice+"/"+filter.mood+"/"+filter.tense;
	request(uri, function(s,r){
		if(s != 200) {
			console.log(r.message);
		} else {
			if(r.length >= 1) {
				for(var i = 0;i<r.length; i++) {
					createcard(r[i].voice, r[i].mood, r[i].tense, filter.infinitive, r[i].conjugation);
				}
			}
		}
	});
}

function setInf(inf) {
	filter.infinitive = inf;
}

function setFilter(el, param) {

	var h = document.getElementById("header-"+param);
	var a = el.getAttribute("data-field");
	h.textContent = el.textContent;
	filter[param] = a;

}

window.onload = function() {

	function setEvent(param) {
		var els = document.getElementsByClassName("selector-"+param);
		for (var i = 0; i < els.length ; i++) {
			els[i].addEventListener("click", function(){setFilter(this, param)}, false);
		}
	}

	setEvent("voice");
	setEvent("mood");
	setEvent("tense");

	document.getElementById("search-input").value = "";
	document.getElementById("inf-input").value = "";
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
