import * as React from 'react';

const Button = (props: {
  onPress: () => void;
  highlight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  icon?: {
    src: string;
    px: number;
  };
}): React.ReactElement => {
  const classes = ['button'];

  if (props.highlight) {
    classes.push('highlight');
  }

  if (props.loading) {
    classes.push('loading');
  }

  if (props.disabled) {
    classes.push('disabled');
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
      {(() => {
        if (!props.icon) {
          return props.children;
        }

        return (
          <div className="icon-button-content">
            <div>{props.children}</div>
            <div
              className="icon-button-icon"
              style={{
                background: `no-repeat center url(${props.icon.src})`,
              }}
            />
          </div>
        );
      })()}
    </div>
  );
};

export default Button;
