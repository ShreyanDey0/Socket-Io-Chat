const mysql = require("mysql");

const conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chatapp"
});

conn.connect((err)=>{
    if(err)
        console.error(err);
    else
        console.log("connected!");
});

module.exports = conn;