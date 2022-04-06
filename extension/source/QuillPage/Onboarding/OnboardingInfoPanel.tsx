import { FunctionComponent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { runtime } from 'webextension-polyfill';
import LogoFooter from './LogoFooter';

const info = [
  {
    heading: 'What is Quill?',
    description: `The world is changing and Quill will be your co-pilot as you
  engage with many new and exciting opportunities provided by the
  Ethereum blockchain.`,
  },
  {
    heading: 'What is under the hood?',
    description: `Quill is on the cutting edge, leveraging the newest Ethereum
  technologies to give you fast and low-cost transactions,
  directly in your browser`,
  },
  {
    heading: 'How do I keep my wallets secure?',
    description: (
      <ol>
        <li>
          1. NEVER share your secret recovery phrase. This can be used to access
          your wallets. No legitimate service will ever ask for this phrase.
        </li>
        <br />
        <li>
          2. Write this phrase down and store a physical copy somewhere safe,
          like a safety deposit box or vault.
        </li>
        <br />
        <li>
          3. You can also store this phrase in a password manager, however this
          is less secure.
        </li>
      </ol>
    ),
  },
];

const OnboardingInfoPanel: FunctionComponent = () => {
  const [params] = useSearchParams();
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const currentPage = Number(params.get('p'));
    setPageIndex(currentPage - 1);
  }, [params]);

  return (
    <div className="bg-blue-500 flex flex-col w-2/5">
      <div
        className="h-screen p-32 flex flex-col justify-between"
        style={{
          background: `center no-repeat url(${runtime.getURL(
            'assets/info-panel-pretty-curve.svg',
          )})`,
        }}
      >
        <div
          className="h-64 w-full rounded-md"
          style={{
            background: `url(${runtime.getURL(
              `assets/onboarding-art-${pageIndex + 1}.svg`,
            )}) no-repeat center`,
          }}
        />
        <div className="flex-grow text-white py-8">
          <div className="font-medium mb-2">{info[pageIndex].heading}</div>
          <div className="font-light">{info[pageIndex].description}</div>
        </div>
        <LogoFooter />
      </div>
    </div>
  );
};

export default OnboardingInfoPanel;
