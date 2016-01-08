import colors from 'colors';
import EventEmitter from 'events';
import readline from 'readline';
import rq from 'request-promise';
import Rx from '@reactivex/rxjs';
import util from 'util';

// Configure the terminal.
readline.cursorTo(process.stdout, 0, 0);
readline.clearScreenDown(process.stdout);
readline.createInterface({
  input: process.stdin
});
const userColors = ['cyan', 'red', 'green'];
const promptString = 'Hit Enter to refresh all Github suggested users\n' +
    'Or hit key 1 to refresh suggested user 1\n'.cyan +
    'Or hit key 2 to refresh suggested user 2\n'.red +
    'Or hit key 3 to refresh suggested user 3\n'.green;
process.stdout.write(promptString);

// Define cursor positions (hard coded for simplicity).
const hitEnterStartPos = {x: 48, y: 0};
const hitNumberStartPos = [
  {x: 41, y: 1},
  {x: 41, y: 2},
  {x: 41, y: 3}
];
const suggestionPos = [
  {x: 0, y: 6},
  {x: 0, y: 12},
  {x: 0, y: 18}
];

function cursorTo({x, y}) {
  readline.cursorTo(process.stdout, x, y);
}

// Define event emitters.
const hitEnterEmitter = new EventEmitter();
const hitNumberEmitters = [...Array(3)].map(() => new EventEmitter());

// Hookup user inputs.
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', key => {
  switch (key) {
    case '1':
    case '2':
    case '3':
      hitNumberEmitters[Number(key)].emit('hit');
      break;
    case '\r':
      hitEnterEmitter.emit('hit');
      break;
    case '\u0003':
      // Catch ctrl-c.
      process.exit();
  }
});


const hitEnterStream = Rx.Observable.fromEvent(hitEnterEmitter, 'hit');

const requestStream = hitEnterStream.startWith('startup event')
    .map(() => {
      const randomOffset = Math.floor(Math.random() * 500);
      return `https://api.github.com/users?since=${randomOffset}`;
    });

const responseStream = requestStream.flatMap(requestUrl => {
  const options = {
    uri: requestUrl,
    headers: {
      'User-Agent': 'Request-Promise',
      // Set access token as an environment variable.
      'Authorization': `token ${process.env.GITHUB_TOKEN}`
    },
    json: true
  };

  return Rx.Observable.fromPromise(rq(options));
});

// Let's have 3 user suggestions, as in the tutorial.
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
const suggestionStreams = [...Array(3)].map(
    () => responseStream.map(randomElement));

// Render Github users in command line.
function prettify(githubUser) {
  return `Username: ${githubUser['login']}\n` +
      `ID: ${githubUser['id']}\n` +
      `Link: ${githubUser['html_url']}\n` +
      `Admin: ${githubUser['site_admin']}`;
}

suggestionStreams.map((stream, i) => {
  stream.subscribe(user => {
    cursorTo(suggestionPos[i]);
    process.stdout.write(prettify(user)[userColors[i]]);
    cursorTo(hitEnterStartPos);
  });
});
