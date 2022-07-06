import { IconProps } from 'phosphor-react';
import { ReactElement, ReactNode, useState } from 'react';
import onAction from '../helpers/onAction';

const Button = (props: {
  className?: string;
  onPress: () => unknown;
  loading?: boolean;
  children?: ReactNode;
  icon?: IconProps;
}): ReactElement => {
  const [pressLoading, setPressLoading] = useState(false);

  return (
    <div
      className={
        props.loading || pressLoading
          ? 'btn-loading'
          : `flex gap-2 items-center select-none ${props.className}`
      }
      {...onAction(async () => {
        const pressResult = props.onPress();

        if (pressResult instanceof Promise) {
          setPressLoading(true);

          try {
            await pressResult;
          } catch (err) {
            // Enhancement: Give the button an error state
            console.error(err);
          } finally {
            setPressLoading(false);
          }
        }
      })}
    >
      <div>{props.children}</div>
      {props.icon && <div>{props.icon}</div>}
    </div>
  );
};

export default Button;
