# Node.js Async Patterns Best Practices

## Use Promise.all for Independent Operations
When multiple async operations don't depend on each other, run them concurrently with `Promise.all()`.

**Bad:**
```javascript
const users = await fetchUsers();
const posts = await fetchPosts();
const comments = await fetchComments();
// Total time = sum of all three
```

**Good:**
```javascript
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);
// Total time = max of all three
```

Use `Promise.allSettled()` when you want all results even if some fail. Use `Promise.all()` when any failure should abort the operation.

## Avoid Async Operations Inside Loops
Running async operations sequentially in a loop is a common performance mistake.

**Bad:**
```javascript
const results = [];
for (const id of userIds) {
  const user = await fetchUser(id); // Sequential - very slow
  results.push(user);
}
```

**Good:**
```javascript
const results = await Promise.all(
  userIds.map(id => fetchUser(id)) // Concurrent
);
```

For rate-limited APIs or when you need to control concurrency, use a library like `p-map` or `p-limit`:
```javascript
const pMap = require('p-map');
const results = await pMap(userIds, id => fetchUser(id), { concurrency: 5 });
```

## Avoid Mixing Callbacks and Promises
Stick to one async pattern. Convert callback-based APIs to promises using `util.promisify()`.

**Bad:**
```javascript
function readConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile('config.json', (err, data) => {
      if (err) reject(err);
      else resolve(JSON.parse(data));
    });
  });
}
```

**Good:**
```javascript
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

async function readConfig() {
  const data = await readFile('config.json', 'utf8');
  return JSON.parse(data);
}
```

Or use the built-in `fs.promises` API:
```javascript
const data = await fs.promises.readFile('config.json', 'utf8');
```

## Race Conditions
Be aware of race conditions in async code, especially with shared state.

**Bad:**
```javascript
let count = 0;
app.post('/increment', async (req, res) => {
  const current = await db.get('counter');
  await db.set('counter', current + 1); // Race condition!
  res.json({ count: current + 1 });
});
```

**Good:**
```javascript
app.post('/increment', async (req, res) => {
  const result = await db.query(
    'UPDATE counters SET value = value + 1 RETURNING value'
  ); // Atomic operation
  res.json({ count: result.rows[0].value });
});
```

Use atomic operations, transactions, or distributed locks for shared state.

## Proper Resource Cleanup with finally
Always clean up resources (connections, file handles, locks) even when errors occur.

**Bad:**
```javascript
async function processFile(path) {
  const handle = await fs.promises.open(path);
  const data = await handle.readFile(); // If this throws, handle is leaked
  await handle.close();
  return process(data);
}
```

**Good:**
```javascript
async function processFile(path) {
  const handle = await fs.promises.open(path);
  try {
    const data = await handle.readFile();
    return process(data);
  } finally {
    await handle.close(); // Always runs
  }
}
```

## Timeout for Async Operations
Always set timeouts for external calls to prevent hanging forever.

```javascript
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const result = await withTimeout(fetchExternalAPI(), 5000);
```

Use `AbortController` for cancellable fetch requests:
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
```

## Async Iterators for Streaming
Use `for await...of` for processing async streams of data.

```javascript
async function processLines(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
  });

  for await (const line of rl) {
    await processLine(line);
  }
}
```

## Error Handling in Promise.all
When using `Promise.all`, one rejection rejects everything. Use `Promise.allSettled` when you need partial results.

```javascript
const results = await Promise.allSettled([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3),
]);

const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason);
```

## Avoid Creating Unnecessary Promises
Don't wrap already-async operations in `new Promise`.

**Bad:**
```javascript
function getUser(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const user = await db.findUser(id);
      resolve(user);
    } catch (err) {
      reject(err);
    }
  });
}
```

**Good:**
```javascript
async function getUser(id) {
  return db.findUser(id);
}
```

The anti-pattern of using `async` inside `new Promise()` is dangerous because errors thrown inside the async function won't properly reject the promise.
