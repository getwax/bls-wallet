import { useState } from 'react';
import Modal from 'react-modal';
import { Download } from 'phosphor-react';
import Button from '../../../components/Button';

const ImportWalletModal = () => {
  const [modalIsOpen, setIsOpen] = useState(false);
  const [recoveryHash, setRecoveryHash] = useState('');
  const [recoverySalt, setRecoverySalt] = useState('');

  const handleRecover = () => {
    console.log(recoveryHash);
  };

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
            height: '22rem',
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <div className="p-8 h-full w-100">
          <div className="flex flex-col gap-2">
            <div className="text-[14pt]">Recover existing wallet in Quill</div>
            <div className="text-[9pt] text-grey-700">
              Copy and paste recovery hash from the instant wallet into the text
              box
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-4">
            <input
              type="text"
              className={[
                'mt-2',
                'bg-opacity-5',
                'border-opacity-45',
                'focus:border-opacity-85',
                'h-10',
                'text-[10pt]',
              ].join(' ')}
              placeholder="Recovery Hash"
              onChange={(e) => {
                setRecoveryHash(e.target.value);
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
                setRecoverySalt(e.target.value);
              }}
            />

            <div className="flex justify-end">
              <Button
                onPress={handleRecover}
                className="btn-primary h-10 text-[10pt] w-1/3"
                iconLeft={<Download />}
              >
                Recover Wallet
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ImportWalletModal;
