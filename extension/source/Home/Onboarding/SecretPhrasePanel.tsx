import { ethers } from 'ethers';
import { FunctionComponent, useState } from 'react';
import { FilePlus, Cardholder } from 'phosphor-react';
import Button from '../../components/Button';

import ReviewSecretPhrasePanel from './ReviewSecretPhrasePanel';
import ViewSecretPhrasePanel from './ViewSecretPhrasePanel';

const SecretPhrasePanel: FunctionComponent<{
  secretPhrase?: string[];
}> = () => {
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [mnemonicInput, setMnemonicInput] = useState<string>('');

  const createMnemonic = () => {
    const mnemonicPhrase = ethers.Wallet.createRandom().mnemonic.phrase;
    setMnemonic(mnemonicPhrase.split(' '));
  };

  const validateAndSetMnemonic = (m: string) => {
    const split = m.split(' ');
    if (split.length === 12) {
      setMnemonic(split);
    }
  };

  const [inReview, setInReview] = useState(false);

  if (mnemonic.length === 0) {
    return (
      <div className="">
        <div className="mb-10">
          <div className="font-bold">One Last step!</div>
          <span>
            You can use an existing seed phrase to generate BLS keypair,
            Otherwise we will create a new fresh one for you
          </span>
        </div>

        <div className="flex flex-col justify-center align-middle gap-3">
          <Button
            className="btn-primary"
            onPress={createMnemonic}
            iconLeft={<FilePlus size={20} />}
          >
            Generate New
          </Button>

          <div className="text-center text-grey-800"> - OR - </div>

          <div className="">
            <textarea
              className={[
                'mt-2',
                'bg-opacity-5',
                'border-opacity-25',
                'focus:border-opacity-25',
              ].join(' ')}
              placeholder="12 word Mnemonic (space separated)"
              onChange={(e) => {
                setMnemonicInput(e.target.value);
              }}
            />
            <Button
              className="btn-secondary"
              onPress={() => validateAndSetMnemonic(mnemonicInput)}
              iconLeft={<Cardholder size={20} />}
            >
              Use Existing Mnemonic
            </Button>
          </div>
        </div>
      </div>
    );
  }
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
    />
  );
};

export default SecretPhrasePanel;
