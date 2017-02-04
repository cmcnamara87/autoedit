const path = require('path');
const exec = require('child_process').exec;
const fs = require('fs');
const sequentiallyExecCommands = require('./exec').sequentiallyExecCommands;

function deleteFolderRecursive(folderPath) {
  if (!fs.existsSync(folderPath)) {
    return;
  }
  fs.readdirSync(folderPath).forEach((file) => {
    const curPath = `${folderPath}/${file}`;
    if (fs.lstatSync(curPath).isDirectory()) { // recurse
      deleteFolderRecursive(curPath);
    } else { // delete file
      fs.unlinkSync(curPath);
    }
  });
  fs.rmdirSync(folderPath);
}

function readDirPromise(dir) {
  return new Promise((resolve, reject) => {
    console.log('reading dir');
    fs.readdir(dir, (err, files) => {
      console.log('got', err, files);
      if (err) {
        return reject(err);
      }
      return resolve(files);
    });
  });
}

function splitter({ inputFolder, workingFolder, progressHandler = console.log }) {
  const badFolder = `${workingFolder}/bad`;
  const goodFolder = `${workingFolder}/good`;
  const tempFolder = `${workingFolder}/temp`;

  // return new Promise((resolve, reject) => {
  progressHandler('Setting up folders');
  deleteFolderRecursive(badFolder);
  deleteFolderRecursive(goodFolder);
  deleteFolderRecursive(tempFolder);
  fs.mkdirSync(badFolder);
  fs.mkdirSync(goodFolder);
  fs.mkdirSync(tempFolder);

  return readDirPromise(inputFolder).then(files => {
    const videos = files.reduce((acc, file) => {
      const fileExtension = path.extname(file);
      // TODO add .mov support
      if (fileExtension === '.mp4') {
        acc.push(`${inputFolder}/${file}`);
      }
      return acc;
    }, []);

    // convert videos to commands to audio detection
    const audioCommands = videos.map(video => `ffmpeg -i "${video}" -af silencedetect=noise=-30dB:d=0.2 -f null -`);
    progressHandler('Analysing clips for audio quality');
    return sequentiallyExecCommands(audioCommands).then(data => {
      const splitCommands = data.map(result => result.stderr)
        .reduce((acc, output, fileIndex) => {
          // create all the commands
          const fileNamePadding = 10000;
          const { starts, ends } = getStartsAndEnds(output);

          const commands = starts.map((startTime, index) => {
            const inputFile = videos[fileIndex];
            const outputFile = `${badFolder}/${(((fileIndex + 1) * fileNamePadding) + (index * 2))}.mp4`;
            return getSliceCommand(startTime, ends[index], inputFile, outputFile);
          }).filter(command => !!command);
          const commands2 = ends.map((endTime, index) => {
            const inputFile = videos[fileIndex];
            const outputFile = `${goodFolder}/${(((fileIndex + 1) * fileNamePadding) + ((index * 2) + 1))}.mp4`;
            return getSliceCommand(endTime, starts[index + 1], inputFile, outputFile);
          }).filter(command => !!command);

          return acc.concat(commands).concat(commands2);
        }, []);
      progressHandler('Slicing and creating clips');
      return sequentiallyExecCommands(splitCommands);
    });
  });
}

// const length = (ends[index] - startTime);
// tempFolder + 'bad/' + count++ + '.mp4';
function getSliceCommand(startTime, endTime, inputFile, outputFile) {
  const seekStart = `-ss ${startTime}`;
  let duration = '';

  if (endTime) {
    const length = endTime - startTime;
    if (length < 0.1) {
      console.error('bad clip!!!!', length, endTime, startTime);
      return false;
    }
    duration = ` -t ${length}`;
  }
  return `ffmpeg -nostdin ${seekStart} ${duration} -i "${inputFile}" -c:v libx264 -preset ultrafast -v warning -y ${outputFile}`;
}

function getStartsAndEnds(log) {
  var lines = log.split('\n').filter((line) => {
    if (line.indexOf('[silencedetect') >= 0) {
      return true;
    }
    return false;
  });
  // get all the start times
  var starts = lines.filter((line) => {
    return line.indexOf('start') >= 0
  }).map((line) => {
    return Math.max(line.substring(line.lastIndexOf(": ") + 2, line.length), 0);
  });
  // get all the end times
  var ends = lines.filter((line) => line.indexOf('silence_end') >= 0).map((line) => {
    return line.substring(line.lastIndexOf("silence_end: ") + 13, line.lastIndexOf(" |"));
  });
  return {starts: starts, ends: ends};
}
//
// function sequentiallyExecCommands(commands) {
//   return commands.reduce(function(promise, command) {
//     if (!promise) {
//       console.log('first exec', command);
//       return promiseExec(command);
//     }
//     return promise.then(function(response) {
//       return promiseExec(command);
//     }).catch(console.error);;
//   }, null);
// }

function promiseExec(command) {
  return new Promise(function(resolve, reject) {
    exec(command, function(error, stdout, stderr) {
      // some processing
      if (error) {
        console.log('Error: ', error);
        return reject(error);
      }
      console.log('Finished: ', command);
      // console.log(error, stdout, stderr);
      resolve({command: command, stdout: stdout, stderr: stderr});
    });
  });
}

module.exports = splitter;
