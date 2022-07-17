import { FunctionComponent, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';
import Loading from '../components/Loading';
import { useQuill } from '../QuillContext';

const LoadingPage: FunctionComponent = () => {
  const navigate = useNavigate();
  const quill = useQuill();

  useEffect(() => {
    quill.cells.onboarding.read().then((onboarding) => {
      if (!onboarding.completed) {
        navigate('/onboarding');
      } else {
        navigate('/wallets');
      }
    });
  }, [navigate, quill]);

  return <Loading />;
};

export default LoadingPage;
