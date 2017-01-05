create table voice(
    id integer primary key autoincrement,
    str varchar(32) not null
);

create table mood(
    id integer primary key autoincrement,
    str varchar(32) not null
);

create table tense(
    id integer primary key autoincrement,
    str varchar(32) not null
);

create table person(
    id integer primary key autoincrement,
    str varchar(8) not null
);

create table gid(
    id integer primary key autoincrement,
    infinitive varchar(255) not null,
    CONSTRAINT infinitive_unique UNIQUE (infinitive)
);

create table verbs(
    id integer primary key autoincrement,
    gid integer not null,
    vid integer not null,
    mid integer not null,
    tid integer not null,
    pid integer not null,
    str varchar(255) not null
);

insert into voice(str) values("active");
insert into voice(str) values("passive");
insert into voice(str) values("deponent");

insert into mood(str) values("indicative");
insert into mood(str) values("imperative");
insert into mood(str) values("conjuctive");
insert into mood(str) values("infinitive");
insert into mood(str) values("participium");
insert into mood(str) values("gerundium");
insert into mood(str) values("gerundivum");

insert into tense(str) values("praesens");
insert into tense(str) values("imperfectum");
insert into tense(str) values("futurum_simplex");
insert into tense(str) values("perfectum");
insert into tense(str) values("plusquam_perfectum");
insert into tense(str) values("futurum_exactum");
insert into tense(str) values("none");

insert into person(str) values("sing");
insert into person(str) values("sing1");
insert into person(str) values("sing2");
insert into person(str) values("sing3");
insert into person(str) values("plur");
insert into person(str) values("plur1");
insert into person(str) values("plur2");
insert into person(str) values("plur3");
insert into person(str) values("none");