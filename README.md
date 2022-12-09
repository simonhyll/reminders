<div align="center">

# Reminders

</div>

## Getting started

```shell
pnpm install
pnpm build
pnpm dist
node dist/index.js
```

## In a workflow

```yaml
    steps:
      - name: Create reminders
        uses: simonhyll/reminders@v1
```

Here's a full example workflow.

```yaml
name: Reminders

on:
  schedule:
    - "0 0 * * *"
  push:
    branches:
      - main

permissions:
  issues: write
  repository-projects: read
  contents: read

jobs:
  todos:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Run reminders
        uses: simonhyll/reminders@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
