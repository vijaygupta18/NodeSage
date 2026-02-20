# Node.js Dependency Management Best Practices

## Always Use Lock Files
Commit your `package-lock.json` (npm) or `yarn.lock` (Yarn) or `pnpm-lock.yaml` (pnpm) to version control. Lock files ensure deterministic installs across environments.

- Never add lock files to `.gitignore`
- Use `npm ci` in CI/CD pipelines instead of `npm install` (faster and respects lock file exactly)
- Resolve lock file conflicts carefully — don't just delete and regenerate

## Audit Dependencies Regularly
Run `npm audit` regularly to check for known vulnerabilities.

```bash
npm audit          # Check for vulnerabilities
npm audit fix      # Auto-fix compatible updates
npm audit --json   # Machine-readable output for CI
```

Set up automated tools:
- GitHub Dependabot for automated security PRs
- Snyk for deep dependency scanning
- `npm-check-updates` to find available updates

## Minimize Dependencies
Every dependency is a supply chain risk. Before adding a package:
- Check if the standard library already provides the functionality
- Check the package's maintenance status, download count, and last update
- Check if the package has too many transitive dependencies
- Consider the bundle size impact
- Prefer well-maintained packages with active contributors

**Bad:**
```javascript
const isOdd = require('is-odd');     // 1-liner package
const leftPad = require('left-pad'); // Built into String.padStart
```

**Good:**
```javascript
const isOdd = (n) => n % 2 !== 0;
const leftPad = (str, len) => str.padStart(len);
```

Node.js built-in modules cover many common needs:
- `crypto` for hashing and random values
- `fs/promises` for file operations
- `path` for path manipulation
- `url` for URL parsing
- `util` for promisify, format, types

## Pin Versions Carefully
Understand semver ranges in `package.json`:
- `^1.2.3` — allows minor and patch updates (default, usually fine)
- `~1.2.3` — allows only patch updates (more conservative)
- `1.2.3` — exact version (most deterministic)

For production applications, the lock file provides determinism. But for critical dependencies, consider pinning exact versions to avoid surprises.

## Remove Unused Dependencies
Dead dependencies increase install time, attack surface, and bundle size.

```bash
npx depcheck        # Find unused dependencies
npm prune           # Remove packages not in dependencies
```

Review `package.json` periodically. If a dependency isn't imported anywhere, remove it.

## Separate devDependencies
Keep development tools in `devDependencies` to reduce production install size.

```json
{
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

In production, install with `npm ci --omit=dev` to skip dev dependencies.

## Use engines Field
Specify the Node.js version your project requires:

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

This prevents running on incompatible Node.js versions and documents requirements.

## Supply Chain Security
- Enable npm's `--ignore-scripts` for untrusted packages
- Review package contents before install: `npm pack <package> && tar -xzf <package>.tgz`
- Use `npm config set ignore-scripts true` globally and explicitly allow scripts for trusted packages
- Consider using a private registry (Verdaccio, Artifactory) for additional control
- Be wary of typosquatting — double-check package names

## Keep Node.js Updated
- Use the current LTS version for production
- Security patches are critical — apply them promptly
- Use a version manager (nvm, fnm, volta) to easily switch versions
- Test your app against new Node.js versions before upgrading in production

## Scripts Best Practices
Define common operations as npm scripts:

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/",
    "precommit": "lint-staged"
  }
}
```

Avoid running arbitrary shell commands in npm scripts that could be injection vectors.
