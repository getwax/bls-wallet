import { FunctionComponent } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import OnboardingPage from './Onboarding/OnboardingPage';
import { WalletPage } from './Wallet/WalletPage';
import { CellsDemoPage } from './CellsDemo/CellsDemoPage';
import { CellsDemoPage2 } from './CellsDemo/CellsDemoPage2';
import QuillContext from './QuillContext';
import useCell from '../cells/useCell';

const QuillPage: FunctionComponent = () => {
  const quillCtx = QuillContext.use();
  const theme = useCell(quillCtx.theme);

  return (
    <div className={`themable1 ${theme === 'dark' && 'dark-theme'}`}>
      <div className={`themable2 ${theme === 'dark' && 'dark-theme'}`}>
        <HashRouter>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/wallet/*" element={<WalletPage />} />
            <Route path="/cells-demo" element={<CellsDemoPage />} />
            <Route path="/cells-demo2" element={<CellsDemoPage2 />} />
          </Routes>
        </HashRouter>
      </div>
    </div>
  );
};

export default QuillPage;
