import { FunctionComponent, useState } from 'react';
import Modal from 'react-modal';
import Button from '../../../../components/Button';
import Range from '../../../../helpers/Range';
import StepOneInfo from './StepOneInfo';
import StepThreeRecover from './StepThreeRecover';
import StepTwoWalletCreation from './StepTwoWalletCreation';

const WorkflowNumbers: FunctionComponent<{
  max: number;
  current: number;
}> = ({ max, current }) => {
  return (
    <div className="flex justify-center space-x-10">
      {Range(max).map((i) => (
        <div
          key={i}
          className={[
            'icon-lg',
            'rounded-full',
            'text-center',
            'leading-8',
            'cursor-pointer',
            ...(i <= current ? ['bg-blue-500', 'text-white'] : ['text-black']),
          ].join(' ')}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
};

const RecoverWalletModal = () => {
  const [modalIsOpen, setIsOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string>('');

  return (
    <div>
      <Button onPress={() => setIsOpen(true)} className="btn-secondary">
        Import
      </Button>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setIsOpen(false)}
        style={{
          content: {
            width: '35rem',
            margin: 'auto',
            fontFamily: 'montserrat',
            padding: 0,
            border: 'none',
            height: '25rem',
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <div className="p-8 h-full w-100 flex flex-col">
          <WorkflowNumbers max={3} current={pageIndex} />
          <div className="mt-8 h-100 flex-grow">
            {
              [
                <StepOneInfo
                  key={1}
                  onComplete={() => {
                    setPageIndex(1);
                  }}
                />,
                <StepTwoWalletCreation
                  key={2}
                  setWalletToParent={setWalletAddress}
                  onComplete={() => {
                    setPageIndex(2);
                  }}
                />,
                <StepThreeRecover
                  key={3}
                  walletAddress={walletAddress}
                  onComplete={() => setIsOpen(false)}
                />,
              ][pageIndex]
            }
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RecoverWalletModal;
