import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import LogoFooter from './LogoFooter';

const OnboardingInfoPanel: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <div className="onboarding-info-panel quick-column">
    <div
      className="quick-column"
      style={{
        background: `center no-repeat url(${browser.runtime.getURL(
          'assets/info-panel-pretty-curve.svg',
        )})`,
      }}
    >
      <div
        className="artwork"
        style={{
          background: [
            'no-repeat',
            'center',
            `url(${browser.runtime.getURL(
              `assets/onboarding-art-${pageIndex + 1}.svg`,
            )})`,
          ].join(' '),
        }}
      />
      <div className="info-text">
        {
          [
            <>
              <h3>What is Quill?</h3>
              <p>
                The world is changing and Quill will be your co-pilot as you
                engage with many new and exciting opportunities provided by the
                Ethereum blockchain.
              </p>
            </>,
            <>
              <h3>What is under the hood?</h3>
              <p>
                Quill is on the cutting edge, leveraging the newest Ethereum
                technologies to give you fast and low-cost transactions,
                directly in your browser.
              </p>
            </>,
            <>
              <h3>How do I keep my wallets secure?</h3>
              <ol>
                <li>
                  NEVER share your secret recovery phrase. This can be used to
                  access your wallets. No legitimate service will ever ask for
                  this phrase.
                </li>
                <li>
                  Write this phrase down and store a physical copy somewhere
                  safe, like a safety deposit box or vault.
                </li>
                <li>
                  You can also store this phrase in a password manager, however
                  this is less secure.
                </li>
              </ol>
            </>,
          ][pageIndex]
        }
      </div>
      <LogoFooter />
    </div>
  </div>
);

export default OnboardingInfoPanel;
