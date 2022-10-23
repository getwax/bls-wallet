import { CaretRight, CircleNotch, CopySimple } from "phosphor-react";
import { FunctionComponent, useEffect, useState } from "react";
import Button from "../../../../components/Button";
import { useQuill } from "../../../../QuillContext";

const StepTwoWalletCreation: FunctionComponent<{
  onComplete: () => void;
  setWalletToParent: (address: string) => void;
}> = ({ onComplete, setWalletToParent }) => {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const { rpc } = useQuill();

  useEffect(() => {
    const createWallet = async () => {
      setLoading(true);
      const address = await rpc.addHDAccount();
      setWalletAddress(address);
      setWalletToParent(address);
      setLoading(false);
    };

    createWallet();
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-grow">
        <div className="text-[14pt]">Recovery Wallet</div>
        <div className="text-[10pt] text-grey-700 leading-loose">
          This is the address where your instant wallet will be recovered to.
          All your tokens will be transferred to this smart contract wallet's
          address
        </div>
        <br />
        <div className="text-[10pt] text-grey-700 leading-loose font-bold mt-2">
          Copy the address and paste it in the instant wallet.
        </div>
        <div className="mt-4 bg-grey-900 bg-opacity-25 rounded-md p-5">
          {loading ? (
            <div className="flex gap-4 text-[12pt] items-center ">
              Generating wallet
              <div className="animate-spin relative">
                <CircleNotch size={30} />
              </div>
            </div>
          ) : (
            <div className="flex justify-between">
              <div className="font-mono text-[11pt]">{walletAddress}</div>
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

      <div className="flex justify-end">
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
