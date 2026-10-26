type Option = {
  value: string;
  label: string;
};

type DateFieldProps = {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function DateField({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: DateFieldProps) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select
        className="field__select"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
