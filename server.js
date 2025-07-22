// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---------- Paths ----------
const DB_PATH = path.join(__dirname, 'database.sqlite');
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'csv');
const LAYOUT_PATH = path.join(__dirname, 'layout.json');

// Ensure dirs exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Middleware ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// Flash message middleware
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// ---------- DB ----------
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('DB error:', err.message);
  else console.log('Connected to SQLite database.');
});

// Add company and source columns if not exist
db.run(`CREATE TABLE IF NOT EXISTS attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  designation TEXT,
  category TEXT,
  printed INTEGER DEFAULT 0,
  scanned INTEGER DEFAULT 0,
  barcode TEXT UNIQUE,
  source TEXT DEFAULT 'manual'
);`);

// ---------- Helpers ----------
function isAdmin(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function broadcastUpdate() {
  io.emit('update-attendees');
}
function generateBarcode(callback) {
  function randomCode() {
    return 'BAR' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  function checkUnique(code, cb) {
    db.get('SELECT id FROM attendees WHERE barcode = ?', [code], (err, row) => {
      if (err) return cb(err);
      if (row) return cb(null, false); // Not unique
      cb(null, true); // Unique
    });
  }
  function tryGenerate(cb) {
    const code = randomCode();
    checkUnique(code, (err, unique) => {
      if (err) return cb(err);
      if (unique) return cb(null, code);
      // Try again if not unique
      tryGenerate(cb);
    });
  }
  tryGenerate(callback);
}
// Multer for CSV
const upload = multer({ dest: UPLOAD_DIR });

// ---------- Routes ----------

// Home (redirect to register for convenience)
app.get('/', (req, res) => {
  res.render('register', { user: req.session.user || null });
});

// Admin Login (GET)
app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user || null });
});

// Admin Login (POST)
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === (process.env.ADMIN_USER || 'admin') &&
    password === (process.env.ADMIN_PASS || 'admin123')
  ) {
    req.session.user = { username: username };
    req.session.success = "Logged in successfully!";
    return res.redirect('/admin');
  }
  req.session.error = "Invalid credentials";
  res.redirect('/login');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin Panel
app.get('/admin', isAdmin, (req, res) => {
  db.all('SELECT * FROM attendees ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      req.session.error = "DB error";
      return res.redirect('/login');
    }
    res.render('admin', { attendees: rows, user: req.session.user });
  });
});

// Register Attendee (public form)
app.post('/register', (req, res) => {
  const { name, email, mobile, designation, category, company, action } = req.body;

  if (!name || !email || !mobile || !category) {
    req.session.error = "Missing required fields.";
    return res.redirect(req.get('Referrer') || '/');
  }

  db.get('SELECT id FROM attendees WHERE email=? OR mobile=?', [email, mobile], (err, row) => {
    if (err) {
      req.session.error = "DB error";
      return res.redirect(req.get('Referrer') || '/');
    }
    if (row) {
      req.session.error = "Duplicate: Email or mobile already registered.";
      return res.redirect(req.get('Referrer') || '/');
    }

    generateBarcode((err, barcode) => {
      if (err) {
        req.session.error = "Barcode generation error.";
        return res.redirect(req.get('Referrer') || '/');
      }
      db.run(
        `INSERT INTO attendees (name, email, mobile, designation, category, company, barcode, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, mobile, designation || '', category, company || '', barcode, 'manual'],
        function (err2) {
          if (err2) {
            req.session.error = "Insert error.";
            return res.redirect(req.get('Referrer') || '/');
          }

          broadcastUpdate();

          // If admin clicked "Submit & Print"
          if (req.session.user && action === 'submit-print') {
            return res.redirect(`/badge/${this.lastID}`);
          }

          // Only show message for public/attendee registration (not admin)
          if (!req.session.user) {
            req.session.success = "Registration successful! Please proceed to the counter for verification or badge collection.";
          }
          res.redirect(req.get('Referrer') || '/');
        }
      );
    });
  });
});

// Edit Attendee (admin)
app.post('/edit/:id', isAdmin, (req, res) => {
  const { name, email, mobile, designation, category, company } = req.body;
  db.run(
    `UPDATE attendees
     SET name=?, email=?, mobile=?, designation=?, category=?, company=?
     WHERE id=?`,
    [name, email, mobile, designation, category, company, req.params.id],
    function (err) {
      if (err) {
        req.session.error = "Update error (possible duplicate email or mobile).";
        return res.redirect('/admin');
      }
      broadcastUpdate();
      req.session.success = "Attendee updated!";
      res.redirect('/admin');
    }
  );
});

// Delete Attendee (admin)
app.post('/delete/:id', isAdmin, (req, res) => {
  db.run('DELETE FROM attendees WHERE id=?', [req.params.id], function (err) {
    if (err) {
      req.session.error = "Delete error.";
      return res.redirect('/admin');
    }
    broadcastUpdate();
    req.session.success = "Attendee deleted!";
    res.redirect('/admin');
  });
});

app.post('/mark-scanned/:id', isAdmin, (req, res) => {
  db.run('UPDATE attendees SET scanned=1 WHERE id=?', [req.params.id], function (err) {
    if (err) {
      req.session.error = "Could not mark as scanned.";
      return res.redirect('/admin');
    }
    broadcastUpdate();
    req.session.success = "Attendee marked as scanned!";
    res.redirect('/admin');
  });
});

// Badge Print Page (admin)
app.get('/badge/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM attendees WHERE id = ?', [id], (err, attendee) => {
    if (err || !attendee) return res.send('Badge not found');

    // Mark printed
    db.run('UPDATE attendees SET printed=1 WHERE id=?', [id], () => {
      broadcastUpdate();
    });

    // Load layout
    let layoutData = null;
    if (fs.existsSync(LAYOUT_PATH)) {
      try { layoutData = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf8')); } catch (_) {}
    }

    res.render('badge', {
      attendee,
      user: req.session.user || null,
      layout: layoutData
    });
  });
});

// Scanner Page (admin)
app.get('/scan', isAdmin, (req, res) => {
  res.render('scanner', { user: req.session.user || null });
});

// Scanner Verify (AJAX from scanner.js)
app.post('/verify-scan', isAdmin, (req, res) => {
  const { barcode } = req.body;
  db.get('SELECT * FROM attendees WHERE barcode=?', [barcode], (err, row) => {
    if (err) return res.json({ success: false, message: 'DB error' });
    if (!row) return res.json({ success: false, message: 'Not found' });
    if (row.scanned) return res.json({ success: false, message: 'Already scanned' });

    db.run('UPDATE attendees SET scanned=1 WHERE id=?', [row.id], (err2) => {
      if (err2) return res.json({ success: false, message: 'Update error' });
      broadcastUpdate();
      res.json({ success: true, message: `${row.name} verified`, attendee: row });
    });
  });
});

// CSV Upload (admin)
app.post('/upload-csv', isAdmin, upload.single('csvfile'), (req, res) => {
  if (!req.file) {
    req.session.error = "No file uploaded.";
    return res.redirect('/admin');
  }
  const filePath = req.file.path;

  const rowsToInsert = [];
  fs.createReadStream(filePath)
    .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
    .on('data', (row) => {
      const name = row.name?.trim() || '';
      const email = row.email?.trim() || '';
      const mobile = row.mobile?.trim() || '';
      const designation = row.designation?.trim() || '';
      const category = row.category?.trim() || '';
      const company = row.company?.trim() || '';
      if (!name || !email || !mobile || !category) return;
      rowsToInsert.push([name, email, mobile, designation, category, company]);
    })
    .on('end', () => {
      // Recursive function to insert each row with a unique barcode
      function insertNext(index) {
        if (index >= rowsToInsert.length) {
          fs.unlink(filePath, () => {});
          broadcastUpdate();
          req.session.success = "CSV uploaded!";
          return res.redirect('/admin');
        }
        const [name, email, mobile, designation, category, company] = rowsToInsert[index];
        generateBarcode((err, barcode) => {
          if (err) {
            req.session.error = "Barcode generation error.";
            return res.redirect('/admin');
          }
          db.run(
            `INSERT OR IGNORE INTO attendees
             (name, email, mobile, designation, category, company, barcode, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, mobile, designation, category, company, barcode, 'csv'],
            () => insertNext(index + 1)
          );
        });
      }
      insertNext(0);
    })
    .on('error', (err) => {
      req.session.error = "CSV parsing error: " + err.message;
      res.redirect('/admin');
    });
});

// CSV Export (admin)
app.get('/export-csv', isAdmin, (req, res) => {
  db.all('SELECT * FROM attendees ORDER BY id', [], (err, rows) => {
    if (err) return res.send('DB error');
    const header = 'id,name,email,mobile,designation,category,company,printed,scanned,barcode,source';
    const lines = rows.map(r => {
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      return [
        r.id,
        esc(r.name),
        esc(r.email),
        esc(r.mobile),
        esc(r.designation),
        esc(r.category),
        esc(r.company),
        r.printed,
        r.scanned,
        esc(r.barcode),
        esc(r.source)
      ].join(',');
    });
    const csvOut = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendees.csv"');
    res.send(csvOut);
  });
});

// Print Designer Page (admin)
app.get('/print-designer', isAdmin, (req, res) => {
  let layoutData = null;
  if (fs.existsSync(LAYOUT_PATH)) {
    try {
      layoutData = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf8'));
    } catch (_) {}
  }
  res.render('print-designer', { user: req.session.user || null, layout: layoutData });
});

// Save Print Layout (admin)
app.post('/save-layout', isAdmin, (req, res) => {
  fs.writeFile(LAYOUT_PATH, JSON.stringify(req.body, null, 2), (err) => {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

// Client Dashboard (public / read-only)
app.get('/client-dashboard', (req, res) => {
  db.all('SELECT * FROM attendees ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.send('DB error');
    res.render('client-dashboard', { attendees: rows, user: null });
  });
});

// ---------- Socket.io ----------
io.on('connection', (socket) => {
  console.log('Client connected');
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));