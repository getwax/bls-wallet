import { ethers, wordlists } from 'ethers';
import { FunctionComponent, useEffect, useState } from 'react';
import { FilePlus, Cardholder, Warning } from 'phosphor-react';
import Button from '../../components/Button';

import ReviewSecretPhrasePanel from './ReviewSecretPhrasePanel';
import ViewSecretPhrasePanel from './ViewSecretPhrasePanel';

const SecretPhrasePanel: FunctionComponent<{
  secretPhrase?: string[];
}> = () => {
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [mnemonicInput, setMnemonicInput] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (mnemonicInput !== '') {
      if (mnemonicInput.split(' ').length !== 12) {
        setError(true);
        return;
      }

      try {
        ethers.Wallet.fromMnemonic(mnemonicInput);
        setError(false);
      } catch (error) {
        setError(true);
      }
    }
  }, [mnemonicInput]);

  const createMnemonic = () => {
    const mnemonicPhrase = ethers.Wallet.createRandom().mnemonic.phrase;
    setMnemonic(mnemonicPhrase.split(' '));
  };

  const validateAndSetMnemonic = (m: string) => {
    const split = m.split(' ');
    if (!error) {
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
              placeholder="existing 12 word Mnemonic (space separated)"
              onChange={(e) => {
                setMnemonicInput(e.target.value);
              }}
            />
            {mnemonicInput !== '' && !error && (
              <Button
                className="btn-secondary"
                onPress={() => validateAndSetMnemonic(mnemonicInput)}
                iconLeft={<Cardholder size={20} />}
              >
                Use Existing Mnemonic
              </Button>
            )}

            {error && (
              <div className="bg-alert-400 p-4 mt-4 text-[10pt] rounded-md flex gap-4 bg-opacity-20">
                <Warning className="text-alert-500 mt-1" size={64} />
                <div className="align-text-top">
                  Please enter correct 12 word mnemonic compatible with BIP-39
                  standard, separated by space.
                </div>
              </div>
            )}
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
