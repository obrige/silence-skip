#!/bin/bash
set -e
read -p "GitHub username: " USERNAME
for f in src/manifest.json README.md; do
  if [ -f "$f" ]; then sed -i.bak "s/GH_USERNAME/${USERNAME}/g" "$f" && rm -f "$f.bak"; fi
done
git init
git add .
git commit -m "init: silence skip v1.0.0"
gh repo create silence-skip --public --source=. --push 2>/dev/null || echo "Create repo manually then: git remote add origin git@github.com:${USERNAME}/silence-skip.git && git push -u origin main"
git tag v1.0.0
git push --tags 2>/dev/null || echo "After creating repo: git push --tags"
echo "Done! Watch: https://github.com/${USERNAME}/silence-skip/actions"