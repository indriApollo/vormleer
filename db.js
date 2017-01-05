var http = require('http');
var zlib = require('zlib');
var sqlite3 = require('sqlite3').verbose();

const PORT = 8081;
const DBNAME = 'vormleer.db';
const VALID_PROPERTIES = {
    voice:[
        "active",
        "passive",
        "deponent"
    ],
    mood:[
        "indicative",
        "imperative",
        "conjuctive",
        "infinitive",
        "participium",
        "gerundium",
        "gerundivum"
    ],
    tense:[
        "praesens",
        "imperfectum",
        "futurum_simplex",
        "perfectum",
        "plusquam_perfectum",
        "futurum_exactum",
        "none"
    ],
    person:[
        "sing",
        "sing1",
        "sing2",
        "sing3",
        "plur",
        "plur1",
        "plur2",
        "plur3",
        "none"
    ]
}
const JOIN = "JOIN gid ON verbs.gid=gid.id JOIN voice ON verbs.vid=voice.id \
    JOIN mood ON verbs.mid=mood.id JOIN tense ON verbs.tid=tense.id JOIN person ON verbs.pid=person.id ";

// SERVER

http.createServer(function(request, response) {

    var headers = request.headers;
    var method = request.method;
    var url = request.url;
    var body = [];

    response.on('error', function(err) {
        console.error(err);
    });

    request.on('error', function(err) {
        console.error(err);
        response.statusCode = 500;
        response.end();

    }).on('data', function(chunk) {
        body.push(chunk);
    }).on('end', function() {
        body = Buffer.concat(body).toString();

        switch(method) {
            case 'GET':
                handleGET(url, response);
                break;

            case 'POST':
                handlePOST(url, body, response);
                break;

            default:
                respond(response, "Unsupported http method", 400);
                break;
        }
    });
}).listen(PORT);
console.log("server listening on "+PORT);

// FUNCTIONS

function respond(response, data, status) {

    if(status != 200 && status != 201)
        data = { message: data};

    var buf = Buffer.from(JSON.stringify(data, null, 4), 'utf-8');

    response.statusCode = status;
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Encoding', 'gzip');
    response.setHeader('Content-Type', 'application/json');

    zlib.gzip(buf, function (_, result) {
      response.setHeader('Content-Length',result.length);
      response.end(result);
    });
}

function insertVerb(db, params, conjugation, callback) {

    /*
     * Insert a verb into the db
     * 
     * 1. Start transaction with begintx()
     *      - rollbacktx() gets called in case of errors
     * 2. If new infinitive insert in gid else ignore with insertgidtx()
     * 3. Clear existing verb records if any with cleartensetx()
     * 4. Insert all conjugations in verb db with insertparamstx();
     * 5. End transaction with committx()
     *      - commixtx() executes callback on success
     */
    
    function begintx() {
        db.exec("BEGIN", function(e) {
            if(e) {
                console.log(e.message);
                callback("DB ERROR", 500);
            }
            else insertgidtx();
        })
    }

    function committx() {
        db.exec("COMMIT", function(e) {
            if(e) {
                console.log(e.message);
                callback("DB ERROR", 500);
            }
            else callback("OK", 201)
        });
    }

    function rollbacktx() {
        db.exec("ROLLBACK", function(e) {
            if(e)
                console.log(e.message);
            callback("DB ERROR", 500);
        })
    }

    function insertparamstx(index) {
        params.$person = Object.keys(conjugation[index])[0];
        params.$name = conjugation[index][params.$person];
        console.log(params);
        db.run("INSERT INTO verbs (gid, vid, mid, tid, pid, str) \
                SELECT gid.id, voice.id, mood.id, tense.id, person.id, $name AS str \
                FROM gid, voice, mood, tense, person \
                WHERE gid.infinitive=$infinitive AND voice.str=$voice AND mood.str = $mood \
                AND tense.str=$tense AND person.str=$person", params, function(e) {
            if(e) {
                console.log(e.message);
                rollbacktx();
            }
            else if(++index < conjugation.length) {
                insertparamstx(index);
            }
            else committx();
        })
    }

    function cleartensetx() {
        
        db.run("DELETE FROM verbs WHERE verbs.id IN \
                (SELECT verbs.id FROM verbs "+JOIN+" \
                WHERE infinitive=? AND voice.str=? AND mood.str=? AND tense.str=?)", [
                params.$infinitive, params.$voice, params.$mood, params.$tense
            ], function(e) {
            if(e) {
                console.log(e.message);
                rollbacktx();
                throw Error();
            } else {
                console.log("delete done");
                //an empty conjugation array means only a deletion
                if(conjugation.length > 0) insertparamstx("0");
                else committx();
            }
        })
    }

    function insertgidtx() {
        db.run("INSERT OR IGNORE INTO gid (infinitive) VALUES (?)", params.$infinitive, function(e) {
            if(e) {
                console.log(e.message);
                rollbacktx();
            } else cleartensetx();
        })
    }

    begintx();
    
}

function dbRequestHandler(response, func, args) {

    var db = new sqlite3.Database(DBNAME);
    func(db, ...args, function(msg, status) { //note ... -> spread operator (I know, right?)
        db.close();
        respond(response, msg, status);
    });
}

function handlePOST(url, body, response) {

    console.log("POST request for "+url);

    // We first test if the json is valid
    // If not-> abort
    try {
        var jsonreq = JSON.parse(body);
    }
    catch(e) {
        respond(response, "Invalid json", 400);
        return;
    }

    // The json is fine, we check the url
    // We expect <domain>/verbs/[infinitive]
    var matches = url.match(/^\/verbs\/([a-zA-Z]+$)/);
    if(matches) {
        
        //url is fine, we check every property
        try {
            function checkString(property) {
                return ( jsonreq.hasOwnProperty(property) && VALID_PROPERTIES[property].indexOf(jsonreq[property]) > -1 );
            }

            if(!checkString("voice")) throw "voice";
            if(!checkString("mood")) throw "mood";
            if(!checkString("tense")) throw "tense";

            if(!jsonreq.hasOwnProperty("conjugation")
                || !Array.isArray(jsonreq.conjugation))
                throw "conjugation";
        }
        catch(e) {
            respond(response, "Missing or invalid "+e+" property", 400);
            return;
        }

        //All properties are present and values are valid

        //Store in db
        var params = {};
        params.$voice = jsonreq.voice;
        params.$mood = jsonreq.mood;
        params.$tense = jsonreq.tense;
        params.$infinitive = matches[1];

        dbRequestHandler(response, insertVerb, [params, jsonreq.conjugation]);

    }
    //Wrong uri -> complain
    else
        respond(response, "Unknown POST uri", 404);
}

function returnVerbList(db, callback) {

    var result = [];
    db.each("SELECT infinitive FROM gid", [], function(e,row) {
        if(e) callback("DB ERROR", 500);
        else result.push(row.infinitive);
    }, function(e,nrows) {
        if(e) callback("DB ERROR", 500);
        else callback(result, 200);
    })
}

function searchVerb(db, query, callback) {

    if(!query) callback("Missing search term", 400);
    else {
        db.all("SELECT infinitive, voice.str AS voice, mood.str AS mood ,tense.str AS tense ,person.str AS person, verbs.str AS name \
                FROM verbs "+JOIN+" WHERE verbs.str LIKE ?", "%"+query+"%",function(e, rows) {
            if(e) callback("DB ERROR"+e, 500);
            else callback(rows, 200);
        })
    }
}

function returnConjugation(db, cmd, callback) {

    var params = {};

    if(cmd.length > 6) {
        callback("Too many parameters", 400);
        return;
    }

    params.$infinitive = cmd[1];
    if(!params.$infinitive) {
        callback("Missing infinitive parameter", 400);
        return;
    }

    var clause = "WHERE infinitive=$infinitive ";

    if(cmd[2] && cmd[2] !="*") {
        if(VALID_PROPERTIES.voice.indexOf(cmd[2]) <= -1) {
            callback("Invalid voice parameter", 400);
            return;
        }
        params.$voice = cmd[2];
        clause+= "AND voice.str=$voice ";
    }

    if(cmd[3] && cmd[3] !="*") {
        if(VALID_PROPERTIES.mood.indexOf(cmd[3]) <= -1) {
            callback("Invalid mood parameter", 400);
            return;
        }
        params.$mood = cmd[3];
        clause += "AND mood.str=$mood ";
    }

    if(cmd[4] && cmd[4] !="*") {
        if(VALID_PROPERTIES.tense.indexOf(cmd[4]) <= -1) {
            callback("Invalid tense parameter", 400);
            return;
        }
        params.$tense = cmd[4];
        clause += "AND tense.str=$tense ";
    }

    if(cmd[5] && cmd[5] !="*") {
        if(VALID_PROPERTIES.person.indexOf(cmd[5]) <= -1) {
            callback("Invalid person parameter", 400);
            return;
        }
        params.$person = cmd[5];
        clause += "AND person.str=$person ";
    }

    var result = [];
    db.each("SELECT voice.str AS voice, mood.str AS mood, tense.str AS tense, person.str AS person, verbs.str AS name \
            FROM verbs "+JOIN+clause+" ORDER BY voice AND mood AND tense", params, function(e,row) {
        if(e) {
            console.log(e.message);
            callback("DB ERROR", 500);
        } else {
            var prev = (result.length > 0) ? result[result.length-1].voice+result[result.length-1].mood+result[result.length-1].tense : "";
            if(row.voice+row.mood+row.tense != prev) {
                result.push({
                    voice: row.voice,
                    mood: row.mood,
                    tense: row.tense,
                    conjugation: []
                });
            }
            var fobj = {};
            fobj[row.person] = row.name;
            result[result.length-1].conjugation.push(fobj);
        }
    }, function(e, nrows) {
        if(e) {
            console.log(e.message);
            throw Error();
            callback("DB ERROR", 500);
        } else {
            callback(result, 200);
        }
    });
}

function handleGET(url, response) {

    console.log("GET request for "+url);
    
    var matches = url.match(/^\/verbs\/?([a-zA-Z1-3/*_]*$)/);
    if(matches) {
        var cmd = matches[1];
        if(!cmd) {
            dbRequestHandler(response, returnVerbList, []);
        } else {
            var cmds = cmd.split("/");
            if(cmds[0] == "search") {
                dbRequestHandler(response, searchVerb,[cmds[1]]);
            }
            else if(cmds[0] == "conjugation") {
                dbRequestHandler(response, returnConjugation, [cmds]);
            }
            else
                respond(response, "Unknown /verbs uri", 404);
        }
    }
    //Wrong uri -> complain
    else
        respond(response, "Unknown GET uri", 404);
}
