# Node.js Performance Best Practices

## Don't Block the Event Loop
Node.js is single-threaded. CPU-intensive or synchronous I/O operations block the event loop and prevent handling other requests.

**Bad:**
```javascript
app.get('/data', (req, res) => {
  const data = fs.readFileSync('/large-file.json'); // Blocks event loop
  res.json(JSON.parse(data));
});
```

**Good:**
```javascript
app.get('/data', async (req, res) => {
  const data = await fs.promises.readFile('/large-file.json');
  res.json(JSON.parse(data));
});
```

Common event loop blockers:
- `fs.readFileSync`, `fs.writeFileSync` and all sync fs methods
- `JSON.parse()` / `JSON.stringify()` on very large objects
- Complex regex on untrusted input (ReDoS)
- Tight `for` loops over large datasets
- Cryptographic operations without async variants (`crypto.pbkdf2Sync`)

Use `worker_threads` for CPU-intensive operations or offload to a queue.

## Use Streams for Large Data
Don't load entire files or large datasets into memory. Use streams to process data in chunks.

**Bad:**
```javascript
app.get('/download', async (req, res) => {
  const data = await fs.promises.readFile('/large-file.csv');
  res.send(data); // Entire file in memory
});
```

**Good:**
```javascript
app.get('/download', (req, res) => {
  const stream = fs.createReadStream('/large-file.csv');
  stream.pipe(res); // Streams data in chunks
});
```

Use streams for:
- File uploads and downloads
- Transforming large datasets (use `Transform` streams)
- Reading from databases with cursor-based pagination
- Processing log files

## Memory Leak Prevention
Common causes of memory leaks in Node.js:

1. **Global variables accumulating data:** Avoid storing request-specific data in module-level variables
2. **Event listeners not removed:** Always remove listeners when done, especially in long-lived processes
3. **Closures holding references:** Large objects captured in closures persist until the closure is garbage collected
4. **Unbounded caches:** Use LRU caches with a maximum size, not plain objects that grow forever

**Bad:**
```javascript
const cache = {}; // Grows forever
function getData(key) {
  if (!cache[key]) {
    cache[key] = fetchFromDB(key);
  }
  return cache[key];
}
```

**Good:**
```javascript
const LRU = require('lru-cache');
const cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 });
function getData(key) {
  if (!cache.has(key)) {
    cache.set(key, fetchFromDB(key));
  }
  return cache.get(key);
}
```

## Database Query Optimization
Avoid N+1 query patterns. Fetch related data in batch instead of individual queries in a loop.

**Bad:**
```javascript
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.posts = await db.query('SELECT * FROM posts WHERE user_id = $1', [user.id]);
}
```

**Good:**
```javascript
const users = await db.query('SELECT * FROM users');
const userIds = users.map(u => u.id);
const posts = await db.query('SELECT * FROM posts WHERE user_id = ANY($1)', [userIds]);
const postsByUser = groupBy(posts, 'user_id');
users.forEach(u => u.posts = postsByUser[u.id] || []);
```

Additional database tips:
- Add indexes for frequently queried columns
- Use connection pooling (e.g., `pg-pool`)
- Set appropriate pool sizes (too many connections can hurt)
- Use `EXPLAIN ANALYZE` to debug slow queries

## Clustering and Scaling
Use all available CPU cores with the `cluster` module or a process manager like PM2.

```javascript
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isPrimary) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  app.listen(3000);
}
```

## Caching Strategies
- Cache expensive computations and frequent DB queries
- Use Redis or in-memory cache with TTL
- Cache at the right level: HTTP (Cache-Control headers), application (Redis), database (query cache)
- Invalidate caches on data changes
- Use ETags for conditional responses

## Compression
Enable gzip/brotli compression for HTTP responses to reduce bandwidth:
```javascript
const compression = require('compression');
app.use(compression());
```

## Avoid Unnecessary Middleware
Each middleware adds latency to every request. Only apply middleware where needed:
```javascript
// Bad: body parser for all routes
app.use(express.json());

// Better: only for routes that need it
app.post('/api/data', express.json(), handler);
```

## Monitoring and Profiling
- Use `--inspect` flag for Node.js debugging and profiling
- Monitor event loop lag with `perf_hooks`
- Track memory usage with `process.memoryUsage()`
- Use APM tools (DataDog, New Relic) in production
- Set up health check endpoints
