import ReactDOM from 'react-dom';

import '../ContentScript';
import '../styles/index.scss';
import './styles.scss';
import QuillPage from './QuillPage';

ReactDOM.render(<QuillPage />, document.getElementById('quill-page-root'));
