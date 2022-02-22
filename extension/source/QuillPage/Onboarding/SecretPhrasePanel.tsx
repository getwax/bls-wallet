import { FunctionComponent, useState } from 'react';

import ReviewSecretPhrasePanel from './ReviewSecretPhrasePanel';
import ViewSecretPhrasePanel from './ViewSecretPhrasePanel';

const exampleSecretPhrase = [
  'Potato',
  'Velvet',
  'Keen',
  'Water',
  'Travel',
  'Pill',
  'Book',
  'Photo',
  'Image',
  'Space',
  'Pause',
  'Power',
];

const SecretPhrasePanel: FunctionComponent<{
  secretPhrase?: string[];
  onComplete?: () => void;
}> = ({ secretPhrase = exampleSecretPhrase, onComplete = () => {} }) => {
  const [inReview, setInReview] = useState(false);

  if (!inReview) {
    return (
      <ViewSecretPhrasePanel
        secretPhrase={secretPhrase}
        onComplete={() => setInReview(true)}
      />
    );
  }

  return (
    <ReviewSecretPhrasePanel
      secretPhrase={secretPhrase}
      onBack={() => setInReview(false)}
      onComplete={onComplete}
    />
  );
};

export default SecretPhrasePanel;
