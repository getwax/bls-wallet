import * as React from "react";

const PasswordStrengthMeter: React.FunctionComponent<{ strength: number }> = ({
  strength,
}) => {
  const [color, setColor] = React.useState("bg-alert-500");

  const getColor = (strength: number) => {
    if (strength < 50) {
      return "bg-alert-500";
    } else if (strength >= 50 && strength < 75) {
      return "bg-neutral-500";
    } else {
      return "bg-positive-500";
    }
  };

  React.useEffect(() => {
    setColor(getColor(strength));
  }, [strength]);

  return (
    <div className="mt-4 text-grey-500">
      Password strength
      <div
        className={`h-1 my-2 w-full rounded-md ${color}`}
        style={{ width: `${strength}%` }}
      />
    </div>
  );
};

const PasswordCreationForm: React.FunctionComponent = () => (
  <div className="password-creation-form quick-column">
    <div className="flex flex-col">
      <input type="password" placeholder="Password" className="input" />
      <input
        type="password"
        placeholder="Confirm password"
        className="input mt-2 disabled:input-filled"
        disabled
      />
      <PasswordStrengthMeter strength={100} />
    </div>
  </div>
);

export default PasswordCreationForm;
