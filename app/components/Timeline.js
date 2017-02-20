import React, { Component } from 'react';
import _ from 'lodash';
// import { Link } from 'react-router';
// import styles from './Home.css';
import styled from 'styled-components';

const clipWidth = 70;

const Clip = styled.a`
  display: block;
  height: 30px;
  width: ${props => (props.duration / 1000) * clipWidth}px;
  padding: 20px 0;
  cursor: pointer;
  border-radius: 100px;
  box-shadow: ${props => (props.selected ? '0 0 20px yellow' : 'none')};
  &:hover {
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
  background-color: ${props => (props.current ? '#8edaff' : '#4fc5ff')};
`;
const BadClip = styled(Clip)`
  background-color: ${props => (props.current ? '#ffca66' : '#ffb426')};
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

export default class Timeline extends Component {
  constructor(props) {
    super(props);
    this.times = [];
    this.handleScroll = this.handleScroll.bind(this);
  }
  componentDidMount() {
    this.div.addEventListener('scroll', this.handleScroll);
    document.addEventListener('keydown', (e) => {
      const keyCode = e.keyCode;

      // Right: 39
      if (keyCode === 39 && this.props.selectedClip) {
        e.preventDefault();
        let nextIndex;
        const currentIndex = this.props.clips.indexOf(this.props.selectedClip);
        if (this.props.selectedClip.good) {
          nextIndex = _.findIndex(this.props.clips, (clip, index) =>
            index > currentIndex && clip.good
          );
        } else {
          nextIndex = currentIndex + 1;
        }
        // click the next clip
        this.handleClick(nextIndex);
      }
      // Left: 37
      if (keyCode === 37 && this.props.selectedClip) {
        e.preventDefault();
        const currentIndex = this.props.clips.indexOf(this.props.selectedClip);
        this.handleClick(currentIndex - 1);
      }
    }, false);
  }
  componentDidUpdate() {
    this.div.scrollLeft = (this.props.time / 1000) * this.props.clipWidth;
    if (this.props.scrollEnabled) {
      this.div.addEventListener('scroll', this.handleScroll);
    } else {
      this.div.removeEventListener('scroll', this.handleScroll);
    }
    this.times = this.props.clips.map((myClip, myIndex) => {
      const startTime = this.props.clips
        .filter((clip, clipIndex) => clipIndex < myIndex)
        .map(clip => clip.duration)
        .reduce((a, b) => a + b, 0);
      const endTime = startTime + myClip.duration;
      return {
        startTime,
        endTime
      };
    });
  }
  props: {
    clipWidth: number,
    time: number,
    clips: array,
    isEditing: boolean,
    scrollEnabled: boolean,
    selectedClip: object,
    onClipClicked: () => void,
    onScrollToTime: () => void
  }
  handleScroll() {
    this.props.onScrollToTime((this.div.scrollLeft / this.props.clipWidth) * 1000);
  }
  handleClick(index) {
    this.props.onScrollToTime(this.times[index].startTime);
    this.props.onClipClicked(this.props.clips[index]);
  }
  // handleMoveUp() {
  //   // mutating state, bleh
  //   const newFullPath = `${this.state.workingFolder}/good/${this.state.selectedClip.fileName}`;
  //   fs.rename(
  //     this.state.selectedClip.fullPath,
  //     newFullPath,
  //     () => {
  //       this.stitchClips();
  //     }
  //   );
  //
  //   this.state.selectedClip.good = true;
  //   this.state.selectedClip.fullPath = newFullPath;
  //   this.setState({
  //     clips: this.clips
  //   });
  // }
  // handleMoveDown() {
  //   // mutating state, bleh
  //   const newFullPath = `${this.state.workingFolder}/bad/${this.state.selectedClip.fileName}`;
  //   fs.rename(
  //     this.state.selectedClip.fullPath,
  //     newFullPath,
  //     () => {
  //       this.stitchClips();
  //     }
  //   );
  //
  //   this.state.selectedClip.good = false;
  //   this.state.selectedClip.fullPath = newFullPath;
  //   const currentIndex = this.state.clips.indexOf(this.state.selectedClip);
  //   this.setState({
  //     selectedClip: this.state.clips[currentIndex - 1]
  //   });
  // }
  render() {
    const currentClipIndex = _.findIndex(
      this.times,
      time => time.startTime <= this.props.time && this.props.time < time.endTime
    );
    console.log('currentCLip', currentClipIndex);

    return (<div>
      <div className="well">{this.props.time / 1000} seconds</div>
      <Clips innerRef={(ref) => { this.div = ref; return ref; }}>
        <table>
          <tbody>
            <tr>
              {this.props.clips.map((clip, index) =>
                <td key={clip.id}>
                  {clip.good &&
                  <GoodClip
                    good={clip.good}
                    tabindex={0 - index}
                    duration={clip.duration}
                    onClick={() => this.handleClick(index)}
                    inSelectionMode={this.props.selectedClip}
                    selected={this.props.selectedClip && this.props.selectedClip.id === clip.id}
                    current={index === currentClipIndex}
                  />
                  }
                </td>
              )}
            </tr>
            <tr>
              {this.props.clips.map((clip, index) =>
                <td key={clip.id}>
                  {!clip.good &&
                  <BadClip
                    good={clip.good}
                    duration={clip.duration}
                    onClick={() => this.props.onClipClicked(clip)}
                    selected={this.props.selectedClip && clip.id === this.props.selectedClip.id}
                    current={index === currentClipIndex}
                  />
                  }
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </Clips>
      <Line />
    </div>);
  }
}
