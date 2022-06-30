import { FunctionComponent, useEffect, useState } from 'react';

/**
 * Just shows `Loading...` after 200ms. This is highly preferable to simply
 * displaying `Loading...` unconditionally, because things that load fast
 * shouldn't flash a loading state first.
 */
const Loading: FunctionComponent = () => {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setShowLoading(true);
    }, 200);

    return () => clearTimeout(timerId);
  }, []);

  return <>{showLoading ? 'Loading...' : ''}</>;
};

export default Loading;
