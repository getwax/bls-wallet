import { FunctionComponent } from 'react';
import CheckBox from '../../../cells/components/CheckBox';
import { useQuill } from '../../QuillContext';

const DeveloperSettings: FunctionComponent = () => {
  const { cells } = useQuill();

  return (
    <>
      <div>
        Break on assertion failures:{' '}
        <CheckBox cell={cells.breakOnAssertionFailures} />
      </div>
      <div>
        Expose <span style={{ fontFamily: 'monospace' }}>ethereum.rpc</span>:{' '}
        <CheckBox cell={cells.exposeEthereumRpc} />
      </div>
    </>
  );
};

export default DeveloperSettings;
