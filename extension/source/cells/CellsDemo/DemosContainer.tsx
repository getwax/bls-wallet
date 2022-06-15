import React, { FunctionComponent } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { QuillProvider } from '../../QuillPage/QuillContext';
import Theme from '../../QuillPage/Theme';
import { CellsDemoPage } from './CellsDemoPage';
import { CellsDemoPage2 } from './CellsDemoPage2';

const DemosContainer: FunctionComponent = () => {
  return (
    <QuillProvider>
      <Theme>
        <HashRouter>
          <Routes>
            <Route path="/demo2" element={<CellsDemoPage2 />} />
            <Route path="*" element={<CellsDemoPage />} />
          </Routes>
        </HashRouter>
      </Theme>
    </QuillProvider>
  );
};

export default DemosContainer;
