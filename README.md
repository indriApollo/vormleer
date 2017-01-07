# vormleer
## prerequisites
* [node.js 7 on Debian Jessie](#nodejs-7-on-debian-jessie)
* [fail2ban](#fail2ban)
* [ufw](#ufw)
* [lighttpd](#lighttpd)
* [let's encrypt](#lets-encrypt)



## node.js 7 on Debian Jessie

`# curl -sL https://deb.nodesource.com/setup_7.x | bash -`

`# apt-get install -y nodejs build-essential` *build-essential is used to compile and install native addons from npm*


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

#### reload lighttpd

`# systemctl reload lighttpd`
