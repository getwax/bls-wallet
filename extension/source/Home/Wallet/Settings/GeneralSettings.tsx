import { FunctionComponent } from 'react';
import Display from '../../../cells/components/Display';
import { useQuill } from '../../QuillContext';

const GeneralSettings: FunctionComponent = () => {
  const { cells } = useQuill();

  return (
    <>
      {/* TODO: Currency selection */}
      Currency conversion rate: <Display cell={cells.currencyConversion} />
    </>
  );
};

export default GeneralSettings;
