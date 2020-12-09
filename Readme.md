JUSTDOIT is a container for making home-brewn JAM-stack apps without bullshit. Kubernetes-friendly.

## About

This image does the following:

1. (Conditionally) adds a deploy key for your repo;
2. Clones the repo;
3. Runs a setup command specified by you (default is `npm install`);
3. Runs a build command specified by you (or defaults to `npm run build`);
4. Serves a static HTTP server on port `8080`;
5. Fetches the repo at a given interval and rebuilds your site if the repo changed.

> Only a single branch is cloned, with the default number of commits of 10 (it fetches only a part of the history).

This image is based on [node.js LTS image](https://hub.docker.com/_/node). It contains npm and yarn. Made with [Podman](https://podman.io/).

## Environment variables

* `GIT_URL` **(required)** — the URL to clone. For public repos, it can be anything supported by `git clone`. If you are using a private repo, a `git@…` URL with a deploy key is required.
* `GIT_DEPLOY_KEY` — a private key that has read access to the repo at `GIT_URL`. It must be a string that has:
    1. its lines joined and split with literal `\n`;
    2. an additional `\n` at the end of it.
* `GIT_DEPLOY_PASSPHRASE` — suits both as a potential passphrase and a password for git requests. Usually not needed at all; defaults to an empty string.
* `GIT_DEPLOY_FORMAT` — `rsa`, `ed25519` and such. Defaults to `rsa`. Sets the filename of a private key in the `~/.ssh` directory.
* `GIT_DEPTH` — the number of commits to fetch from the repo. Other commits will not be downloaded. Defaults to `10`.
* `GIT_PULL_RATE` — the duration of a pause between builds, in minutes. Defaults to `5` (five minutes). Fractional periods (like `1.5`) can be used.
* `GIT_BRANCH` — the branch to checkout. Other branches will not be downloaded. Defaults to `master`.

---

* `BUILD_SETUP` — a shell script that will be executed once after a repo is cloned. Multiline strings (split with literal `\n`) will be split into separate sequential commands. Escaped lines (`\\n`) will be joined into one line.
* `BUILD_SCRIPT` — a shell script that will be executed after a repo is cloned or successfully cloned. Behaves in the same way as `BUILD_SETUP`.
* `BUILD_TIMEOUT` — Maximum time to wait for a build to finish, in minutes.
* `BUILD_AUTOWIPE` — Whether or not the folder at `SERVE_DIR` should be removed before building the repo. Defaults to `1` (wipe); set to `0` to disable it.

---

* `SERVE_DIR` — a directory inside your repo to serve. Defaults to `./dist`.
* `SERVE_DOTFILES` — `0` or `1` (default). Whether files with dots at the beginning of their name (like `.gitignore`) will be served.
* `SERVE_404` — a path to a file that will be served if a client opens an invalid URL. Defaults to `404.html`. If the file is not found, a plain-text response will be given.

## Support

Eh.

## Bugs & PRs

Send them to [this repo](). Making stuff for podman/docker/crio/whatever is the last thing I would usually do, so don't await for active maintenance. You get stuff for free without any warrancies.