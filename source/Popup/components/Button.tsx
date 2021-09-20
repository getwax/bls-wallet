import * as React from 'react';

const Button = (props: {
  onPress: () => void;
  highlight?: boolean;
  children?: React.ReactNode;
}): React.ReactElement => (
  <div
    className={props.highlight ? 'button highlight' : 'button'}
    onClick={props.onPress}
    onKeyDown={(evt) => {
      if (evt.code === 'Enter') {
        props.onPress();
      }
    }}
  >
    {props.children}
  </div>
);

export default Button;
