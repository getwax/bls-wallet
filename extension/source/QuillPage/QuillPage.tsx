import * as React from 'react';

import OnboardingPage from './components/OnboardingPage';

const pageNumber = Number(
  new URL(window.location.href).searchParams.get('p') ?? '1',
);

const QuillPage: React.FunctionComponent = () => (
  <OnboardingPage pageIndex={pageNumber - 1} />
);

export default QuillPage;
