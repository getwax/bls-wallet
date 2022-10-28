import { CaretRight, CaretLeft, CircleNotch, CopySimple } from 'phosphor-react';
import { FunctionComponent, useEffect, useState } from 'react';
import Button from '../../../../components/Button';
import { useQuill } from '../../../../QuillContext';

const StepTwoWalletCreation: FunctionComponent<{
  onBack: () => void;
  onComplete: () => void;
  setWalletPkToParent: (address: string) => void;
  setWalletAddressToParent: (address: string) => void;
  walletAddress: string;
}> = ({
  onBack,
  onComplete,
  setWalletPkToParent,
  walletAddress,
  setWalletAddressToParent,
}) => {
  const [loading, setLoading] = useState<boolean>(!walletAddress);

  const { rpc } = useQuill();

  useEffect(() => {
    const createWallet = async () => {
      setLoading(true);
      const { address, privateKey } = await rpc.createTempAccount();
      setWalletAddressToParent(address);
      setWalletPkToParent(privateKey);
      setLoading(false);
    };

    if (!walletAddress) {
      createWallet();
    }
  }, [walletAddress, rpc, setWalletPkToParent, setWalletAddressToParent]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-grow">
        <div className="text-[14pt]">Recovery Wallet</div>
        <div className="text-[10pt] text-grey-700 leading-loose">
          This is the wallet address which will be used to recover your instant
          wallet.
        </div>
        <br />
        <div className="text-[10pt] text-grey-700 leading-loose font-bold mt-2">
          Copy the address and paste it in the instant wallet.
        </div>
        <div className="mt-4 bg-grey-900 bg-opacity-25 rounded-md p-5">
          {loading ? (
            <div className="flex gap-4 text-[12pt] items-center">
              Generating wallet
              <div className="animate-spin relative">
                <CircleNotch size={30} />
              </div>
            </div>
          ) : (
            <div className="flex justify-between">
              <div className="font-mono text-[11pt]">{walletAddress}</div>
              {/* eslint-disable-next-line */}
              <div
                className="cursor-pointer"
                onClick={() => navigator.clipboard.writeText(walletAddress)}
              >
                <CopySimple size={20} />
              </div>
            </div>
          )}
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
          onPress={() => onComplete()}
          className="btn-primary h-10 text-[10pt] w-1/3"
          icon={<CaretRight size={15} />}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default StepTwoWalletCreation;
