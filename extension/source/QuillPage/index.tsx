import ReactDOM from 'react-dom';

import '../ContentScript';
import '../styles/index.scss';
import './styles.scss';
import QuillPage from './QuillPage';
import Browser from 'webextension-polyfill';

(window as any).Browser ??= Browser;

ReactDOM.render(<QuillPage />, document.getElementById('quill-page-root'));
