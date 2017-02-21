import React, { Component } from 'react';
// import { Link } from 'react-router';
// import styles from './Home.css';
import fs from 'fs';
import cuid from 'cuid';
import _ from 'lodash';
import { remote } from 'electron';
import './Home.css';
import splitter from '../splitter';
import stitcher from '../stitcher';
import Timeline from './Timeline';
import VideoPlayer from './VideoPlayer';

const clipWidth = 70;


export default class Home extends Component {
  static selectFolder() {
    return new Promise((resolve) => {
      remote.dialog.showOpenDialog({
        properties: ['openDirectory']
      }, folders => {
        resolve(folders[0]);
      });
    });
  }

  constructor() {
    super();
    this.state = {
      clips: [],
      currentFile: '',
      workingFolder: '/Users/craig/Desktop/power scrubber temp',
      isEditing: false,
      selectedClip: null,
      time: 0
    };

    this.handleOpenFolder = this.handleOpenFolder.bind(this);
    this.stitchClips = this.stitchClips.bind(this);
    this.loadClips = this.loadClips.bind(this);
    this.handlePlayVideo = this.handlePlayVideo.bind(this);
    this.handlePauseVideo = this.handlePauseVideo.bind(this);
    this.handleScrollToTime = this.handleScrollToTime.bind(this);
    this.handleClipClicked = this.handleClipClicked.bind(this);
  }
  componentDidMount() {
    this.loadClips();
    // this.div.addEventListener('scroll', this.handleScroll);
    document.addEventListener('keydown', (e) => {
      const keyCode = e.keyCode;
      if (keyCode === 69) { // e
        // go into edit
        const isEditing = !this.state.isEditing;
        this.setState({
          isEditing,
          clips: this.clips.filter(clip => (clip.good || isEditing)),
        });
        return;
      }
      if (keyCode === 32) { // space
        if (this.state.isPlaying) {
          this.handlePauseVideo();
        } else {
          this.handlePlayVideo();
        }
      }
      // down
      if (keyCode === 40 && this.state.selectedClip) {
        this.handleMoveDown();
      }
      // up
      if (keyCode === 38 && this.state.selectedClip) {
        this.handleMoveUp();
      }
    }, false);
  }

  handlePlayVideo() {
    this.video.play();
    this.setState({
      isPlaying: true
    });
    // if (this.state.selectedClip) {
    // stop timer
    console.log('starting');
    clearInterval(this.interval);
    // move timeline
    // this.div.scrollLeft = this.state.selectedClip.startPos;
    // reset video to start
    // this.video.currentTime = 0;

    // start the play timer
    this.interval = setInterval(() => {
      this.setState({
        time: this.state.time + (1000 / clipWidth)
      });
      console.log('time', this.state.time);
    }, 1000 / clipWidth);
  }
  handleScrollToTime(time) {
    // if there is a selected clip...disabled scrubbing?
    this.video.currentTime = time / 1000;
    this.setState({
      time
    });
  }
  handleMoveUp() {
    // mutating state, bleh
    const newFullPath = `${this.state.workingFolder}/good/${this.state.selectedClip.fileName}`;
    fs.rename(
      this.state.selectedClip.fullPath,
      newFullPath,
      () => {
        this.stitchGood();
      }
    );

    this.state.selectedClip.good = true;
    this.state.selectedClip.fullPath = newFullPath;
    this.setState({
      clips: this.clips
    });
  }
  handleMoveDown() {
    // mutating state, bleh
    const newFullPath = `${this.state.workingFolder}/bad/${this.state.selectedClip.fileName}`;
    fs.rename(
      this.state.selectedClip.fullPath,
      newFullPath,
      () => {
        this.stitchGood();
      }
    );
    // TODO: fix this mutation of the selected clip
    this.state.selectedClip.good = false;
    this.state.selectedClip.fullPath = newFullPath;
    const currentIndex = this.state.clips.indexOf(this.state.selectedClip);
    this.setState({
      selectedClip: this.state.clips[currentIndex - 1],
      clips: this.clips.filter(clip => (clip.good || this.state.isEditing)),
    });
  }
  handlePauseVideo() {
    this.time = 0;
    clearInterval(this.interval);
    this.setState({
      isPlaying: false
    });
    this.video.pause();
    // this.div.addEventListener('scroll', this.handleScroll);
  }
  loadClips() {
    fs.readdir(`${this.state.workingFolder}/good/`, (err, goodFiles) => {
      fs.readdir(`${this.state.workingFolder}/bad/`, (err2, badFiles) => {
        this.clips = goodFiles.map(file => ({
          id: cuid(),
          fileName: file,
          fullPath: `${this.state.workingFolder}/good/${file}`,
          good: true,
          visible: true,
          score: 100
        }))
        .concat(badFiles.map(file => ({
          id: cuid(),
          fileName: file,
          fullPath: `${this.state.workingFolder}/bad/${file}`,
          good: false,
          visible: true,
          score: 0
        })))
        .sort((a, b) => parseInt(a.fileName, 10) - parseInt(b.fileName, 10));

        // this.setState({
        //   clips: this.clips
        // });

        // get all the durations
        console.log('clips', this.clips);
        const commands = this.clips.map(clip =>
          `ffmpeg -i "${clip.fullPath}" 2>&1 | grep Duration | awk '{print $2}' | tr -d ,`
        );
        const sequentiallyExecCommands = remote.require('./exec').sequentiallyExecCommands;
        sequentiallyExecCommands(commands).then(data => {
          console.log('data', data);
          this.clips = this.clips.map((clip, index) => {
            if (!data[index]) {
              console.log('no duration data');
              return clip;
            }
            const re = /(\d\d):(\d\d):(\d\d)\.(\d\d)/;
            const time = data[index].stdout;
            const matches = re.exec(time);
            console.log('matches', matches, clip.fileName);
            const hours = matches[1] * 60 * 60 * 1000;
            const minutes = matches[2] * 60 * 1000;
            const seconds = matches[3] * 1000;
            const milliseconds = matches[4] * 10;
            return Object.assign({}, clip, {
              duration: hours + minutes + seconds + milliseconds
            });
          });
          console.log('finsihed analysis clips', this.clips);
          // this.setState({
          //   clips: this.clips
          // });


          this.setState({
            clips: this.clips.filter(clip => (clip.good || this.state.isEditing))
          });
          return data;
        }).catch(console.error);


        // Promise.all(promises).then((data) => {
        //   this.clips = this.clips.map((clip, index) => {
        //     console.log('done');
        //     const re = /(\d\d):(\d\d):(\d\d)\.(\d\d)/;
        //     const time = data[index].stdout;
        //     const matches = re.exec(time);
        //     const hours = matches[1] * 60 * 60 * 1000;
        //     const minutes = matches[2] * 60 * 1000;
        //     const seconds = matches[3] * 1000;
        //     const milliseconds = matches[4] * 10;
        //     console.log(clip.fileName, hours, minutes,
        // seconds, milliseconds, matches, hours + minutes +
        // seconds + milliseconds);
        //     return Object.assign({}, clip, {
        //       duration: hours + minutes + seconds + milliseconds
        //     });
        //   });
        //   this.setState({
        //     clips: this.clips
        //   });
        //   // console.log(this.clips);
        //   return this.clips;
        // }).catch(console.error);
        //
        // this.setState({
        //   clips: this.clips
        // });
      });
    });
  }
  handleClipClicked(clip) {
    // deselecting
    if (this.state.selectedClip && this.state.selectedClip.id === clip.id) {
      this.setState({
        selectedClip: null
      });
      return;
    }
    // selecting
    this.setState({
      selectedClip: clip
    });
  }

  handleOpenFolder() {
    return Home.selectFolder().then(inputFolder =>
      Home.selectFolder().then(workingFolder => {
        this.setState({
          inputFolder,
          workingFolder,
          isLoading: true
        });
        // split the clips
        return splitter({
          inputFolder,
          workingFolder
        }).then(() => {
          this.setState({
            isLoading: false
          });
          // stitch them
          return this.stitchClips();
        }).then(() => this.loadClips()
        ).catch(console.error);
      })
    );
  }
  stitchAll() {
    return stitcher({
      inputFolder: `${this.state.workingFolder}/all`,
      tempFolder: `${this.state.workingFolder}/temp`,
      outputPath: `${this.state.workingFolder}/merged_all.mp4`
    });
  }
  stitchGood() {
    return stitcher({
      inputFolder: `${this.state.workingFolder}/good`,
      tempFolder: `${this.state.workingFolder}/temp`,
      outputPath: `${this.state.workingFolder}/merged_good.mp4`
    });
  }
  stitchClips() {
    this.setState({
      isLoading: true
    });
    return this.stitchGood().then(() => this.stitchAll()).then(() => this.setState({
      isLoading: false
    }));
  }
  render() {
    return (
      <div style={{ height: '100%' }}>
        <div>
          Header
          <button className="btn btn-default" onClick={this.handleOpenFolder}>Open Folder</button>
          <button className="btn btn-default" onClick={this.toggleBad}>Edit</button>
          <button className="btn btn-default" onClick={this.handlePlayVideo}>Play</button>
          <button className="btn btn-default" onClick={this.handlePauseVideo}>Pause</button>
          { this.state.isLoading ? 'Loading...' : 'Finished loading.' }
        </div>
        <VideoPlayer />
        <div style={{ padding: '20px', backgroundColor: this.state.selectedClip ? 'yellow' : 'black' }}>
          {!this.state.isLoading &&
          <div className="text-muted">
            output
            <video
              style={{ width: '100%' }}
              src={this.state.isEditing ? `${this.state.workingFolder}/merged_all.mp4` : `${this.state.workingFolder}/merged_good.mp4`}
              ref={(input) => { this.video = input; }}
            />
          </div>
          }
          {this.state.isLoading &&
          <div style={{ color: 'white' }}>
            Re-creating the video
          </div>
          }
        </div>
        <Timeline
          time={this.state.time}
          clipWidth={clipWidth}
          clips={this.state.clips}
          isEditing={this.state.isEditing}
          selectedClip={this.state.selectedClip}
          onClipClicked={this.handleClipClicked}
          scrollEnabled={!this.state.isPlaying}
          onScrollToTime={this.handleScrollToTime}
        />
      </div>
    );
  }
}
