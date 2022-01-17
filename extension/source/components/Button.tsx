import { IconProps } from 'phosphor-react';
import * as React from 'react';

const Button = (props: {
  onPress: () => void;
  highlight?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  icon?: IconProps
}): React.ReactElement => {
  const classes = ['btn-primary'];

  if (props.highlight) {
    classes.push('highlight');
  }

  if (props.loading) {
    classes.push('loading');
  }

  return (
    <div
      className={classes.join(' ')}
      onClick={props.onPress}
      onKeyDown={(evt) => {
        if (evt.code === 'Enter') {
          props.onPress();
        }
      }}
    >
      <div className="flex gap-2 items-center">
        <div>{props.children}</div>
        {props.icon && <div>{props.icon}</div>}
      </div>
    </div>
  );
};

export default Button;
