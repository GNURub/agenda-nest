# Multiple Queues Example

This example boots two isolated queues, `notifications` and `reports`, using the package from the repository root via `file:../..`.

## Install

```bash
npm install
```

## Run

```bash
npm run start
```

## Test

The example reuses the root Vitest configuration and runs the `example-smoke` project.

```bash
npm run test
npm run test:e2e
npm run test:cov
```

## What It Covers

- Bootstrapping multiple queues from separate Nest modules.
- Scheduling recurring jobs with queue-local namespaces.
- Validating the example against the root package source without publishing a tarball first.
