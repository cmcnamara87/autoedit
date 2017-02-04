const readVideosFromDir = require('./exec').readVideosFromDir;
const sequentiallyExecCommands = require('./exec').sequentiallyExecCommands;
const promiseExec = require('./exec').promiseExec;

function stitcher({
  inputFolder,
  tempFolder,
  outputFolder
}) {
  return readVideosFromDir(inputFolder).then(files => {
    // get temp file paths
    const outputPaths = files.map((path, index) => `${tempFolder}/${index}.ts`);
    // convert to temp files
    const commands = files.map((path, index) => `ffmpeg -y -i "${path}" -c copy -bsf:v h264_mp4toannexb -f mpegts ${outputPaths[index]}`);
    return sequentiallyExecCommands(commands).then(() => {
      // join all the temp files together
      const command = `ffmpeg -y -i "concat:${outputPaths.join('|')}" -c copy -bsf:a aac_adtstoasc "${outputFolder}/merged.mp4"`;
      return promiseExec(command);
    });
  });
}

module.exports = stitcher;
