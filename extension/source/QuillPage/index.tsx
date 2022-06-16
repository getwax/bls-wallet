import ReactDOM from 'react-dom';
import Browser from 'webextension-polyfill';

import '../ContentScript';
import '../styles/index.scss';
import './styles.scss';
import QuillPage from './QuillPage';

window.Browser ??= Browser;

ReactDOM.render(<QuillPage />, document.getElementById('quill-page-root'));
