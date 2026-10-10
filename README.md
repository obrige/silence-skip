# Silence Skip

Smart silence detection and skipping for video/audio in browser.

## Quick Start

\`\`\`bash
./setup.sh
\`\`\`

Enter your GitHub username. Done.

## Install

### Chrome
Download \`silence-skip-chrome-vX.Y.Z.zip\` from Releases -> \`chrome://extensions/\` -> Developer mode -> Load unpacked -> select \`src/\`

### Firefox (unsigned by default)
Download \`silence-skip-firefox-vX.Y.Z.xpi\` from Releases -> drag into Firefox.

Firefox will show "unsigned extension" warning. Click through -> extension works.

### Firefox (signed - optional, 5 min setup)
For a warning-free signed build:

1. Sign up at https://addons.mozilla.org
2. Get JWT credentials at https://addons.mozilla.org/en-US/developers/addon/submit/upload-listed
3. Add to repo Settings -> Secrets and variables -> Actions:
   - \`AMO_JWT_ISSUER\`
   - \`AMO_JWT_SECRET\`
4. (One-time) Manually upload one version to AMO to activate the API key
5. Next tag will be auto-signed

## Hotkeys

- Alt+S toggle skip
- Alt+J jump to next sound
- Alt+. skip 10s

## License

MIT