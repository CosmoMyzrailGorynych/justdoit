#
# Vanilla image
#

FROM node:lts

LABEL Description="This image takes an URL to a repo, a build command, and serves a static site for you. No bullshit included."
LABEL Vendor="Comigo"

# Do not use the root user
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
RUN mkdir /home/node/.ssh
RUN chmod 700 /home/node/.ssh
RUN echo 'echo $GIT_DEPLOY_PASSPHRASE' > /home/node/.ssh-askpass
ENV SSH_ASKPASS=/home/node/.ssh-askpass
ENV SSH_ASKPASS_REQUIRE=force
ENV GIT_ASKPASS=/home/node/.ssh-askpass
RUN chmod 600 /home/node/.ssh-askpass

ADD --chown=node:node src /home/node/justdoit/

WORKDIR /home/node/justdoit/
RUN npm install
RUN npm cache clean --force
RUN npm prune --production

CMD eval "$(ssh-agent -s)" && node --trace-warnings index.js
EXPOSE 8080