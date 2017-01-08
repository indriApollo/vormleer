#!/usr/bin/env node

var http = require('http');
var zlib = require('zlib');
var sqlite3 = require('sqlite3');
var bcrypt = require('bcrypt');

const EDITORTOKEN = "$2a$08$C1wg4qsWaDsaiIFJISy1UuNIzzZXR2r.19HnCcvC4LMXIMM9BxvNK";
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

// join all the different tables on their corresponding id in verbs
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
                // Post requests have to be authenticated
                checkToken(url, body, headers, response);
                break;

            case 'OPTIONS':
                handleCORS(response);
                break;

            default:
                respond(response, "Unsupported http method", 400);
                break;
        }
    });
}).listen(PORT);
console.log("server listening on "+PORT);

// FUNCTIONS

function checkToken(url, body, headers, response) {

    /*
     * Check the editor token
     *
     * We check the validity of the token before any change can be made to the db
     * The token is compared with a constant bcrypt hash (EDITORTOKEN)
     * A salt length of 8 means we can honor a request in less than 100 ms
     * (Salt length 16 takes nearly 5 seconds to compare !)
     * Ideally we should generate a random string to anthenticate requests 
     * once a strong password has been checked but I want to keep it simple for the time being
     */

    if(!headers["editor-token"]) {
        respond(response, "Missing editor token", 403);
        return;
    }

    // compare happens asynchronously to avoid locking the entire server
    bcrypt.compare(headers["editor-token"], EDITORTOKEN, function(e,r) {
        if(e) {
            console.log(e.message);
            respond(response, "BCRYPT ERROR", 500);
        } else if(r) {
            // We forward the post equest to it's handler
            handlePOST(url, body, response);
        } else {
            respond(response, "Invalid editor token", 403);
        }
    })
}

function handleCORS(response) {

    /*
     * Handle Cross-Origin Resource Sharing (CORS)
     *
     * See : https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS#Preflighted_requests
     */
    
    // The preflighted requests expects http 200 for a successful request
    response.statusCode = 200;
    // We allow requests from any origin
    response.setHeader('Access-Control-Allow-Origin', '*');
    // We have to allow explicitly allow Editor-Token since it's a custom header
    response.setHeader('Access-Control-Allow-Headers', 'Editor-Token,User-Agent,Content-Type'); //can't use * !
    // We allow POST, GET and OPTIONS http methods
    response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    response.end();
}

function respond(response, data, status) {

    // http 200 reponses already have json data
    // Other status codes are using a simple json message: <msg> format
    if(status != 200)
        data = { message: data};

    // We pretty print the json data and store it in  an utf-8 buffer
    // Storing it in a buffer means that we can easily gzip it later
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
        params.$name = conjugation[index][params.$person].toLocaleLowerCase();

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
                // We recursively call ourselves until all the conjugations have been inserted
                insertparamstx(index);
            }
            else committx();
        })
    }

    function cleartensetx() {
        
        // We delete every entry with the given conjugation (infinitive, voice, mood, tense combination)
        // That way we avoid unnecessary duplicate rows
        // (we cant use a unique constraint since the same word can have multiple conjugations)
        // Added bonus : insert new, update and delete can all be made with the same function
        db.run("DELETE FROM verbs WHERE verbs.id IN \
                (SELECT verbs.id FROM verbs "+JOIN+" \
                WHERE infinitive=? AND voice.str=? AND mood.str=? AND tense.str=?)", [
                params.$infinitive, params.$voice, params.$mood, params.$tense
            ], function(e) {
            if(e) {
                console.log(e.message);
                rollbacktx();
            } else {
                console.log("delete done");
                // An empty conjugation array means only a deletion
                if(conjugation.length > 0) insertparamstx("0");
                else committx();
            }
        })
    }

    function insertgidtx() {

        // We create an id for new infintives (used to group verbs)
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

    // We use a new db object for every transaction to assure isolation
    // See https://github.com/mapbox/node-sqlite3/issues/304
    var db = new sqlite3.Database(DBNAME);
    func(db, ...args, function(msg, status) { //note ... -> spread operator (I know, right?)
        db.close();
        respond(response, msg, status);
    });
}

function handlePOST(url, body, response) {

    console.log("POST request for "+url);

    // We test if the json is valid
    // If not-> abort
    try {
        var jsonreq = JSON.parse(body);
    }
    catch(e) {
        respond(response, "Invalid json", 400);
        return;
    }

    // The json is fine, we check the url
    // We expect <domain>/verbs/<infinitive>
    var matches = url.match(/^\/verbs\/([a-z]+$)/);
    if(matches) {
        
        // url is fine, we check every property

        /*
         * Expected json data :
         *  {
         *      "voice": <voice>,
         *      "mood": <mood>,
         *      "tense": <tense>,
         *      "conjugation": [
         *          <person>: <name>,
         *          ...
         *      ]
         *  }
         */

        try {
            var pnames = ["voice","mood","tense"];
            for(var i = 0; i < pnames.length; i++) {
                var property = pnames[i];
                if(!jsonreq.hasOwnProperty(property)
                    || !VALID_PROPERTIES[property].indexOf(jsonreq[property]) > -1 )
                    throw property;
            }

            if(!jsonreq.hasOwnProperty("conjugation")
                || !Array.isArray(jsonreq.conjugation))
                throw "conjugation";
        }
        catch(e) {
            respond(response, "Missing or invalid "+e+" property", 400);
            return;
        }

        // All properties are present and values are valid

        // Store in db
        var params = {};
        params.$voice = jsonreq.voice;
        params.$mood = jsonreq.mood;
        params.$tense = jsonreq.tense;
        params.$infinitive = matches[1];
        // params.$person
        // params.$name

        dbRequestHandler(response, insertVerb, [params, jsonreq.conjugation]);

    }
    // Wrong uri -> complain
    else
        respond(response, "Unknown POST uri", 404);
}

function returnListAllInfinitives(db, callback) {

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
    if(query.length < 2) callback("Query is too short", 400);
    else {
        db.all("SELECT infinitive, voice.str AS voice, mood.str AS mood ,tense.str AS tense ,person.str AS person, verbs.str AS name \
                FROM verbs "+JOIN+" WHERE verbs.str LIKE ?", "%"+query+"%",function(e, rows) {
            if(e) callback("DB ERROR", 500);
            else callback(rows, 200);
        })
    }
}

function returnConjugation(db, cmd, callback) {

    var params = {};

    //cmd's are : infinitive, voice, mood, tense, person
    if(cmd.length > 6) {
        callback("Too many parameters", 400);
        return;
    }

    // We at least need an infintive else -> abort
    params.$infinitive = cmd[1];
    if(!params.$infinitive) {
        callback("Missing infinitive parameter", 400);
        return;
    }

    var clause = "WHERE infinitive=$infinitive ";
    var pnames = [0,0,"voice","mood","tense","person"];

    // We check the presence and validity of every property to build the final where clause
    for(var i = 2; i < cmd.length; i++) {
        if(cmd[i] == "*") continue;

        var property = pnames[i];
        if(VALID_PROPERTIES[property].indexOf(cmd[i]) <= -1) {
            callback("Invalid "+property+" parameter", 400);
            return;
        }
        params.["$"+property] = cmd[i];
        // ex : AND "voice.str=$voice "
        clause+= "AND "+property+".str=$"+property+" ";
    }

    var result = [];
    db.each("SELECT voice.str AS voice, mood.str AS mood, tense.str AS tense, person.str AS person, verbs.str AS name \
            FROM verbs "+JOIN+clause+" ORDER BY voice AND mood AND tense", params,
        // row callback (is omitted if no results)
        function(e,row) {
        if(e) {
            console.log(e.message);
            callback("DB ERROR", 500);
        } else {
            // We want to group the results by voice, mood ,tense combination
            var pres = result[result.length-1];
            var prev = (result.length > 0) ? pres.voice+pres.mood+pres.tense : "";
            // We push a new object to results if the combination changes
            if(row.voice+row.mood+row.tense != prev) {
                result.push({
                    voice: row.voice,
                    mood: row.mood,
                    tense: row.tense,
                    conjugation: []
                });
            }
            // We push the person/name pair to the previously created combination
            var conj = {};
            conj[row.person] = row.name;
            pres.conjugation.push(conj);
        }
    // completion callback
    }, function(e, nrows) {
        if(e) {
            console.log(e.message);
            callback("DB ERROR", 500);
        } else {
            callback(result, 200);
        }
    });
}

function handleGET(url, response) {

    console.log("GET request for "+url);
    
    // We expect <domain>/verbs/(<infinitive>/<voice>/<mood>/<tense>/<person>)
    // or        <domain>/verbs/search/<query>
    var matches = url.match(/^\/verbs\/?([a-zA-Z1-3/*_]*$)/);
    if(matches) {
        var cmd = matches[1];
        if(!cmd) {
            dbRequestHandler(response, returnListAllInfinitives, []);
        } else {
            var cmds = cmd.split("/");
            if(cmds[0] == "search") {
                /*
                 * Search for query and return results as an array(may be empty) of :
                 *  {
                 *      "infinitive": <infinitive>
                 *      "voice": <voice>,
                 *      "mood": <mood>,
                 *      "tense": <tense>,
                 *      "conjugation": [
                 *          <person>: <name>,
                 *          ...
                 *      ]
                 *  }
                 */
                dbRequestHandler(response, searchVerb,[cmds[1]]);
            }
            else if(cmds[0] == "conjugation") {
                /*
                 * Return the requested conjugation as an array(may be empty) of :
                 *  {
                 *      "voice": <voice>,
                 *      "mood": <mood>,
                 *      "tense": <tense>,
                 *      "conjugation": [
                 *          <person>: <name>,
                 *          ...
                 *      ]
                 *  }
                 */
                dbRequestHandler(response, returnConjugation, [cmds]);
            }
            else
                // Unknown cmd -> complain
                respond(response, "Unknown /verbs uri", 404);
        }
    }
    // Wrong uri -> complain
    else
        respond(response, "Unknown GET uri", 404);
}
