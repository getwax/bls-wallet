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
        Expose <pre>ethereum.rpc</pre>:{' '}
        <CheckBox cell={cells.exposeEthereumRpc} />
      </div>
    </>
  );
};

export default DeveloperSettings;
