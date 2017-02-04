import React, { Component } from 'react';
// import { Link } from 'react-router';
// import styles from './Home.css';
import fs from 'fs';
// import _ from 'lodash';
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
  border: 1px solid black;
  cursor: pointer;
  background-color: ${props => (props.selected ? 'yellow' : '#666')};
  &:hover {
    background-color: ${props => (props.selected ? 'yellow' : '#FFFFE0')};
    text-decoration: none;
  }
`;
const Clips = styled.div`
  border: 1px solid black;
  width: ${window.innerWidth}px;
  overflow: scroll;
  position: absolute;
  bottom: ${props => (props.top ? '100px' : 0)};
  background-color: #333;
  padding: 20px;
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
      isShowingBad: false
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

    document.addEventListener('keydown', (e) => {
      const keyCode = e.keyCode;

      // Right: 39
      if (keyCode === 39 && this.state.currentClip) {
        const currentIndex = this.clips.indexOf(this.state.currentClip);
        // get the next clips
        const nextIndex = _.findIndex(this.clips, (clip, index) =>
          index > currentIndex && (clip.good === true || this.state.isShowingBad)
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
    console.log('scrolling left', this.div);
    this.div.addEventListener('scroll', () => {
      console.log('its scrolling!!!', this.div.scrollLeft / 70);
      this.video.currentTime = this.div.scrollLeft / 70;
    });
    // setInterval(() => {
    //   console.log('scrolling', this.div.scrollLeft);
    //   this.div.scrollLeft += 70;
    // }, 1000);
  }
  handlePlayVideo() {
    this.video.play();
    clearInterval(this.interval);
    this.div.scrollLeft = this.video.currentTime * 70;
    this.interval = setInterval(() => {
      console.log('scrolling', this.div.scrollLeft);
      this.div.scrollLeft += 1;
    }, 14.28);
  }
  handlePauseVideo() {
    clearInterval(this.interval);
    this.video.pause();
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
      clips: this.clips
    });
  }
  loadClips() {
    fs.readdir(`${this.state.workingFolder}/good/`, (err, goodFiles) => {
      fs.readdir(`${this.state.workingFolder}/bad/`, (err2, badFiles) => {
        this.clips = goodFiles.map(file => ({
          fileName: file,
          fullPath: `${this.state.workingFolder}/good/${file}`,
          good: true,
          visible: true,
          score: 100
        }))
        .concat(badFiles.map(file => ({
          fileName: file,
          fullPath: `${this.state.workingFolder}/bad/${file}`,
          good: false,
          visible: true,
          score: 0
        })))
        .sort((a, b) => parseInt(a.fileName, 10) - parseInt(b.fileName, 10));

        this.setState({
          clips: this.clips
        });

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
    const isShowingBad = !this.state.isShowingBad;
    console.log('toggle bad');
    this.setState({
      isShowingBad
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
      inputFolder: `${this.state.workingFolder}/good/`,
      tempFolder: `${this.state.workingFolder}/temp/`,
      outputFolder: this.state.workingFolder
    }).then(() => console.log('stiching is done!!!!'));
  }
  render() {
    return (
      <div style={{ height: '100%' }}>
        <div>
          Header
          <button onClick={this.handleOpenFolder}>Open Folder</button>
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
          <button onClick={this.handlePlayVideo}>Play</button>
          <button onClick={this.handlePauseVideo}>Pause</button>
        </div>

        <button onClick={this.toggleBad}>Show Bad</button>
        <button onClick={this.handleToggleBadForClip}>Good</button>
        <button onClick={this.handleToggleBadForCurrentClip}>Bad</button>
        { this.state.isShowingBad ? 'show bad' : 'show good'}
        <Clips innerRef={(ref) => { this.div = ref; return ref; }}>
          <table>
            <tbody>
              <tr>
                {this.state.clips.map((clip, index) =>
                  <td>
                    {clip.good &&
                    <Clip
                      tabindex={0 - index}
                      duration={clip.duration}
                      onClick={() => this.selectClip(clip)}
                      selected={clip === this.state.currentClip}
                      onKeyPress={() => console.log('hello world!!!')}
                    />
                    }
                  </td>
                )}
              </tr>
              {this.state.isShowingBad &&
              <tr>
                {this.state.clips.map((clip) =>
                  <td>
                    {!clip.good &&
                    <Clip
                      duration={clip.duration}
                      onClick={() => this.selectClip(clip)}
                      selected={clip === this.state.currentClip}
                    />
                    }
                  </td>
                )}
              </tr>}
            </tbody>
          </table>
        </Clips>
      </div>
    );
  }
}
