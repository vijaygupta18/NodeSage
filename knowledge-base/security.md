# Node.js Security Best Practices

## SQL Injection Prevention
Never concatenate user input directly into SQL queries. Always use parameterized queries or prepared statements.

**Bad:**
```javascript
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
db.query(query);
```

**Good:**
```javascript
const query = 'SELECT * FROM users WHERE id = $1';
db.query(query, [req.params.id]);
```

Use an ORM like Prisma, Sequelize, or Knex that automatically parameterizes queries. If writing raw SQL, always use placeholders (`$1`, `?`) and pass values as a separate array.

## Command Injection Prevention
Never pass user input directly to `child_process.exec()` or similar shell-executing functions. Use `execFile()` or `spawn()` with an arguments array instead.

**Bad:**
```javascript
const { exec } = require('child_process');
exec(`ls ${userInput}`); // Shell injection possible
```

**Good:**
```javascript
const { execFile } = require('child_process');
execFile('ls', [userInput]); // Arguments are not shell-interpreted
```

Avoid `eval()`, `Function()`, `setTimeout(string)`, and `setInterval(string)` with user-controlled data. These all execute arbitrary code.

## Prototype Pollution Prevention
Do not use recursive merge or deep clone functions on user-controlled objects without sanitizing keys like `__proto__`, `constructor`, and `prototype`.

**Bad:**
```javascript
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object') {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
merge({}, JSON.parse(userInput)); // Can pollute Object.prototype
```

**Good:**
```javascript
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.includes(key)) continue;
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = safeMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
```

## Input Validation
Always validate and sanitize user input at the boundary of your application. Use a schema validation library like `zod`, `joi`, or `ajv`.

- Validate types, lengths, ranges, and formats
- Reject unexpected fields (allowlist, don't denylist)
- Sanitize HTML output to prevent XSS (use `DOMPurify` or similar)
- Validate Content-Type headers on incoming requests

## Secrets Management
Never hardcode secrets, API keys, or passwords in source code. Use environment variables or a secrets manager.

**Bad:**
```javascript
const API_KEY = 'sk-12345abcdef';
const dbPassword = 'supersecret123';
```

**Good:**
```javascript
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY environment variable is required');
```

- Use `.env` files for local development with `dotenv`, but never commit them
- Add `.env` to `.gitignore`
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) in production
- Rotate secrets regularly

## SSRF (Server-Side Request Forgery) Prevention
When making HTTP requests based on user input, validate and restrict the target URL.

- Block requests to internal/private IP ranges (127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.x.x)
- Use an allowlist of permitted domains when possible
- Don't follow redirects blindly — a redirect could point to an internal service
- Validate URL scheme (only allow `https://`)

## Path Traversal Prevention
Never use user input directly in file paths. Sanitize and restrict to a base directory.

**Bad:**
```javascript
const filePath = `./uploads/${req.params.filename}`;
fs.readFile(filePath); // User can send "../../etc/passwd"
```

**Good:**
```javascript
const path = require('path');
const baseDir = path.resolve('./uploads');
const filePath = path.resolve(baseDir, req.params.filename);
if (!filePath.startsWith(baseDir)) {
  throw new Error('Invalid file path');
}
fs.readFile(filePath);
```

## Security Headers
Always set security headers in HTTP responses:
- `Helmet` middleware sets sensible defaults
- `Content-Security-Policy` to prevent XSS
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` for HTTPS enforcement
- `X-Frame-Options` to prevent clickjacking

## Rate Limiting
Apply rate limiting to prevent brute-force attacks and abuse:
- Use `express-rate-limit` or similar middleware
- Apply stricter limits to authentication endpoints
- Consider per-user and per-IP rate limiting
- Return appropriate `429 Too Many Requests` responses

## Authentication and Session Security
- Use `bcrypt` or `argon2` for password hashing (never MD5 or SHA for passwords)
- Set secure cookie flags: `httpOnly`, `secure`, `sameSite`
- Implement CSRF protection for state-changing operations
- Use short-lived JWTs with refresh token rotation
- Invalidate sessions on password change
