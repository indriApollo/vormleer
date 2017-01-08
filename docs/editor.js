
const PROTOCOL = "https";
const HOST = "vormleer.indriapollo.be";

var TOKEN;
var infinitives = [];
// this object holds all the info on the currently selected infinitive
var inf = {
	str: "",
	params: []
}

function createWizard(el) {

	/*
	 *	wizard content html dom
	 *	
	 *	<div class=form-group id=wizard-container>
	 *		<input class=form-control input-padding wiz-input>
	 *		...
	 *	</div>
	 */

	var wizHeader = document.getElementById("wizard-title");
	// id is voice-mood-tense
	inf.params = el.id.split("-");
	// - to spaces
	wizHeader.textContent = el.id.replace(/-/g," ");

	var fields = el.getAttribute("data-fields").split(" ");
	var cont = document.getElementById("wizard-container");
	// we clear the container
	cont.innerHTML = "";

	for(var i = 0; i < fields.length; i++) {
		var input = document.createElement("input");
		// we set the input id as the person
		input.id = fields[i];
		// we don't display person none
		input.setAttribute("placeholder",(fields[i] != "none")? fields[i] : "");
		input.className = "form-control input-padding wiz-input";
		input.fobj = {};
		// each input holds it's own person/name pair
		input.oninput = function() {
			this.fobj[this.id] = this.value.trim().toLocaleLowerCase();
		}
		cont.appendChild(input);
	}

	loadConjugation(function(r) {
		// we populate the wizard with the exisiting conjugation
		// retrieved from the db
		for(var i = 0; i<r.length; i++) {
			var key = Object.keys(r[i])[0];
			// the inputs have the person as id
			var el = document.getElementById(key);
			el.value = r[i][key];
			el.fobj[key] = r[i][key];
		}
	});
	
}

function loadInfinitives() {
	// get the list of already existing infinitives
	request("verbs", null, "GET", null,function(s,r) {
		if(s != 200) {
			console.log(r.message);
		} else {
			infinitives = r;
			// display the list
			createSearchList(r);
		}
	});
}

function createSearchList(l) {

	var cont = document.getElementById("search-list");
	// we clear the container
	cont.innerHTML = "";
	// we display max 20 elements
	var len = (l.length < 20)? l.length : 20;
	// we search the entire list of inifinitives
	for(var i = 0; i < len; i++) {
		var li = document.createElement("li");
		li.id = l[i];
		li.textContent = l[i];
		li.onclick = function() {
			inf.str = this.id;
			document.getElementById("inf-title").textContent = this.id;
			console.log("infinitive: "+inf.str);
		}
		cont.appendChild(li);
	}
}

function loadConjugation(callback) {

	request("verbs/conjugation/"+inf.str+"/"+inf.params[0]+"/"+inf.params[1]+"/"+inf.params[2], null, "GET", null, function(s,r) {
		if(s != 200) {
			console.log(r.message);
		} else {
			callback((r[0])? r[0].conjugation : []);
		}
	});
}

function save() {
	// ignore when no infinitve has been set
	if(!inf.str) return;

	var reqobj = {};
	reqobj.voice = inf.params[0];
	reqobj.mood = inf.params[1];
	reqobj.tense = inf.params[2];
	reqobj.conjugation = [];

	var els = document.getElementsByClassName("wiz-input");
	// get the person/name pai from all the wiz-inputs
	for(var i=0; i<els.length; i++) {
		reqobj.conjugation.push(els[i].fobj);
	}

	request("verbs/"+inf.str, reqobj, "POST", TOKEN, function(s,r) {
		if(s == 403) {
			alert("Your editor token is invalid !");
		}
		else if(s != 201) {
			console.log(r.message);
		} else {
			alert("saved");
		}
	});
}

function search(query) {
	// ignore empty queries
	if(!query) {
		createSearchList(infinitives);
		return;
	}
	// search the infinitives for a partial match
	var results = [];
	for(var i = 0; i < infinitives.length; i++) {
		if(infinitives[i].indexOf(query) != -1) {
			results.push(infinitives[i]);
		}
		if(results.length >= 20) break;
	}
	createSearchList(results);
}

function setToken(t) {
	// we can't set the token from within an event attribute
	TOKEN = t;
}

function newInf() {
	// add a new infinitve to the list only of it doesn't already exist
	var i  = document.getElementById("inf-input").value.trim().toLocaleLowerCase();
	if(infinitives.indexOf(i) != -1) {
		alert("Already exists");
		return;
	}

	inf.str = i;
	// display the currently edited infintive in the header
	document.getElementById("inf-title").textContent = i;
	infinitives.push(i);
}

function request(uri,jsondata,method,token,callback) {

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
    xhr.open(method, url);
    if(token) xhr.setRequestHeader("Editor-Token",token);
    if(jsondata)
    	jsondata = JSON.stringify(jsondata);
    xhr.send(jsondata);
}

window.onload = function() {
	// we want the list on load
	loadInfinitives();
	// we sent events for all the selectors
	var els = document.getElementsByClassName("selector");
	for (var i = 0; i < els.length ; i++) {
		els[i].addEventListener("click", function(){createWizard(this)}, false);
	}
}
