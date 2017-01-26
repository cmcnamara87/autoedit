import React, { Component } from 'react';
// import { Link } from 'react-router';
// import styles from './Home.css';
import fs from 'fs';
import styled from 'styled-components';
import { remote } from 'electron';
import './Home.css';

const Clip = styled.div `
  padding: 20px;
  border: 1px solid #eee;
  margin-left: -15px;
  margin-right:-15px;
`;
const BadClips = styled.div `
  border: 2px solid yellow;
  margin-left: -15px;
  margin-right:-15px;
`;

export default class Home extends Component {
  constructor() {
    super();
    this.state = {
      files: []
    };

    fs.readdir('/Users/craig/Sites/jumpcut-test/public/clips/good', (err, goodFiles) => {
      // fs.readdir(process.cwd() + '/public/clips/good/', function(err, goodFiles) {
      console.log('got files', goodFiles);
      this.setState({
        files: goodFiles
      });
    });
    // goodFiles = goodFiles.map(file => {
    //   return {
    //     good: true,
    //     file: file
    //   }
    // });
    this.handleOpenFolder = this.handleOpenFolder.bind(this);
  }
  handleOpenFolder() {
    remote.dialog.showOpenDialog({
      properties: ['openDirectory']
    }, folders => {
      this.setState({
        inputFolder: folders[0]
      });
      return folders[0];
    });
  }
  render() {
    return (
      <div style={{ height: '100%' }}>
        <div className="navbar navbar-inverse navbar-fixed-top" role="navigation">
          <div className="container-fluid">
            <div className="navbar-header">
              <button type="button" className="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                <span className="sr-only">Toggle navigation</span>
                <span className="icon-bar" />
                <span className="icon-bar" />
                <span className="icon-bar" />
              </button>
              <a className="navbar-brand" href="">Navbar</a>
            </div>
            <div className="navbar-collapse collapse">
              <ul className="nav navbar-nav">
                <li className="active">
                  <a href="">Link</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="container-fluid content">
          <div className="row">
            <div className="col-sm-2 navview">
              <h2>Navigation</h2>
            </div>
            <div className="col-sm-3 mainview">
              <h2>Clips</h2>
              <div>{ this.state.inputFolder }</div>
              <div>
                <button onClick={this.handleOpenFolder}>Open Folder</button>
              </div>
              {this.state.files.map((file) =>
                <div><Clip>{file}</Clip><BadClips /></div>
              )}
            </div>
            <div className="col-sm-7 subview">
              <h2>Sub View</h2>
              <video
                controls
                style={{ width: '100%' }} src="/Users/craig/Sites/jumpcut-test/public/clips/good/10001.mp4"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
