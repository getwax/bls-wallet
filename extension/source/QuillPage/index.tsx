import ReactDOM from 'react-dom';

import '../contentScript';
import '../styles/index.scss';
import './styles.scss';
import Browser from 'webextension-polyfill';
import QuillEthereumProvider from '../QuillEthereumProvider';
import QuillPage from './QuillPage';

window.ethereum = new QuillEthereumProvider(true);

window.debug ??= {};
window.debug.Browser = Browser;

ReactDOM.render(<QuillPage />, document.getElementById('quill-page-root'));
