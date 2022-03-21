import { ethers } from 'ethers';
import { FunctionComponent, useEffect, useState } from 'react';

import ReviewSecretPhrasePanel from './ReviewSecretPhrasePanel';
import ViewSecretPhrasePanel from './ViewSecretPhrasePanel';

const SecretPhrasePanel: FunctionComponent<{
  secretPhrase?: string[];
  onComplete?: () => void;
}> = ({ onComplete = () => {} }) => {
  const [mnemonic, setMnemonic] = useState<string[]>([]);

  useEffect(() => {
    const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
    setMnemonic(mnemonic.split(' '));
  }, []);

  const [inReview, setInReview] = useState(false);

  if (!inReview) {
    return (
      <ViewSecretPhrasePanel
        secretPhrase={mnemonic}
        onComplete={() => setInReview(true)}
      />
    );
  }

  return (
    <ReviewSecretPhrasePanel
      secretPhrase={mnemonic}
      onBack={() => setInReview(false)}
      onComplete={onComplete}
    />
  );
};

export default SecretPhrasePanel;
