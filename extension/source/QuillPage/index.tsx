import ReactDOM from 'react-dom';

import '../contentScript';
import '../ethereum';
import '../styles/index.scss';
import './styles.scss';
import Browser from 'webextension-polyfill';
import QuillPage from './QuillPage';

(window as any).Browser ??= Browser;

ReactDOM.render(<QuillPage />, document.getElementById('quill-page-root'));
