import { X } from 'phosphor-react';
import { useState } from 'react';
import Modal from 'react-modal';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../../../components/Button';

const QRCodeModal = (props: { address: string }) => {
  const [modalIsOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onPress={() => setIsOpen(true)} className="btn-secondary">
        Receive
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
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <div
          className={[
            'bg-blue-700',
            'p-4',
            'text-white',
            'text-[13pt]',
            'flex',
            'justify-between',
          ].join(' ')}
        >
          <Button onPress={() => setIsOpen(false)}>
            <X fontSize="20pt" />
          </Button>
        </div>
        <div className="flex justify-center py-16">
          <QRCodeSVG value={props.address} size={300} />
        </div>
        <div className="p-8 flex justify-center text-[14pt]">
          Scan this QR Code to get the wallet address
        </div>
      </Modal>
    </div>
  );
};

export default QRCodeModal;
