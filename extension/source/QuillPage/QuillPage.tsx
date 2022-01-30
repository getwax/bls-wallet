import * as React from 'react';

import OnboardingPage from './components/OnboardingPage';

// Note: This is for demo purposes only while building the ui. This is not how
// navigation will work.
const pageNumber = Number(
  new URL(window.location.href).searchParams.get('p') ?? '1',
);

const QuillPage: React.FunctionComponent = () => (
  <OnboardingPage pageIndex={pageNumber - 1} />
);

export default QuillPage;
