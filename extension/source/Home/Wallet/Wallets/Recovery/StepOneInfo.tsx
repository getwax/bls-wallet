import { CaretRight } from "phosphor-react";
import { FunctionComponent } from "react";
import Button from "../../../../components/Button";

const StepOneInfo: FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-grow">
        <div className="text-[14pt]">Recover existing wallet in Quill</div>
        <div className="text-[10pt] text-grey-700 leading-loose">
          You can recover existing instant BLS wallets into Quill. This is a
          simple 2 step process which requires you to copy-paste some stuff from
          Quill to the instant wallet and then again from instant wallet to
          Quill
        </div>
        <br />
        <div className="text-[10pt] text-grey-700 leading-loose font-bold mt-2">
          Do not close this modal until you have completed all the steps that
          follows else you will lose access to your original keys!
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

export default StepOneInfo;
