import * as React from 'react';

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

const SecretPhrasePanel: React.FunctionComponent<{
  secretPhrase?: string[];
  onComplete?: () => void;
}> = ({ secretPhrase = exampleSecretPhrase, onComplete = () => {} }) => {
  const [inReview, setInReview] = React.useState(false);

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
