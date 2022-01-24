import { IconProps } from 'phosphor-react';
import * as React from 'react';

const Button = (props: {
  className?: string;
  onPress: () => void;
  highlight?: boolean; // TODO - remove dependency
  loading?: boolean;
  children?: React.ReactNode;
  icon?: IconProps;
}): React.ReactElement => {
  return (
    <div
      className={
        props.loading
          ? 'btn-loading'
          : `flex gap-2 items-center ${props.className}`
      }
      onClick={props.onPress}
      onKeyDown={(evt) => {
        if (evt.code === 'Enter') {
          props.onPress();
        }
      }}
    >
      <div>{props.children}</div>
      {props.icon && <div>{props.icon}</div>}
    </div>
  );
};

export default Button;
