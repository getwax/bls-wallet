import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import Button from '../../components/Button';
import Carousel from './Carousel';

import LargeQuillHeading from './LargeQuillHeading';

// eslint-disable-next-line @typescript-eslint/ban-types
type Props = {};

// eslint-disable-next-line @typescript-eslint/ban-types
type State = {};

export default class WelcomeScreen extends React.Component<Props, State> {
  render(): React.ReactNode {
    return (
      <div className="welcome-screen">
        <LargeQuillHeading />
        <div className="welcome-carousel-container">
          <Carousel />
        </div>
        <div className="body">
          <h3>Welcome to Quill!</h3>
          <p>Your digital wallet for a digital world.</p>
          <div className="get-started-container">
            <Button
              onPress={() => {}}
              highlight={true}
              icon={{
                src: browser.runtime.getURL('assets/arrow-small.svg'),
                px: 19,
              }}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
