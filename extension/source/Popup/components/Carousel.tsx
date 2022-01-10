import * as React from 'react';
import { Mutex } from 'async-mutex';

import TaskQueue from '../../common/TaskQueue';
import delay from '../../helpers/delay';

type Props = {
  images: string[];
};

type State = {
  imageA: {
    index: number;
    position: 'left' | 'middle' | 'right';
    resetting: boolean;
  };
  imageB: {
    index: number;
    position: 'left' | 'middle' | 'right';
    resetting: boolean;
  };
};

const positionMap = {
  left: 71 - 516,
  middle: 71,
  right: 71 + 516,
};

export default class Carousel extends React.Component<Props, State> {
  cleanupTasks = new TaskQueue();
  intervalId = -1;
  transitionMutex = new Mutex();

  constructor(props: Props) {
    super(props);

    this.state = {
      imageA: {
        index: 0,
        position: 'middle',
        resetting: false,
      },
      imageB: {
        index: 1,
        position: 'right',
        resetting: false,
      },
    };
  }

  componentDidMount() {
    this.intervalId = setInterval(() => {
      this.transitionImage();
    }, 5000) as unknown as number;

    this.cleanupTasks.push(() => {
      clearInterval(this.intervalId);
    });
  }

  componentWillUnmount() {
    this.cleanupTasks.run();
  }

  async transitionImage(index?: number) {
    const releaseMutex = await this.transitionMutex.acquire();

    let primaryImageKey: 'imageA' | 'imageB';
    let secondaryImageKey: 'imageA' | 'imageB';

    if (this.state.imageA.position === 'middle') {
      primaryImageKey = 'imageA';
      secondaryImageKey = 'imageB';
    } else {
      primaryImageKey = 'imageB';
      secondaryImageKey = 'imageA';
    }

    this.setState({
      ...this.state,
      [primaryImageKey]: {
        ...this.state[primaryImageKey],
        position: 'left',
      },
      [secondaryImageKey]: {
        ...this.state[secondaryImageKey],
        position: 'middle',
        ...(index === undefined
          ? {}
          : {
              index,
            }),
      },
    });

    await delay(550);

    this.setState({
      ...this.state,
      [primaryImageKey]: {
        ...this.state[primaryImageKey],
        resetting: true,
        position: 'right',
        index:
          (this.state[primaryImageKey].index + 2) % this.props.images.length,
      },
    });

    await delay(50);

    this.setState({
      ...this.state,
      [primaryImageKey]: {
        ...this.state[primaryImageKey],
        resetting: false,
      },
    });

    releaseMutex();
  }

  render(): React.ReactNode {
    return (
      <div className="carousel">
        <div className="image-container">
          <div
            className="image-slider"
            key="A"
            style={{
              left: `${positionMap[this.state.imageA.position]}px`,
              ...(this.state.imageA.resetting
                ? { transition: 'none', visibility: 'hidden' }
                : {}),
            }}
          >
            <img
              src={this.props.images[this.state.imageA.index]}
              width="258"
              height="215"
              alt="artwork"
            />
          </div>
          <div
            className="image-slider"
            key="B"
            style={{
              left: `${positionMap[this.state.imageB.position]}px`,
              ...(this.state.imageB.resetting
                ? { transition: 'none', visibility: 'hidden' }
                : {}),
            }}
          >
            <img
              src={this.props.images[this.state.imageB.index]}
              width="258"
              height="215"
              alt="artwork"
            />
          </div>
        </div>
        <div className="radios-section">
          <div className="radios-container">
            {this.props.images.map((imgSrc, i) => {
              const fillerClasses = ['radio-filler'];

              if (
                (this.state.imageA.position === 'middle' &&
                  this.state.imageA.index === i) ||
                (this.state.imageB.position === 'middle' &&
                  this.state.imageB.index === i)
              ) {
                fillerClasses.push('active');
              }

              return (
                <div
                  className="radio"
                  key={imgSrc}
                  onClick={() => {
                    clearInterval(this.intervalId);
                    this.transitionImage(Number(i));
                  }}
                  onKeyDown={(evt) => {
                    if (['Space', 'Enter'].includes(evt.code)) {
                      clearInterval(this.intervalId);
                      this.transitionImage(Number(i));
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
  }
}
