import { FunctionComponent, useMemo } from 'react';
import Display from '../../../cells/components/Display';
import Selector from '../../../cells/components/Selector';
import { useQuill } from '../../../QuillContext';

const NetworkSettings: FunctionComponent = () => {
  const { cells, config } = useQuill();

  const visibleNetworks = useMemo(() => {
    return Object.values(config.builtinNetworks)
      .filter((n) => !n?.hidden)
      .map((n) => n?.displayName)
      .filter(notUndefined);
  }, [config.builtinNetworks]);

  return (
    <>
      <Selector
        options={visibleNetworks}
        selection={cells.networkDisplayName}
      />
      <pre>
        <Display cell={cells.networkJson} />
        {'\n'}
        Block number: <Display cell={cells.blockNumber} />
      </pre>
    </>
  );
};

function notUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}

export default NetworkSettings;
