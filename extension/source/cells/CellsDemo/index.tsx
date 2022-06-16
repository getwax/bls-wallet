import ReactDOM from 'react-dom';
import Browser from 'webextension-polyfill';

import '../../ContentScript';
import '../../styles/index.scss';
import '../../QuillPage/styles.scss';
import DemosContainer from './DemosContainer';

window.Browser ??= Browser;

ReactDOM.render(<DemosContainer />, document.getElementById('cells-demo-root'));
