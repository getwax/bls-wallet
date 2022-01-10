import * as React from 'react';

// eslint-disable-next-line @typescript-eslint/ban-types
type Props = {
  images: string[];
};

// eslint-disable-next-line @typescript-eslint/ban-types
type State = {};

export default class Carousel extends React.Component<Props, State> {
  render(): React.ReactNode {
    return (
      <div className="carousel">
        <div className="image-container">
          <div className="image-slider">
            {this.props.images.map((imgSrc) => (
              <div key={imgSrc}>
                <img src={imgSrc} width="258" height="215" alt="artwork" />
              </div>
            ))}
          </div>
        </div>
        <div className="radios-container">Radios...</div>
      </div>
    );
  }
}
