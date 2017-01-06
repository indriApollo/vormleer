
const PROTOCOL = "https";
const HOST = "vormleer.indriapollo.be";

var TOKEN;
var infinitives = [];
var inf = {
	str: "",
	params: []
}

function createWizard(el) {
	var wizHeader = document.getElementById("wizard-title");
	inf.params = el.id.split("-");
	wizHeader.textContent = el.id.replace(/-/g," ");

	var fields = el.getAttribute("data-fields").split(" ");
	var cont = document.getElementById("wizard-container");
	cont.innerHTML = "";

	for(var i = 0; i < fields.length; i++) {
		var input = document.createElement("input");
		input.id = fields[i];
		input.setAttribute("placeholder",(fields[i] != "none")? fields[i] : "");
		input.className = "form-control input-padding wiz-input";
		input.fobj = {};
		input.oninput = function() {
			this.fobj[this.id] = this.value.trim().toLocaleLowerCase();
		}
		cont.appendChild(input);
	}


	loadConjugation(function(r) {
		for(var i = 0; i<r.length; i++) {
			var key = Object.keys(r[i])[0];
			var el = document.getElementById(key);
			el.value = r[i][key];
			el.fobj[key] = r[i][key];
		}
	});
	
}

function loadInfinitives() {
	request("verbs", null, "GET", null,function(s,r) {
		if(s != 200) {
			console.log(r.message);
		} else {
			infinitives = r;
			createSearchList(r);
		}
	});
}

function createSearchList(l) {

	var cont = document.getElementById("search-list");
	cont.innerHTML = "";
	var len = (l.length < 20)? l.length : 20;
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
	if(!inf.str) return;

	var reqobj = {};
	reqobj.voice = inf.params[0];
	reqobj.mood = inf.params[1];
	reqobj.tense = inf.params[2];
	reqobj.conjugation = [];

	var els = document.getElementsByClassName("wiz-input");

	for(var i=0; i<els.length; i++) {
		reqobj.conjugation.push(els[i].fobj);
	}

	request("verbs/"+inf.str, reqobj, "POST", TOKEN, function(s,r) {
		if(s != 201) {
			console.log(r.message);
		} else {
			alert("saved");
		}
	});
}

function search(query) {
	if(!query) {
		createSearchList(infinitives);
		return;
	}

	console.log("search for "+query);
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
	TOKEN = t;
}

function newInf() {
	var i  = document.getElementById("inf-input").value.trim().toLocaleLowerCase();
	if(infinitives.indexOf(i) != -1) {
		alert("Already exists");
		return;
	}

	inf.str = i;
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
