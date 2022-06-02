import { IconProps } from 'phosphor-react';
import { ReactElement, ReactNode } from 'react';

const Button = (props: {
  className?: string;
  onPress: () => void;
  loading?: boolean;
  children?: ReactNode;
  icon?: IconProps;
}): ReactElement => {
  return (
    <div
      className={
        props.loading
          ? 'btn-loading'
          : `flex gap-2 items-center select-none ${props.className}`
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
