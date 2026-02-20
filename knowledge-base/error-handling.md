# Node.js Error Handling Best Practices

## Always Handle Promise Rejections
Unhandled promise rejections can crash your application (Node.js terminates on unhandled rejections by default).

**Bad:**
```javascript
async function fetchUser(id) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return user;
}
// No error handling - if db.query fails, unhandled rejection
fetchUser(1).then(user => console.log(user));
```

**Good:**
```javascript
async function fetchUser(id) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return user;
}
fetchUser(1)
  .then(user => console.log(user))
  .catch(err => console.error('Failed to fetch user:', err));
```

Always attach `.catch()` to promises or use `try/catch` with `await`.

## Use try/catch with async/await
Wrap async operations in try/catch blocks, especially at route handler boundaries.

**Bad:**
```javascript
app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id); // Can throw
  res.json(user);
});
```

**Good:**
```javascript
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err); // Pass to Express error handler
  }
});
```

## Create Custom Error Classes
Use custom errors to distinguish between error types and handle them appropriately.

```javascript
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}
```

Distinguish between operational errors (expected failures like invalid input, network timeouts) and programmer errors (bugs like TypeError, null reference). Operational errors should be handled gracefully; programmer errors may warrant a restart.

## Centralized Error Handling in Express
Use a centralized error-handling middleware instead of handling errors in every route.

```javascript
// Error handling middleware (must have 4 params)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  console.error(err.stack);
  res.status(statusCode).json({ error: message });
});
```

## Graceful Shutdown
Handle process signals to clean up resources before shutting down.

```javascript
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.end();
    process.exit(0);
  });
  // Force exit after timeout
  setTimeout(() => process.exit(1), 10000);
});
```

Always close database connections, stop accepting new requests, and finish processing in-flight requests before exiting.

## Don't Swallow Errors
Never catch errors without handling them. At minimum, log the error.

**Bad:**
```javascript
try {
  await riskyOperation();
} catch (err) {
  // Silently ignored - you'll never know it failed
}
```

**Good:**
```javascript
try {
  await riskyOperation();
} catch (err) {
  logger.error('riskyOperation failed:', err);
  // Decide: retry, rethrow, return default, or fail
  throw err;
}
```

## Error Propagation
Let errors bubble up to a level that can handle them meaningfully. Don't catch and re-throw the same error without adding context.

**Bad:**
```javascript
try {
  return await fetchData();
} catch (err) {
  throw err; // Pointless catch-and-rethrow
}
```

**Good:**
```javascript
try {
  return await fetchData();
} catch (err) {
  throw new AppError(`Failed to fetch data for report: ${err.message}`, 500);
}
```

## Global Error Handlers
Set up global handlers as a safety net, but don't rely on them for normal error handling.

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production: log to error tracking service, then exit
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Always exit after uncaughtException - state may be corrupt
  process.exit(1);
});
```

## Avoid Throwing in Callbacks
In callback-style code, always pass errors as the first argument. Never throw inside callbacks.

**Bad:**
```javascript
fs.readFile('config.json', (err, data) => {
  if (err) throw err; // This will crash the process
  process.config = JSON.parse(data);
});
```

**Good:**
```javascript
fs.readFile('config.json', (err, data) => {
  if (err) {
    console.error('Failed to read config:', err);
    return;
  }
  try {
    process.appConfig = JSON.parse(data);
  } catch (parseErr) {
    console.error('Invalid config JSON:', parseErr);
  }
});
```

## Logging Best Practices
- Use a structured logger (winston, pino) instead of `console.log`
- Include context: request ID, user ID, operation name
- Log at appropriate levels: error, warn, info, debug
- Don't log sensitive data (passwords, tokens, PII)
- In production, send logs to a centralized service
