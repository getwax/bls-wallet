import '../ContentScript';
import '../PageContentScript';

import ReactDOM from 'react-dom';

import QuillPage from './QuillPage';
import QuillContext from './QuillContext';

import '../styles/index.scss';
import './styles.scss';

const quillContext = new QuillContext((window as any).ethereum);

ReactDOM.render(
  <QuillContext.Provider value={quillContext}>
    <QuillPage />
  </QuillContext.Provider>,
  document.getElementById('quill-page-root'),
);
