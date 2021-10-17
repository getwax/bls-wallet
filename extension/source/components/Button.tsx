import * as React from 'react';

const Button = (props: {
  onPress: () => void;
  highlight?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}): React.ReactElement => {
  const classes = ['button'];

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
      {props.children}
    </div>
  );
};

export default Button;
