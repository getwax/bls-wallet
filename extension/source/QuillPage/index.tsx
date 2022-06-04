import '../ContentScript';
import '../styles/index.scss';
import './styles.scss';

import ReactDOM from 'react-dom';

import QuillPage from './QuillPage';
import QuillContext from './QuillContext';
import getWindowEthereum from './getWindowEthereum';
import Browser from 'webextension-polyfill';

(window as any).Browser ??= Browser;

getWindowEthereum().then((ethereum) => {
  const quillContext = new QuillContext(ethereum);

  ReactDOM.render(
    <QuillContext.Provider value={quillContext}>
      <QuillPage />
    </QuillContext.Provider>,
    document.getElementById('quill-page-root'),
  );
});
