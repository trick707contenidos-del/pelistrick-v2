const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const db = new Database('database.db');

// Crear tablas
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'client',
  credits INTEGER DEFAULT 0,
  parent_id INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  type TEXT,
  url TEXT,
  image TEXT,
  category TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  site_name TEXT DEFAULT 'Pelistrick',
  whatsapp TEXT
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');
`);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'pelistrick2024', resave: false, saveUninitialized: false }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Asegurar carpetas
if (!fs.existsSync('public/uploads')) fs.mkdirSync('public/uploads', { recursive: true });

const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
}

// RUTAS PUBLICAS
app.get('/', (req, res) => {
  const contents = db.prepare('SELECT * FROM contents ORDER BY id DESC').all();
  const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
  res.render('index', { contents, settings });
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(username, password);
  if (user) {
    req.session.user = user;
    if (user.role === 'admin') return res.redirect('/admin');
    res.redirect('/');
  } else {
    res.send('Usuario o clave mal');
  }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// ADMIN
app.get('/admin', isAdmin, (req, res) => {
  const contents = db.prepare('SELECT * FROM contents').all();
  const users = db.prepare('SELECT * FROM users').all();
  const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
  res.render('admin', { contents, users, settings, user: req.session.user });
});

app.post('/admin/add-content', isAdmin, upload.single('image'), (req, res) => {
  const { title, type, url, category } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : '';
  db.prepare('INSERT INTO contents (title,type,url,image,category) VALUES (?,?,?,?,?)').run(title,type,url,image,category);
  res.redirect('/admin');
});

app.get('/admin/delete-content/:id', isAdmin, (req, res) => {
  db.prepare('DELETE FROM contents WHERE id=?').run(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/add-user', isAdmin, (req, res) => {
  const { username, password, role, credits } = req.body;
  try {
    db.prepare('INSERT INTO users (username,password,role,credits,parent_id) VALUES (?,?,?,?,?)').run(username,password,role,credits||0,req.session.user.id);
  } catch(e) {}
  res.redirect('/admin');
});

app.get('/admin/delete-user/:id', isAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/settings', isAdmin, (req, res) => {
  db.prepare('UPDATE settings SET site_name=?, whatsapp=? WHERE id=1').run(req.body.site_name, req.body.whatsapp);
  res.redirect('/admin');
});

app.get('/player/:id', (req, res) => {
  const content = db.prepare('SELECT * FROM contents WHERE id=?').get(req.params.id);
  if (!content) return res.send('No existe');
  res.render('player', { content });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Pelistrick corriendo en ' + PORT));
