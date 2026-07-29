#!/bin/bash
git config user.name "Norris-King"
git config user.email "Norris-King@users.noreply.github.com"
git add .
git commit --amend --no-edit --author="Norris-King <Norris-King@users.noreply.github.com>"
git push "https://NorrisKing:${GITHUB_TOKEN}@github.com/NorrisKing/music_scheduler.git" master -f
