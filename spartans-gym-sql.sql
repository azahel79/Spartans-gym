CREATE DATABASE gym_database;

USE gym_database;

show tables;
select * from User;


select * from transactions;

select * from clients;


UPDATE clients 
SET attendanceDate = NULL, ultimaVisita = NULL 
WHERE id = 'f6641fcd-876e-4b30-80a0-d62456ac8b59';


