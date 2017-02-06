import React, { Component } from 'react';
// import { Link } from 'react-router';
// import styles from './Home.css';
import fs from 'fs';
import cuid from 'cuid';
import styled from 'styled-components';
import _ from 'lodash';
import { remote } from 'electron';
import './Home.css';
import splitter from '../splitter';
import stitcher from '../stitcher';


const Clip = styled.a`
  display: block;
  height: 30px;
  width: ${props => (props.duration / 1000) * 70}px;
  padding: 20px;
  cursor: pointer;
  border-radius: 100px;
  &:hover {
    background-color: yellow;
    text-decoration: none;
  }
`;
const Line = styled.a`
  height: 200px;
  width: 1px;
  background-color: red;
  position: absolute;
  left: 50%;
  bottom: 0;
`;
const GoodClip = styled(Clip)`
  background-color: ${props => (props.selected ? 'yellow' : '#4fc5ff')};
`;
const BadClip = styled(Clip)`
  background-color: ${props => (props.selected ? 'yellow' : '#ffb426')};
`;
const Clips = styled.div`
  border: 1px solid black;
  width: ${window.innerWidth}px;
  overflow: scroll;
  position: absolute;
  bottom: ${props => (props.top ? '100px' : 0)};
  background-color: #333;
  padding: 20px;
  padding-left: 50%;
`;

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
      currentClip: null,
      workingFolder: '/Users/craig/Desktop/temp2',
      tab: 'output',
      isEditing: false
    };

    this.handleOpenFolder = this.handleOpenFolder.bind(this);
    this.stitchClips = this.stitchClips.bind(this);
    this.selectClip = this.selectClip.bind(this);
    this.changeTab = this.changeTab.bind(this);
    this.toggleBad = this.toggleBad.bind(this);
    this.toggleReject = this.toggleReject.bind(this);
    this.loadClips = this.loadClips.bind(this);
    this.handlePlayVideo = this.handlePlayVideo.bind(this);
    this.handlePauseVideo = this.handlePauseVideo.bind(this);
    this.handleScroll = this.handleScroll.bind(this);

    document.addEventListener('keydown', (e) => {
      const keyCode = e.keyCode;
      if (keyCode === 69) { // e
        // go into edit
        this.setState({
          isEditing: !this.state.isEditing
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

      // Right: 39
      if (keyCode === 39 && this.state.currentClip) {
        const currentIndex = this.clips.indexOf(this.state.currentClip);
        // get the next clips
        const nextIndex = _.findIndex(this.clips, (clip, index) =>
          index > currentIndex && (clip.good === true || this.state.isEditing)
        );
        this.setState({
          currentClip: this.clips[nextIndex]
        });
      }
      // Left: 37
      if (keyCode === 37 && this.state.currentClip) {
        const currentIndex = this.clips.indexOf(this.state.currentClip);
        this.setState({
          currentClip: this.clips[currentIndex - 1]
        });
      }
      // down
      if (keyCode === 40 && this.state.currentClip) {
        this.handleMoveDown();
      }
      // up
      if (keyCode === 38 && this.state.currentClip) {
        this.handleMoveUp();
      }
    }, false);
  }
  componentDidMount() {
    this.loadClips();
    this.div.addEventListener('scroll', this.handleScroll);
  }
  handlePlayVideo() {
    this.div.removeEventListener('scroll', this.handleScroll);
    this.video.play();
    this.setState({
      isPlaying: true
    });
    clearInterval(this.interval);
    this.time = this.video.currentTime * 1000; // convert back to ms
    this.interval = setInterval(() => {
      this.time = this.time + 14;
      // console.log(this.time);
      // lets get out all the start and ends for good clips
      const currentClip = _.find(this.clips, (clip) =>
        clip.good && clip.startTime <= this.time && this.time <= clip.endTime
      );
      if (this.state.currentClip && currentClip && currentClip.id !== this.state.currentClip.id) {
        this.div.scrollLeft = currentClip.startPos;
        console.log('new clip', this.div.scrollLeft);
      } else {
        this.div.scrollLeft = this.div.scrollLeft + 1;
        console.log('inc', this.div.scrollLeft);
      }
      console.log(currentClip);
      this.setState({
        currentClip
      });
    }, 14);
  }
  handleScroll() {
    console.log('its scrolling!!!', this.div.scrollLeft / 70);
    this.video.currentTime = this.div.scrollLeft / 70;
    const currentClip = _.find(this.clips, (clip) =>
      clip.good &&
      clip.startPos <= this.div.scrollLeft &&
      this.div.scrollLeft < clip.startPos + ((clip.duration / 1000) * 70)
    );
    this.setState({
      currentClip
    });
  }
  handlePauseVideo() {
    this.time = 0;
    clearInterval(this.interval);
    this.setState({
      isPlaying: false
    });
    this.video.pause();
    this.div.addEventListener('scroll', this.handleScroll);
  }
  handleMoveUp() {
    // mutating state, bleh
    const newFullPath = `${this.state.workingFolder}/good/${this.state.currentClip.fileName}`;
    fs.rename(
      this.state.currentClip.fullPath,
      newFullPath,
      () => {
        this.stitchClips();
      }
    );

    this.state.currentClip.good = true;
    this.state.currentClip.fullPath = newFullPath;
    this.setState({
      clips: this.clips
    });
  }
  handleMoveDown() {
    if (!this.state.isEditing) {
      return;
    }
    // mutating state, bleh
    const newFullPath = `${this.state.workingFolder}/bad/${this.state.currentClip.fileName}`;
    fs.rename(
      this.state.currentClip.fullPath,
      newFullPath,
      () => {
        this.stitchClips();
      }
    );

    this.state.currentClip.good = false;
    this.state.currentClip.fullPath = newFullPath;
    this.setState({
      clips: this.clips,
    });
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
          `ffmpeg -i ${clip.fullPath} 2>&1 | grep Duration | awk '{print $2}' | tr -d ,`
        );
        const sequentiallyExecCommands = remote.require('./exec').sequentiallyExecCommands;
        sequentiallyExecCommands(commands).then(data => {
          this.clips = this.clips.map((clip, index) => {
            if (!data[index]) {
              console.log('no duration data');
              return clip;
            }
            const re = /(\d\d):(\d\d):(\d\d)\.(\d\d)/;
            const time = data[index].stdout;
            const matches = re.exec(time);
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
          this.clips = this.clips.map((myClip, index) => {
            const startTime = this.clips
              .filter((clip, clipIndex) => clip.good && clipIndex < index)
              .map(clip => clip.duration)
              .reduce((a, b) => a + b, 0);
            const startPos = (this.clips
              .filter((clip, clipIndex) => clip.good && clipIndex < index)
              .map(clip => clip.duration)
              .reduce((a, b) => a + b, 0) / 1000) * 70;
            const endTime = startTime + myClip.duration;
            return Object.assign({}, myClip, {
              startTime,
              endTime,
              startPos
            });
          });

          this.setState({
            clips: this.clips
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
  toggleReject() {
    const index = this.clips.indexOf(this.state.currentClip);
    this.clips.splice(index, 1, Object.assign({},
      this.state.currentClip, { good: !this.state.currentClip.good }
    ));
    this.setState({
      clips: this.clips
    });
  }
  toggleBad() {
    const isEditing = !this.state.isEditing;
    console.log('toggle bad');
    this.setState({
      isEditing
    });
  }
  selectClip(clip) {
    if (this.state.currentClip === clip) {
      this.setState({
        currentClip: null,
        tab: 'output'
      });
      return;
    }
    this.setState({
      currentClip: clip,
      tab: 'clip'
    });
  }
  changeTab(tab) {
    this.setState({
      tab
    });
  }

  handleOpenFolder() {
    return Home.selectFolder().then(folder => {
      this.setState({
        inputFolder: folder,
        isLoading: true
      });
      splitter({
        inputFolder: folder,
        workingFolder: this.state.workingFolder
      }).then((results) => {
        this.setState({
          isLoading: false
        });
        this.stitchClips();
        return results;
      }).catch(console.error);
      return folder;
    }).catch(console.error);
  }
  stitchClips() {
    return stitcher({
      inputFolder: `${this.state.workingFolder}/good`,
      tempFolder: `${this.state.workingFolder}/temp`,
      outputFolder: this.state.workingFolder
    }).then(() => console.log('stiching is done!!!!'));
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
        <div style={{ padding: '20px' }}>
          {this.state.tab === 'clip' &&
          <video
            controls
            autoPlay
            style={{ width: '100%' }} src={this.state.currentClip.fullPath}
            ref={(input) => { this.video = input; }}
          />
          }
          {this.state.tab === 'output' &&
          <video
            style={{ width: '100%' }} src={`${this.state.workingFolder}/merged.mp4`}
            ref={(input) => { this.video = input; }}
          />
          }
        </div>

        <Clips innerRef={(ref) => { this.div = ref; return ref; }}>
          <table>
            <tbody>
              <tr>
                {this.state.clips.map((clip, index) =>
                  <td key={clip.id}>
                    {clip.good &&
                    <GoodClip
                      good={clip.good}
                      tabindex={0 - index}
                      duration={clip.duration}
                      onClick={() => this.selectClip(clip)}
                      selected={this.state.currentClip && clip.id === this.state.currentClip.id}
                      onKeyPress={() => console.log('hello world!!!')}
                    />
                    }
                  </td>
                )}
              </tr>
              {this.state.isEditing &&
              <tr>
                {this.state.clips.map((clip) =>
                  <td key={clip.id}>
                    {!clip.good &&
                    <BadClip
                      good={clip.good}
                      duration={clip.duration}
                      onClick={() => this.selectClip(clip)}
                      selected={this.state.currentClip && clip.id === this.state.currentClip.id}
                    />
                    }
                  </td>
                )}
              </tr>}
            </tbody>
          </table>
        </Clips>
        <Line />
      </div>
    );
  }
}
