const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all('SELECT id, name, source FROM attendees', [], (err, rows) => {
  if (err) throw err;
  console.log(rows);
  db.close();
});