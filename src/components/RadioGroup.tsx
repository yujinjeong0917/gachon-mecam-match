import "./RadioGroup.css";

interface Props {
  label: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function RadioGroup({ label, name, options, value, onChange }: Props) {
  return (
    <fieldset className="app-radio-group">
      <legend className="app-radio-group__label">{label}</legend>
      <div className="app-radio-group__options">
        {options.map((option) => (
          <label key={option} className={`app-radio-group__option${value === option ? " is-selected" : ""}`}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
