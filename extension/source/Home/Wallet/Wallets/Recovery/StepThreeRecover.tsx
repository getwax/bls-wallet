import { Download, CaretLeft } from 'phosphor-react';
import { FunctionComponent, useState } from 'react';
import Button from '../../../../components/Button';
import { useQuill } from '../../../../QuillContext';

const StepThreeRecover: FunctionComponent<{
  onBack: () => void;
  onComplete: () => void;
  walletPrivateKey: string;
}> = ({ onBack, onComplete, walletPrivateKey }) => {
  const { rpc } = useQuill();

  const [salt, setSalt] = useState<string>('');
  const [instantWalletAddress, setInstantWalletAddress] = useState<string>('');

  const handleRecover = async () => {
    await rpc.addRecoveryWallet(instantWalletAddress, salt, walletPrivateKey);
    onComplete();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-grow">
        <div className="text-[14pt]">Almost There</div>
        <div className="text-[10pt] text-grey-700 leading-loose">
          Your instant wallet recovery is in process. Once finished the same
          wallet will be visible inside Quill.
          <br />
          <div
            className={[
              'text-[10pt]',
              'text-grey-700',
              'leading-loose',
              'font-bold',
              'mt-2',
            ].join(' ')}
          >
            Copy back the instant wallet address and salt entered
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <input
            type="text"
            className={[
              'bg-opacity-5',
              'border-opacity-45',
              'focus:border-opacity-85',
              'h-10',
              'text-[10pt]',
            ].join(' ')}
            placeholder="Instant Wallet Address"
            onChange={(e) => {
              setInstantWalletAddress(e.target.value);
            }}
          />

          <input
            type="text"
            className={[
              'bg-opacity-5',
              'border-opacity-45',
              'focus:border-opacity-85',
              'h-10',
              'text-[10pt]',
            ].join(' ')}
            placeholder="Recovery Salt"
            onChange={(e) => {
              setSalt(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          onPress={() => onBack()}
          className="btn-primary h-10 text-[10pt] w-1/3"
          iconLeft={<CaretLeft size={15} />}
        >
          Back
        </Button>

        <Button
          onPress={() => handleRecover()}
          className="btn-primary h-10 text-[10pt] w-1/3"
          icon={<Download size={15} />}
        >
          Recover Wallet
        </Button>
      </div>
    </div>
  );
};

export default StepThreeRecover;
