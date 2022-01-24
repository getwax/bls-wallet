import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import { ArrowRight } from 'phosphor-react';
import Button from '../../components/Button';
import Carousel from './Carousel';

import LargeQuillHeading from './LargeQuillHeading';

const WelcomeScreen: React.FunctionComponent = () => (
  <div>
    <LargeQuillHeading />
    <Carousel
      images={[
        browser.runtime.getURL('assets/welcome-art-1.svg'),
        browser.runtime.getURL('assets/welcome-art-2.svg'),
        browser.runtime.getURL('assets/welcome-art-3.svg'),
      ]}
    />
    <div className="flex-grow flex flex-col gap-3 pt-2 place-items-center">
      <h3>Welcome to Quill!</h3>
      <p className="font-light">Your digital wallet for a digital world.</p>
      <div className="mt-2">
        <Button
          onPress={() => window.open(browser.runtime.getURL('quillPage.html'))}
          icon={<ArrowRight className="icon-md" />}
          className="btn-primary px-9 py-4"
        >
          Get Started
        </Button>
      </div>
    </div>
  </div>
);

export default WelcomeScreen;
