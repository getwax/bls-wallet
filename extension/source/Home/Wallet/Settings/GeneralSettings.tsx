import { FunctionComponent } from 'react';
import Display from '../../../cells/components/Display';
import Selector from '../../../cells/components/Selector';
import useCell from '../../../cells/useCell';
import Loading from '../../../components/Loading';
import currencyOrderings from '../../../currencies/currencyOrderings';
import { useQuill } from '../../../QuillContext';

const GeneralSettings: FunctionComponent = () => {
  const { cells } = useQuill();

  const currency = useCell(cells.currency);

  return (
    <div>
      <div>
        {!currency && <Loading />}
        {currency && (
          <Selector
            options={[
              currency,
              ...(currencyOrderings[currency] ?? currencyOrderings.USD),
            ]}
            selection={cells.currency}
          />
        )}
      </div>
      <div>
        Currency conversion rate: <Display cell={cells.currencyConversion} />
      </div>
    </div>
  );
};

export default GeneralSettings;
