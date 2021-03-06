console.log('Inserting cartridge…');

const path = require('path'),
      fs = require('fs-extra'),
      http = require('http');

const serveStatic = require('serve-static'),
      execa = require('execa');

const hostnamePattern = /(^git@(?<hostnameGit>\S+):\S+$|^https?:\/\/(?<hostnameHttp>\S+?)\/+\S+)/m;

const projCwd = path.join(process.cwd(), './project');
let page404 = '404 not found';
let building;

console.log(`
                          .*%/.
                        /(/,.,,*((
                       *.*%&&@@@&/*
                       .*&@@>@@<@&(.
                      .%&@&&&@&&@@&.
                        /&@&&O&@@&*
                        .,(#%%&&##.
                      */ /%**/((&@%*/.
                  ./* .  ,&&&&&@@#*****,
                */,,*....,,/%%#(****,,*//(.
              ,/**,.. ..,,,,,*******,.,***/,
             /*,,,,. ,***************, .***,
              ((#/*, .,,,**,,,***,,,,,. ,,/#*
             .&&&@@&. .,,,,,,,,,,,,,,* *&@@&%
             *&&@@@,   .,,,,,,,,,,,,**,%&@@@&,
             %&@@&%.  ..,,,,,,,,,,,,//(#%&&&&%
             #&&&@/   ..,,,,,,,,,,,,,//##%%&&&
             (&&&@#    .....,.,,...,* .#%&&@&&.
              #&&&&.    ..........,,   (%&&&&(
               (&&&%.       ...        /%&&&%
                (&&&%/////%,   .. /###(%(,/%,
               .,,&@@@&@(            %@@@@&,
              ,,..*&&&@@&%(.     /#(#&&@@&*
             .   .,,/&%&#&,,      *(#&(%(/(.
            ..  ..,*,,(*/*,.  ...,,,,,*,****
     &@ *@/.&@ ./@@@/ @@@&%   .@@@@@,.%@@@@@#    (@/%&@@&/
    ,@( %@..&@.(@/    ,@#     (@* (@*.@%  %@.    &&  (@,
    %@..@# ,@#  #@&   #@,     &&  &@.#@, .@&    /@/  @&
   .@% #@, #@,   ,@# .@%     /@/ /@( @&  #@,    &@  /@*
 %&@@. #@&&@/ (&&@#  (@*     &@&&&*  %@&&@,    *@(  &@ .&%

                         by CoMiGo

`);

const defaults = {
    GIT_URL: null,
    GIT_DEPLOY_KEY: void 0,
    GIT_DEPLOY_FORMAT: 'rsa',
    GIT_DEPTH: 10,
    // in minutes
    GIT_PULL_RATE: 1,
    GIT_BRANCH: 'master',

    BUILD_SETUP: 'npm install',
    BUILD_SCRIPT: 'npm run build',
    // in minutes
    BUILD_TIMEOUT: 30,
    BUILD_HOOK: '',
    BUILD_AUTOWIPE: 1,
    BUILD_USE_SUBSTITUTE: 1,

    SERVE_DIR: 'dist',
    // 0 or 1
    SERVE_DOTFILES: 1,
    SERVE_404: '404.html'
};
const opts = Object.assign({}, defaults, process.env);
// Fix types for Number values
for (const key of ['GIT_DEPTH', 'GIT_PULL_RATE', 'BUILD_TIMEOUT', 'SERVE_DOTFILES', 'BUILD_AUTOWIPE']) {
    opts[key] = Number(opts[key]);
}
// Split multi-string values
for (const key of ['GIT_DEPLOY_KEY', 'BUILD_SETUP', 'BUILD_SCRIPT']) {
    if (opts[key]) {
        opts[key] = opts[key].replace(/(?<!\\)\\n/g, '\n');
    }
}
if (!opts.GIT_URL) {
    throw new Error('You know, GIT_URL environment variable is a required one.');
}
const sshAddPrefix = `ssh-add -k /home/node/.ssh/id_${opts.GIT_DEPLOY_FORMAT} &&`;

const buildOpts = {
    forceKillAfterTimeout: 1000 * 60 * opts.BUILD_TIMEOUT,
    cwd: projCwd,
    shell: true,
    all: true
};

const send404 = function send404(res) {
    res.writeHead(404, 'Resource not found', {
        'Content-Type' : 'text/html'
    });
    res.write(page404);
    res.end();
};

const manageStatusPage = async ok => {
    const pubDir = path.join('./project', opts.SERVE_DIR);
    if (ok) {
        await fs.mkdir(pubDir, {
            recursive: true,
            mode: 0o760
        });
        await fs.writeFile(path.join(pubDir, 'justdoitstatus.json'), '{"ok":true}', 'utf-8');
    } else {
        try {
            const statusPath = path.join(pubDir, 'justdoitstatus.json');
            // will fail if a file does not exists
            await fs.lstat(statusPath);
            await fs.rm(statusPath);
        } catch (e) {
            // nothing to do
            void 0;
        }
    }
};

const commandSafeSplit = /(?<!\\)\n/g;
const clearLine = /\\\n/g
const execScript = async (script, opts) => {
    const lines = script.split(commandSafeSplit);
    for (let line of lines) {
        line = line.replace(clearLine, ' ').trim();
        if (line === '') {
            continue;
        }
        console.log('> ' + line);
        const {all, stdout} = await execa.command(line, opts);
        console.log(all || stdout || '');
    }
};

// Git stuff
/**
 * @returns {boolean} Whether or not the repo state changed.
 */
const pull = async force=> {
    let command = `${sshAddPrefix} git pull`;
    console.log('Pulling the repo…');
    const {stdout} = await execa.command(command, {
        cwd: projCwd,
        shell: true
    });
    if (stdout === '' || stdout === 'Already up-to-date.' || stdout === 'Already up to date.') {
        console.log('Looks like there are no changes in the repo.');
        return false;
    }
    console.log(stdout);
    return true;
};
const clone = async () => {
    console.log('Cloning the repo for the first time…');
    // let command = `${sshAddPrefix} git clone ${opts.GIT_URL} `;
    let command = `${sshAddPrefix} git clone ${opts.GIT_URL} --single-branch --recurse-submodules --branch ${opts.GIT_BRANCH} `;
    if (opts.GIT_DEPTH < Infinity) {
        command += `--depth=${opts.GIT_DEPTH} `;
    }
    command += './project';
    const {stdout} = await execa.command(command, {
        shell: true,
        all: true
    });
    console.log('Cloned!');
};
/**
 * @returns {boolean} Whether or not the repo state changed.
 */
const sync = async () => {
    let exists = false;
    try {
        // Check if a project already exists
        await fs.access('./project', fs.R_OK | fs.W_OK);
        exists = true;
    } catch (e) {
        exists = false;
    }
    if (exists) {
        return await pull();
    }
    await clone();
    return true;
};

const setup = () => {
    console.log('Running the setup command…')
    return execScript(opts.BUILD_SETUP, {
        cwd: projCwd,
        shell: true,
        all: true
    });
};
const build =  async () => {
    building = true;
    const pubDir = path.join('./project', opts.SERVE_DIR);

    if (opts.BUILD_AUTOWIPE === 1) {
        console.log('Wiping the old build dir…');
        try {
            await fs.rmdir(pubDir, {
                recursive: true
            });
            console.log('Wiped!');
        } catch (e) {
            console.error('Got an error while trying to remove the build dir:', e);
            console.log('If it fails here, then something really odd and probably bad happened. I will try moving on, though.');
        }
    }

    console.log('Building…');
    try {
        await execScript(opts.BUILD_SCRIPT, buildOpts);
        manageStatusPage(true);
        console.log('Build complete.');
    } catch(e) {
        console.error('Build failed.');
        console.error(e.message);
        console.error(e.all);
        manageStatusPage(false);
    } finally {
        building = false;
    }

    if (opts.BUILD_USE_SUBSTITUTE === 1) {
        console.log('Removing the old build copy…')
        await fs.rmdir('./substitute', {
            recursive: true
        });
        console.log('Duplicating the new build as a substitute for the next builds…');
        await fs.copy(pubDir, './substitute');
        console.log('Done.');
    }

    // wait *between* builds to prevent overlapping of processes
    scheduleRebuild();

    fs.readFile(path.join(pubDir, opts.SERVE_404), 'utf-8').then(data => {
        page404 = data;
    }).catch(e => {
        console.error('Could not read a page for 404 errors :c', e);
        console.log('Will serve a default plain-text one.');
        page404 = '404 not found';
    });
};
let rebuildTimeout;
const scheduleRebuild = () => {
    if (rebuildTimeout) {
        clearTimeout(rebuildTimeout);
        rebuildTimeout = void 0;
    }
    rebuildTimeout = setTimeout(async () => {
        let changed;
        try {
            changed = await sync();
        } catch (e) {
            console.log('Could not pull the repo:', e)
            manageStatusPage(false);
        }
        if (changed) {
            build();
        } else {
            scheduleRebuild();
        }
    }, opts.GIT_PULL_RATE * 1000 * 60);
};

const webhook = async (req, res) => {
    try {
        await sync();
        res.writeHead(200, 'OK', {
            'Content-Type' : 'application/json'
        });
        res.write('{"status": "ok","action": "rebuilding"}');
        res.end();
        clearTimeout(rebuildTimeout);
        try {
            await build();
        } catch(e) {
            console.error('(Webhook) Could not build the repo.', e);
        } finally {
            scheduleRebuild();
        }
    } catch (e) {
        res.writeHead(503, 'Build error', {
            'Content-Type' : 'application/json'
        });
        console.error('(Webhook) Could not sync the repository.', e);
        res.write('{"status": "failed","msg": "See the logs at the container."}');
        res.end();
    }
};

const serve = () => {
    const handler = serveStatic(path.join('./project', opts.SERVE_DIR), {
        dotfiles: opts.SERVE_DOTFILES === 1 ? 'allow' : 'ignore',
        fallthrough: false,
        redirect: true,
    });
    let substituteHandler;
    if (opts.BUILD_USE_SUBSTITUTE) {
        substituteHandler = serveStatic('./substitute', {
            dotfiles: opts.SERVE_DOTFILES === 1 ? 'allow' : 'ignore',
            fallthrough: false,
            redirect: true,
        });
    }
    console.log('Starting the static file server…');
    const server = http.createServer(function onRequest (req, res) {
        if (opts.BUILD_HOOK) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            if (url.pathname === opts.BUILD_HOOK) {
                webhook(req, res);
                return true;
            }
        }
        (opts.BUILD_USE_SUBSTITUTE === 1 && building ?
            substituteHandler :
            handler
        )(req, res, hmm => {
            send404(res);
        });
    });
    server.listen(8080);
    console.log('Listening on port 8080! O_O');
};

const addDeployKey = async () => {
    console.log('Adding a deploy key…');
    await fs.writeFile(path.join('/home/node/.ssh/', 'id_' + opts.GIT_DEPLOY_FORMAT), opts.GIT_DEPLOY_KEY, {
        encoding: 'utf-8',
        mode: 0o600
    });
    console.log('Added a deploy key.');

    const hostnameResult = hostnamePattern.exec(opts.GIT_URL);
    const hostname = hostnameResult.groups.hostnameGit || hostnameResult.groups.hostnameHttp;
    console.log(`Adding the repo host ${hostname} to the list of known hosts…`);
    const hostScan = (await execa.command(`ssh-keyscan ${hostname} >> /home/node/.ssh/known_hosts`)).stdout;
    await fs.writeFile('/home/node/.ssh/known_hosts', hostScan, {
        mode: 0o600,
        encoding: 'utf-8'
    });
    console.log('Added the repo host to the list of known hosts.');
};

(async () => {
    if (opts.GIT_DEPLOY_KEY &&
        opts.GIT_DEPLOY_KEY !== 'false' &&
        opts.GIT_DEPLOY_KEY !== 'FALSE' &&
        opts.GIT_DEPLOY_KEY !== '0'
    ) {
        await addDeployKey();
    }
    await sync();
    await setup();
    await build();
    serve();
})();
