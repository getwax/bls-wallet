import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import Button from '../../components/Button';
import Range from '../../helpers/Range';
import QuickRow from './QuickRow';

type ReviewWordState = 'partial' | 'correct' | 'incorrect';

const ReviewSecretPhrasePanel: React.FunctionComponent<{
  secretPhrase: string[];
  sampleIndexes?: number[];
  onBack: () => void;
  onComplete: () => void;
}> = ({ secretPhrase, sampleIndexes = [0, 3, 9, 11], onBack, onComplete }) => {
  const len = sampleIndexes.length;
  const correctSamples = sampleIndexes.map((i) => secretPhrase[i]);

  const [reviewWordStates, setReviewWordStates] = React.useState<
    ReviewWordState[]
  >(Range(len).map(() => 'partial'));

  return (
    <div>
      <div className="instructions-text">
        <p>
          Ok, this is the last step and then you can get started with Quill!.
          Let&apos;s check a few words from your secret phrase to make extra
          sure you&apos;ve got it.
        </p>
      </div>
      <div className="review-secret-phrase-box">
        {Range(4).map((i) => (
          <div key={`s${i}`}>
            <input
              className={reviewWordStates[i]}
              type="text"
              placeholder={`Secret word ${sampleIndexes[i] + 1}`}
              onInput={(e) => {
                const userEntry = (
                  e.target as HTMLInputElement
                ).value.toLowerCase();

                const correctEntry = correctSamples[i].toLowerCase();

                const currentState = reviewWordStates[i];
                let newState: ReviewWordState;

                if (userEntry === correctEntry) {
                  newState = 'correct';
                } else if (correctEntry.startsWith(userEntry)) {
                  newState = 'partial';
                } else {
                  newState = 'incorrect';
                }

                if (newState !== currentState) {
                  const newReviewWordStates = reviewWordStates.slice();
                  newReviewWordStates[i] = newState;
                  setReviewWordStates(newReviewWordStates);
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="explainer-box">
        You must correctly enter your secret phrase words before you can
        proceed.
      </div>
      <div>
        <QuickRow>
          <Button onPress={onBack} highlight={false}>
            Back
          </Button>
          <Button
            onPress={onComplete}
            highlight={true}
            icon={{
              src: browser.runtime.getURL('assets/arrow-small.svg'),
              px: 19,
            }}
          >
            Confirm secret phrase
          </Button>
        </QuickRow>
      </div>
    </div>
  );
};

export default ReviewSecretPhrasePanel;
