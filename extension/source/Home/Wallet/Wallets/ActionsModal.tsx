import { X } from 'phosphor-react';
import { FunctionComponent, useState } from 'react';
import Modal from 'react-modal';
import Button from '../../../components/Button';
import TransactionCard from '../../../Confirm/TransactionCard';
import { SendTransactionParams } from '../../../types/Rpc';

const ActionsModal: FunctionComponent<{ actions: SendTransactionParams[] }> = ({
  actions,
}) => {
  const [modalIsOpen, setIsOpen] = useState(false);

  function openModal() {
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  return (
    <div>
      <Button
        className="text-blue-500 hover:underline cursor-pointer"
        onPress={() => openModal()}
      >
        {actions.length} actions
      </Button>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => closeModal()}
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
          <div className="">All Actions ({actions.length})</div>
          <Button onPress={() => closeModal()}>
            <X fontSize="20pt" />
          </Button>
        </div>

        <div className="p-6">
          {actions.map((action) => (
            <>
              <TransactionCard {...action} />
              <div className="mb-5" />
            </>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ActionsModal;
