# vormleer

Vormleer is an online latin conjugation browser where you can list and search for latin verb conjugations.

The conjugations can be filtered by voice, mood and tense.

## Client

The client is built with HTML5 and Bootstrap 4. The requests are made with ajax.

### Conjugation browser (index.html)

This is where the user can search after specific conjugations or list the entire conjugation of an infinitive, additionally filtered on voice, mood or tense.

#### Usage

* To search a specific conjugation, type your word into "search verb". The results get refreshed while typing.
* To list the entire conjugation of an infinitive, type the infinitive into "infinitive" and click the "Show" button.
	* The conjugation can be filtered by selecting values in the voice, mood an tense dropdown menu's.
	
### Editor (editor.html)

The editor is where conjugations are added, edited or removed.
The user has to enter the correct editor token in the "token" field to be able to modify anything.

#### Usage

* To start with a fresh verb, enter a new infinitive into the "search" field then click "new".
* To select an existing verb, click on its infintive in the list. You can use the search field to narrow down the displayed infinitives.
	* The selected infinitive will be displayed in the page header.
* The voice, moods and tenses are organized in dropdown's in the central menu. Clicking on the header of a collapsed menu will reveal its children.
* Click on a mood/tense to start editing the selected verb. A wizard will be created where all the persons from the selected form can be filled.
* To delete a form, leave the input blank
* Send your modified form to the server by clicking on "save"
	

## Server&$ db

The vormleer server exposes it's data through a somewhat restful api (see code comments for json reqs format).

It uses node.js, bcrypt and sqlite3. A lighttpd webserver is used to handle https (let's encrypt) and to proxy the traffic to the node process.
The server is launched as a daemon with a systemd service file.
ufw (firewall) and fail2ban are additionally used to secure the server.

## Server & db setup (assuming debian jessie)
## prerequisites 
* [fail2ban](#fail2ban)
* [ufw](#ufw)
* [lighttpd](#lighttpd)
* [let's encrypt](#lets-encrypt)
* [sqlite3](#sqlite3)
* [node.js 7 on Debian Jessie](#nodejs-7-on-debian-jessie)
* [npm packages (bcrypt & node-sqlite3)](#npm-packages)

## Setting up the vormleer db
* [set up the sqlite database](#set-up-the-sqlite-database)
* [set the editor token](#set-the-editor-token)
* [create a systemd service file](#create-a-systemd-service-file)
* [launch and monitor the db](#launch-and-monitor-the-db)



## fail2ban

#### Install fail2ban

`# apt install fail2ban`

#### Check logs
`# cat /var/log/fail2ban.log `
*watch all the bots getting banned*


## ufw

#### Install ufw

`# apt install ufw`

#### Allow needed services

`# ufw allow ssh`

`# ufw allow http`

`# ufw allow https`

#### Enable ufw

`# ufw enable`

#### Check status

`# ufw status`



## lighttpd

#### Install lighttpd

`# apt install lighttpd`

### mod_proxy

#### Add mod_proxy in lighttpd.conf

`# nano /etc/lighttpd/lighttpd.conf`

```
server.modules = (
  [...],
	"mod_proxy"
)

```

#### Configure the proxy

`# nano /etc/lighttpd/conf-enabled/<yourdomain>.conf`

```
$HTTP["host"] == "<yourdomain>" {
  proxy.server  = ( "" => (
    ( "host" => "127.0.0.1", "port" => <nodejsport> )
  ) )
}
```

save with ctrl^x then y

#### Reload lighttpd

`# systemctl reload lighttpd`


## let's encrypt
Based on https://nwgat.ninja/setting-up-letsencrypt-with-lighttpd/

#### Stop lighttpd

`# systemctl stop lighttpd`

#### Get certbot & auth 

`$ git clone https://github.com/certbot/certbot && cd certbot`

`$ ./letsencrypt-auto --standalone auth`

*If let's encrypt complains about port 443 being in use check with:*

`# lsof -i tcp:443`

#### Combine files into ssl.pem

`# cd /etc/letsencrypt/live/<yourdomain>`

`# cat privkey.pem cert.pem > ssl.pem`

#### Forward Secrecy & Diffie Hellman Ephemeral Parameters

`# cd /etc/ssl/certs`

`# openssl dhparam -out dhparam.pem 4096`
*Took about 15 mins on my 2 core vps*

#### lighttpd config

`# nano /etc/lighttpd/conf-enabled/<yourdomain>.conf`

```
$SERVER["socket"] == ":443" {
     ssl.engine = "enable"
     ssl.pemfile = "/etc/letsencrypt/live/<yourdomain>/ssl.pem"
     ssl.ca-file = "/etc/letsencrypt/live/<yourdomain>/fullchain.pem"
     ssl.dh-file = "/etc/ssl/certs/dhparam.pem"
     ssl.ec-curve = "secp384r1"
     ssl.honor-cipher-order = "enable"
     ssl.cipher-list = "EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH"
     ssl.use-sslv2 = "disable"
     ssl.use-sslv3 = "disable"
}
```

save with ctrl^x then y

#### Reload lighttpd

`# systemctl reload lighttpd`


## sqlite3

#### Install sqlite3

`# apt install sqlite3`


## node.js 7 on Debian Jessie

#### Get node from the NodeSource Debian and Ubuntu binary distributions repository

`# curl -sL https://deb.nodesource.com/setup_7.x | bash -`

`# apt-get install -y nodejs build-essential` *build-essential is used to compile and install native addons from npm*


## npm packages

#### Get the bcrypt and sqlite3 modules

`$ npm install bcrypt sqlite3`


## Set up the sqlite database

`$ cd path/to/vormleer`

`$ sqlite3 vormleer.db` *this creates an empty database*

`sqlite> .read vormleer.sql` *this will create all the tables and insert all the values needed for the base vormleer db*

Exit sqlite with ctrl^D or with `sqlite> .exit`


## Set the editor token

You can use the included bcryptpass script to hash your token
A salt length of 8 is currently recommended. It takes < 100 ms to compare

`$ ./bcryptpass <passwd> <salt length>`

#### Save your hash in db.js

`$ nano db.js`

```
...
const EDITORTOKEN = "<your hash>";
...
```

Save with ctrl^x then y


## Create a systemd service file

`$ cd /etc/systemd/system`

`# nano vormleerd.service`

#### Paste the following (dont forget to replace WorkingDirectory and user)

```
[Unit]
Description=Node.js vormleer db
Requires=lighttpd.service

[Service]
WorkingDirectory=/path/to/vormleer
ExecStart=/usr/bin/node db.js
Restart=always
RestartSec=1
SyslogIdentifier=vormleerd
User=<user>

[Install]
WantedBy=multi-user.target

```

Save with ctrl^x then y


## Launch and monitor the db

#### Launch the db

`# systemctl start vormleerd`

#### Monitor the db

With systemctl status

`# systemctl status vormleerd`

With journalctl

`# journalctl -u vormleerd -n`
