// Deliberately bad Node.js code for testing NodeSage

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const mysql = require('mysql');

const app = express();
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password123',  // Hardcoded credentials
  database: 'myapp'
});

const API_KEY = 'sk-1234567890abcdef';  // Hardcoded secret

// SQL Injection vulnerability
app.get('/users', (req, res) => {
  const query = `SELECT * FROM users WHERE name = '${req.query.name}'`;
  db.query(query, (err, results) => {
    res.json(results);
  });
});

// Command injection vulnerability
app.get('/ping', (req, res) => {
  exec(`ping -c 1 ${req.query.host}`, (err, stdout) => {
    res.send(stdout);
  });
});

// Blocking event loop with sync file read
app.get('/config', (req, res) => {
  const data = fs.readFileSync('/etc/config.json');
  res.json(JSON.parse(data));
});

// Path traversal vulnerability
app.get('/files/:name', (req, res) => {
  const filePath = './uploads/' + req.params.name;
  const data = fs.readFileSync(filePath);
  res.send(data);
});

// No error handling on async operation
app.get('/data', async (req, res) => {
  const result = await fetch(`http://${req.query.url}/api/data`);
  const data = await result.json();
  res.json(data);
});

// Memory leak - unbounded cache
const cache = {};
app.get('/cached/:key', async (req, res) => {
  if (!cache[req.params.key]) {
    cache[req.params.key] = await db.query(`SELECT * FROM data WHERE key = '${req.params.key}'`);
  }
  res.json(cache[req.params.key]);
});

// N+1 query pattern
app.get('/posts', async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  for (const user of users) {
    user.posts = await db.query(`SELECT * FROM posts WHERE user_id = ${user.id}`);
  }
  res.json(users);
});

// No input validation
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  db.query(`INSERT INTO users (username, email, password) VALUES ('${username}', '${email}', '${password}')`);
  res.json({ success: true });
});

app.listen(3000);
