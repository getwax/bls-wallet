import { FunctionComponent, useMemo } from 'react';
import Display from '../../../cells/components/Display';
import Selector from '../../../cells/components/Selector';
import MemoryCell from '../../../cells/MemoryCell';
import useCell from '../../../cells/useCell';
import Loading from '../../../components/Loading';
import currencyOrderings from '../../../currencies/currencyOrderings';
import { useQuill } from '../../../QuillContext';

const alphabeticalCurrencies = ['USD', ...currencyOrderings.USD].sort();

const GeneralSettings: FunctionComponent = () => {
  const { cells } = useQuill();

  const orderPreference = useMemo(
    () => new MemoryCell<'trade' | 'alphabet'>('trade'),
    [],
  );

  const $orderPreference = useCell(orderPreference) ?? 'trade';

  const currency = useCell(cells.currency);

  let currencies: string[];

  if (
    $orderPreference === 'trade' &&
    currency &&
    currency in currencyOrderings
  ) {
    currencies = [currency, ...currencyOrderings[currency]];
  } else {
    currencies = alphabeticalCurrencies;
  }

  return (
    <div>
      <div>
        {!currency && <Loading />}
        {currency && (
          <>
            Convert chain currency to{' '}
            <Selector options={currencies} selection={cells.currency} />
          </>
        )}
      </div>
      <div>
        Order currencies by{' '}
        <Selector options={['trade', 'alphabet']} selection={orderPreference} />
      </div>
      <div>
        Currency conversion rate: <Display cell={cells.currencyConversion} />
      </div>
    </div>
  );
};

export default GeneralSettings;
