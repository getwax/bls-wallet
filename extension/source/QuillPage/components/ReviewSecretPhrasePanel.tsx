import * as React from 'react';

import { ArrowRight } from 'phosphor-react';
import Button from '../../components/Button';
import Range from '../../helpers/Range';

const WordInReview: React.FunctionComponent<{
  index: number;
  sampleIndex: number;
  word: string;
  handleGuess: (index: number, isCorrect: boolean) => void;
}> = ({ index, sampleIndex, word, handleGuess }) => {
  const [guess, setGuess] = React.useState('');

  React.useEffect(() => {
    const isCorrect = guess === word;
    handleGuess(index, isCorrect);
    // eslint-disable-next-line
  }, [guess]);

  const getConfirmWordClass = () => {
    if (guess === '') {
      return '';
    }
    if (guess === word) {
      return 'border-2 border-positive-500 bg-positive-500 focus:border-positive-500';
    }
    if (word.startsWith(guess)) {
      return 'border-2 border-neutral-500 bg-neutral-500 focus:border-neutral-500';
    }
    return 'border-2 border-alert-500 bg-alert-500 focus:border-alert-500';
  };

  return (
    <input
      type="text"
      className={`mt-2 bg-opacity-5 border-opacity-25 focus:border-opacity-25 ${getConfirmWordClass()}`}
      placeholder={`Secret word ${sampleIndex + 1} ${word}`}
      onInput={(e) => {
        const userEntry = (e.target as HTMLInputElement).value.toLowerCase();
        setGuess(userEntry);
      }}
    />
  );
};

const ReviewSecretPhrasePanel: React.FunctionComponent<{
  secretPhrase: string[];
  sampleIndexes?: number[];
  onBack: () => void;
  onComplete: () => void;
}> = ({ secretPhrase, sampleIndexes = [0, 3, 9, 11], onBack, onComplete }) => {
  const len = sampleIndexes.length;

  const [reviewWordStates, setReviewWordStates] = React.useState<boolean[]>(
    Range(len).map(() => false),
  );

  const [allCorrect, setAllCorrect] = React.useState<boolean>(false);

  const handleGuess = (index: number, isCorrect: boolean) => {
    const snapshot = reviewWordStates;
    snapshot[index] = isCorrect;
    setReviewWordStates(snapshot);
    setAllCorrect(reviewWordStates.every((item) => item === true));
  };

  return (
    <div className="w-[28rem]">
      <div className="mb-10">
        <div className="font-bold">
          Ok, last step before you get started with Quill!
        </div>
        <span>
          Let&apos;s check a few words from your secret phrase to make extra
          sure you&apos;ve got it.
        </span>
      </div>

      {Range(4).map((i) => (
        <WordInReview
          handleGuess={handleGuess}
          index={i}
          sampleIndex={sampleIndexes[i]}
          word={secretPhrase[i].toLowerCase()}
          key={`s${i}`}
        />
      ))}

      <div className="mt-2 text-grey-500">
        You must correctly enter your secret phrase words before you can
        proceed.
      </div>
      <div>
        <div className="flex gap-2 mt-6">
          <Button className="btn-secondary w-1/2" onPress={onBack}>
            Back
          </Button>
          <Button
            className={`w-1/2 ${allCorrect ? 'btn-primary' : 'btn-disabled'}`}
            onPress={() => allCorrect && onComplete()}
            icon={<ArrowRight className="icon-md" />}
          >
            Confirm secret phrase
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewSecretPhrasePanel;
