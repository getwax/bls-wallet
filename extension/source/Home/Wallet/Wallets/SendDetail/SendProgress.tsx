import { CaretLeft } from 'phosphor-react';
import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';

import useCell from '../../../../cells/useCell';
import Button from '../../../../components/Button';
import { useQuill } from '../../../QuillContext';

import type { SendState } from './SendDetail';

const SendProgress: FunctionComponent<{ state: SendState }> = ({ state }) => {
  const quill = useQuill();
  const navigate = useNavigate();

  const $blockNumber = useCell(quill.cells.blockNumber);

  return (
    <div className="flex flex-col gap-4">
      <pre>{JSON.stringify(state, null, 2)}</pre>
      {$blockNumber && state.step !== 'confirmed' && 'sendBlock' in state && (
        <pre>Block: Sent + {$blockNumber - state.sendBlock}</pre>
      )}
      {$blockNumber && state.step === 'confirmed' && (
        <pre>Block: Confirmed + {$blockNumber - state.receipt.blockNumber}</pre>
      )}
      <div className="flex flex-row">
        <Button
          className={[
            state.step === 'confirmed' ? 'btn-primary' : 'btn-secondary',
            'flex',
            'flex-row',
          ].join(' ')}
          onPress={() => navigate('/wallets')}
          iconLeft={<CaretLeft className="icon-md" />}
        >
          Back
        </Button>
      </div>
    </div>
  );
};

export default SendProgress;
