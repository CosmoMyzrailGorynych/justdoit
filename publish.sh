#!/bin/bash

read -p "Vanilla image id: " vanilla
read -p "Alpine image id: " alpine
read -p "Full version (with v at the beginning): " version

IFS='.' read -ra splitVersion <<< "$version"

podman push $vanilla cosmomyzrailgorynych/justdoit:$version
podman push $vanilla cosmomyzrailgorynych/justdoit:${splitVersion[0]}.${splitVersion[1]}
podman push $vanilla cosmomyzrailgorynych/justdoit:${splitVersion[0]}
podman push $vanilla cosmomyzrailgorynych/justdoit:latest

podman push $alpine cosmomyzrailgorynych/justdoit:$version-alpine
podman push $alpine cosmomyzrailgorynych/justdoit:${splitVersion[0]}.${splitVersion[1]}-alpine
podman push $alpine cosmomyzrailgorynych/justdoit:${splitVersion[0]}-alpine
podman push $alpine cosmomyzrailgorynych/justdoit:latest-alpine


