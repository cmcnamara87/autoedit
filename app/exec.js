const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

export function readDirPromise(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => {
      if (err) {
        return reject(err);
      }
      return resolve(files);
    });
  });
}

export function readVideosFromDir(inputFolder) {
  return readDirPromise(inputFolder).then(files =>
    files.reduce((acc, file) => {
      const fileExtension = path.extname(file);
      if (fileExtension === '.mp4' || fileExtension === '.mov') {
        acc.push(`${inputFolder}/${file}`);
      }
      return acc;
    }, [])
  );
}

export function promiseExec(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      console.log('Finished: ', command);
      resolve({
        command,
        stdout,
        stderr
      });
    });
  });
}

export function sequentiallyExecCommands(commands) {
  return new Promise((resolve, reject) => {
    const results = [];
    commands.reduce((promise, command, index) => {
      if (!promise) {
        console.log('first exec', command);
        return promiseExec(command);
      }
      return promise.then((response) => {
        results.push(response);
        // last command, do it, then resolve the results
        if (index === commands.length - 1) {
          // last command
          console.log('last command!, time to resolve', index, commands.length, results);
          resolve(results);
          return results;
        }
        console.log('length', results.length);
        return promiseExec(command);
      }).catch((e) => {
        reject(e);
      });
    }, null);
  });
}

export default {
  promiseExec,
  sequentiallyExecCommands,
  readDirPromise,
  readVideosFromDir
};
