import { runtime, tabs } from 'webextension-polyfill';

// import ReactDOM from 'react-dom';

// import './styles.scss';
// import '../styles/index.scss';
// import WelcomeScreen from './components/WelcomeScreen';

// ReactDOM.render(<WelcomeScreen />, document.getElementById('popup-root'));

// We're not currently using the popup for anything, so just go straight to the
// full view and close ourselves.
tabs.create({
  url: runtime.getURL('home.html'),
});

window.close();
