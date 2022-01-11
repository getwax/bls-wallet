import * as React from 'react';
import { Mutex } from 'async-mutex';

import delay from '../../helpers/delay';

type ImageState = {
  index: number;
  position: 'left' | 'middle' | 'right';
};

const positionMap = {
  left: 71 - 516,
  middle: 71,
  right: 71 + 516,
};

function useGetSet<T>(initialValue: T) {
  const [, reactSetValue] = React.useState(initialValue);

  let value = initialValue;

  return {
    get: () => value,
    set: (newValue: T) => {
      value = newValue;
      reactSetValue(newValue);
    },
    update: (partialNewValue: Partial<T>) => {
      value = { ...value, partialNewValue };
      reactSetValue(value);
    },
  };
}

const ImageSlider: React.FunctionComponent<{
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
        ...(resetting ? { transition: 'none', visibility: 'hidden' } : {}),
      }}
    >
      <img src={url} width="258" height="215" alt="artwork" />
    </div>
  );
};

const Carousel: React.FunctionComponent<{
  images: string[];
}> = ({ images }) => {
  const imageA = useGetSet<ImageState>({
    index: 0,
    position: 'middle',
  });

  const imageB = useGetSet<ImageState>({
    index: 1,
    position: 'right',
  });

  const [resetting, setResetting] = React.useState(false);
  const [transitionMutex] = React.useState(new Mutex());
  const [intervalId, setIntervalId] = React.useState(-1);

  const transitionImage = React.useCallback(
    (index?: number) => {
      (async () => {
        const releaseMutex = await transitionMutex.acquire();

        const indexUpdate = { index: index ?? imageB.get().index };
        console.log(JSON.stringify({ index, indexUpdate }));

        imageA.update({ position: 'left' });
        imageB.update({ position: 'middle', ...indexUpdate });

        await delay(550);

        setResetting(true);
        imageA.update({ position: 'middle', ...indexUpdate });

        const newImageB: ReturnType<typeof imageB['get']> = {
          ...imageB.get(),
          position: 'right',
          index: (imageB.get().index + 1) % images.length,
        };

        imageB.update(newImageB);

        console.log(newImageB);

        await delay(50);

        setResetting(false);

        releaseMutex();
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageA, imageB],
  );

  React.useEffect(() => {
    console.log('Running useEffect');
    setIntervalId(setInterval(transitionImage, 5000) as unknown as number);

    return () => clearInterval(intervalId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log(
    'rendering',
    JSON.stringify({
      imageA: imageA.get(),
      imageB: imageB.get(),
    }),
  );

  return (
    <div className="carousel">
      <div className="image-container">
        <ImageSlider
          url={images[imageA.get().index]}
          position={imageA.get().position}
          resetting={resetting}
        />
        <ImageSlider
          url={images[imageB.get().index]}
          position={imageB.get().position}
          resetting={resetting}
        />
      </div>
      <div className="radios-section">
        <div className="radios-container">
          {images.map((imgSrc, i) => {
            const fillerClasses = ['radio-filler'];

            if (
              (imageA.get().position === 'middle' &&
                imageA.get().index === i) ||
              (imageB.get().position === 'middle' && imageB.get().index === i)
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
