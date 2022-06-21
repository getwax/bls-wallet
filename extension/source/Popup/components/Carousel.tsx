import { FunctionComponent, useState, useEffect } from 'react';
import { Mutex } from 'async-mutex';

import delay from '../../helpers/delay';

type Position = 'left' | 'middle' | 'right';

const positionMap = {
  left: 71 - 516,
  middle: 71,
  right: 71 + 516,
};

const ImageSlider: FunctionComponent<{
  url: string;
  position: 'left' | 'middle' | 'right';
  resetting: boolean;
}> = ({ url, position, resetting }) => {
  return (
    <div
      className="image-slider"
      key="A"
      style={{
        left: `${positionMap[position]}px`,
        ...(resetting ? { transition: 'none' } : {}),
      }}
    >
      <img src={url} width="258" height="215" alt="artwork" />
    </div>
  );
};

const Carousel: FunctionComponent<{
  images: string[];
}> = ({ images }) => {
  const [imageAIndex, setImageAIndex] = useState(0);
  const [imageAPosition, setImageAPosition] = useState<Position>('middle');

  const [imageBIndex, setImageBIndex] = useState(1);
  const [imageBPosition, setImageBPosition] = useState<Position>('right');

  const [resetting, setResetting] = useState(false);
  const [transitionMutex] = useState(new Mutex());
  const [intervalId, setIntervalId] = useState(-1);

  const transitionImage = async (index: number) => {
    const releaseMutex = await transitionMutex.acquire();

    setImageAPosition('left');
    setImageBIndex(index);
    setImageBPosition('middle');

    await delay(550);

    setResetting(true);

    setImageAIndex(index);
    setImageAPosition('middle');
    setImageBPosition('right');

    await delay(50);

    setResetting(false);

    releaseMutex();
  };

  useEffect(() => {
    console.log('Running useEffect');
    let index = 0;
    setIntervalId(
      setInterval(() => {
        index = (index + 1) % images.length;
        transitionImage(index);
      }, 5000) as unknown as number,
    );

    return () => clearInterval(intervalId);

    /* eslint react-hooks/exhaustive-deps: "warn" -- TODO (merge-ok) Add hook deps */
  }, []);

  return (
    <div className="carousel">
      <div className="image-container">
        <ImageSlider
          url={images[imageAIndex]}
          position={imageAPosition}
          resetting={resetting}
        />
        <ImageSlider
          url={images[imageBIndex]}
          position={imageBPosition}
          resetting={resetting}
        />
      </div>
      <div className="radios-section">
        <div className="radios-container">
          {images.map((imgSrc, i) => {
            const fillerClasses = ['radio-filler'];

            if (
              (imageAPosition === 'middle' && imageAIndex === i) ||
              (imageBPosition === 'middle' && imageBIndex === i)
            ) {
              fillerClasses.push('active');
            }

            return (
              <div
                className="radio"
                key={imgSrc}
                onClick={() => {
                  clearInterval(intervalId);
                  transitionImage(Number(i));
                }}
                onKeyDown={(evt) => {
                  if (['Space', 'Enter'].includes(evt.code)) {
                    clearInterval(intervalId);
                    transitionImage(Number(i));
                  }
                }}
              >
                <div className={fillerClasses.join(' ')} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Carousel;
