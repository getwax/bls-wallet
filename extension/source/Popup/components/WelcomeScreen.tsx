import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import Button from '../../components/Button';
import Carousel from './Carousel';

import LargeQuillHeading from './LargeQuillHeading';

const WelcomeScreen: React.FunctionComponent = () => (
  <div className="welcome-screen">
    <LargeQuillHeading />
    <Carousel
      images={[
        browser.runtime.getURL('assets/welcome-art-1.svg'),
        browser.runtime.getURL('assets/welcome-art-2.svg'),
        browser.runtime.getURL('assets/welcome-art-3.svg'),
      ]}
    />
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

export default WelcomeScreen;
