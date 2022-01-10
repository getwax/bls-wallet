import * as React from 'react';
import TaskQueue from '../../common/TaskQueue';
import delay from '../../helpers/delay';

// eslint-disable-next-line @typescript-eslint/ban-types
type Props = {
  images: string[];
};

// eslint-disable-next-line @typescript-eslint/ban-types
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
    const intervalId = setInterval(() => {
      this.nextImage();
    }, 5000);

    this.cleanupTasks.push(() => {
      clearInterval(intervalId);
    });
  }

  componentWillUnmount() {
    this.cleanupTasks.run();
  }

  async nextImage() {
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
            <div className="radio">
              <div className="radio-filler" />
            </div>
            <div className="radio" />
            <div className="radio" />
          </div>
        </div>
      </div>
    );
  }
}
