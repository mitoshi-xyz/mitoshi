# README diagrams

The README pictures are rendered from `readme-system.mmd` and `readme-funding.mmd`. Edit the Mermaid source, then
render light and dark PNGs into `.github/assets/` with Mermaid CLI. The committed images use CLI 11.15.0 at 2× scale.

```sh
mmdc -i .github/diagrams/readme-system.mmd -o .github/assets/system-map-light.png -c .github/diagrams/mermaid-light.json -b '#F4EEE3' -s 2
mmdc -i .github/diagrams/readme-system.mmd -o .github/assets/system-map-dark.png -c .github/diagrams/mermaid-dark.json -b '#050505' -s 2
mmdc -i .github/diagrams/readme-funding.mmd -o .github/assets/funding-flow-light.png -c .github/diagrams/mermaid-light.json -b '#F4EEE3' -s 2
mmdc -i .github/diagrams/readme-funding.mmd -o .github/assets/funding-flow-dark.png -c .github/diagrams/mermaid-dark.json -b '#050505' -s 2
```

Mermaid CLI needs a local Chromium browser. On a machine where Puppeteer cannot find one, pass `-p` with a local
Puppeteer config containing its `executablePath`.
