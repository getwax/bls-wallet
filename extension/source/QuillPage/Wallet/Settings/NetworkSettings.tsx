import { FunctionComponent } from 'react';
import Display from '../../../cells/components/Display';
import { useQuill } from '../../QuillContext';

const NetworkSettings: FunctionComponent = () => {
  const { cells } = useQuill();

  return (
    <>
      <pre>
        <Display cell={cells.networkJson} />
      </pre>
    </>
  );
};

export default NetworkSettings;
