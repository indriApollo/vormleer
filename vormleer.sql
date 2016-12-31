create table voice(
    id integer primary key autoincrement,
    name varchar(32) not null
);

create table mood(
    id integer primary key autoincrement,
    name varchar(32) not null
);

create table tense(
    id integer primary key autoincrement,
    name varchar(32) not null
);

create table gid(
    id integer primary key autoincrement,
    infinitive varchar(255) not null,
    CONSTRAINT infinitive_unique UNIQUE (infinitive)
);

create table verbs(
    id integer primary key autoincrement,
    gid integer not null,
    voice integer not null,
    mood integer not null,
    tense integer not null,
    person integer not null,
    name varchar(255) not null
);

insert into voice(name) values("active");
insert into voice(name) values("passive");
insert into voice(name) values("deponent");

insert into mood(name) values("indicative");
insert into mood(name) values("imperative");
insert into mood(name) values("conjuctive");
insert into mood(name) values("infinitive");
insert into mood(name) values("participium");
insert into mood(name) values("gerundium");
insert into mood(name) values("gerundivum");

insert into tense(name) values("praesens");
insert into tense(name) values("imperfectum");
insert into tense(name) values("futurum_simplex");
insert into tense(name) values("perfectum");
insert into tense(name) values("plusquam_perfectum");
insert into tense(name) values("futurum_exactum");
