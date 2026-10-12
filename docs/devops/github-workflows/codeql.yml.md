# CodeQL Workflow Template

**Target:** `.github/workflows/codeql.yml`  
**Purpose:** Static analysis (SAST) for JavaScript/TypeScript and optionally Rust

```yaml
name: CodeQL

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 7 * * 1'   # weekly Monday

permissions:
  contents: read
  security-events: write
  actions: read

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]
        # Add rust when CodeQL support/process is confirmed for the repo
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

## Security Notes

- Requires GitHub Advanced Security for private repos (public repos: CodeQL available under GitHub defaults — confirm for your plan).
- Pin CodeQL actions to SHA for production hardening.
- Do not run CodeQL with elevated secrets.
