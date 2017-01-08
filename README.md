# vormleer
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
* [create a systemd service file](# create-a-systemd-service-file)
* [launch and monitor the db](#launch-and-monitor-the-db)



## fail2ban

#### install fail2ban

`# apt install fail2ban`

#### check logs
`# cat /var/log/fail2ban.log `
*watch all the bots getting banned*


## ufw

#### install ufw

`# apt install ufw`

#### allow needed services

`# ufw allow ssh`

`# ufw allow http`

`# ufw allow https`

#### enable ufw

`# ufw enable`

#### check status

`# ufw status`



## lighttpd

#### install lighttpd

`# apt install lighttpd`

### mod_proxy

#### add mod_proxy in lighttpd.conf

`# nano /etc/lighttpd/lighttpd.conf`

```
server.modules = (
  [...],
	"mod_proxy"
)

```

#### configure the proxy

`# nano /etc/lighttpd/conf-enabled/<yourdomain>.conf`

```
$HTTP["host"] == "<yourdomain>" {
  proxy.server  = ( "" => (
    ( "host" => "127.0.0.1", "port" => <nodejsport> )
  ) )
}
```

save with ctrl^x then y

#### reload lighttpd

`# systemctl reload lighttpd`


## let's encrypt
Based on https://nwgat.ninja/setting-up-letsencrypt-with-lighttpd/

#### Stop lighttpd

`# systemctl stop lighttpd`

#### Get certbot & auth 

`git clone https://github.com/certbot/certbot && cd certbot`

`./letsencrypt-auto --standalone auth`

*If let's encrypt complains about port 443 being in use check with:*

`# lsof -i tcp:443`

#### combine files into ssl.pem

`cd /etc/letsencrypt/live/<yourdomain>`

`cat privkey.pem cert.pem > ssl.pem`

#### Forward Secrecy & Diffie Hellman Ephemeral Parameters

`cd /etc/ssl/certs`

`openssl dhparam -out dhparam.pem 4096`
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

#### reload lighttpd

`# systemctl reload lighttpd`


## sqlite3

#### install sqlite3

`# apt install sqlite3`


## node.js 7 on Debian Jessie

#### get node from the NodeSource Debian and Ubuntu binary distributions repository

`# curl -sL https://deb.nodesource.com/setup_7.x | bash -`

`# apt-get install -y nodejs build-essential` *build-essential is used to compile and install native addons from npm*


## npm packages

#### get the bcrypt and sqlite3 modules

`npm install bcrypt sqlite3`


## set up the sqlite database

`$ cd path/to/vormleer`

`$ sqlite3 vormleer.db` *this creates an empty database*

`sqlite> .read vormleer.sql` *this will create all the tables and insert all the values needed for the base vormleer db*

Exit sqlite with ctrl^D or with `sqlite> .exit`


## create a systemd service file

`$ cd /etc/systemd/system`

`# nano vormleerd.service`

#### paste the following (dont forget to replace WorkingDirectory and user)

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

save with ctrl^x then y


## launch and monitor the db

#### launch the db

`# systemctl start vormleerd`

#### monitor the db

with systemctl status

`# systemctl status vormleerd`

with journalctl

`# journalctl -u vormleerd -n`

