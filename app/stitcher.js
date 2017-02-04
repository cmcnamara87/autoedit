
var path = require('path')
var fs = require('fs');
var exec = require('child_process').exec;

const inputFolder = '/Users/craig/Desktop/clips/good/';
const tempFolder = '/Users/craig/Desktop/temp/';
const outputFolder = '/Users/craig/Desktop/';


function stitcher({ inputFolder, tempFolder, outputFolder }) {
  // get all mp4 files
  fs.readdir(inputFolder, function(err, files) {
    console.log(files);
    var mp4s = files.filter(function (file) {
      return path.extname(file) === '.mp4';
    }).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    }).map(function(file) {
      return inputFolder + file;
    });
    console.log('mp4s', mp4s);

    var outputPaths = mp4s.map(function(path, index) {
      return `${tempFolder}/${index}.ts`;
    });
    console.log('output paths', outputPaths);
    var commands = mp4s.map(function(path, index) {
      return 'ffmpeg -y -i "' + path + '" -c copy -bsf:v h264_mp4toannexb -f mpegts ' + outputPaths[index];
    });
    console.log('commands', commands);
    var done = sequentiallyExecCommands(commands);
    console.log(commands, done);

    done.then(function() {
      var concat = 'concat:' + outputPaths.join('|');
      var outputPath = outputFolder + '/merged.mp4';
      var command = 'ffmpeg -y -i "' + concat + '" -c copy -bsf:a aac_adtstoasc ' + outputPath;
      exec(command, function(error, stdout, stderr) {
        console.log(error, stdout, stderr);
      });
    }).catch(console.error);
  });
}


function sequentiallyExecCommands(commands) {
  console.log(commands);
  return commands.reduce(function(promise, command) {
    if (!promise) {
      console.log('first exec', command);
      return promiseExec(command);
    }
    return promise.then(function(response) {
      return promiseExec(command);
    }).catch(console.error);;
  }, null);
}

function promiseExec(command) {
  return new Promise(function(resolve, reject) {
    exec(command, function(error, stdout, stderr) {
      // some processing
      if (error) {
        return reject(error);
      }
      console.log('Finished: ', command);
      // console.log(error, stdout, stderr);
      resolve({command: command, stdout: stdout, stderr: stderr});
    });
  });
}

module.exports = stitcher;
