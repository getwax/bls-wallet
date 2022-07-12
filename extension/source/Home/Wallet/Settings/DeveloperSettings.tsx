import { FunctionComponent } from 'react';
import CheckBox from '../../../cells/components/CheckBox';
import { useQuill } from '../../../QuillContext';

const DeveloperSettings: FunctionComponent = () => {
  const { cells } = useQuill();

  return (
    <>
      <pre>
        {[
          [
            'Break on assertion failures:  ',
            <CheckBox
              key="breakOnAssertionFailures"
              cell={cells.breakOnAssertionFailures}
            />,
            '\n',
          ],
          [
            'Expose dApps to ethereum.rpc: ',
            <CheckBox key="exposeEthereumRpc" cell={cells.exposeEthereumRpc} />,
            '\n',
          ],
          '\n',
          'RPC logging:\n',
          [
            '  in background script:       ',
            <CheckBox
              key="rpcBackgroundLogging"
              cell={cells.rpcBackgroundLogging}
            />,
            '\n',
          ],
          [
            '  in dApp pages:              ',
            <CheckBox key="rpcInPageLogging" cell={cells.rpcInPageLogging} />,
            '\n',
          ],
        ]}
      </pre>
    </>
  );
};

export default DeveloperSettings;
