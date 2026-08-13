import type { InputHTMLAttributes } from "react";
import "./Field.css";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helper?: string;
  error?: string;
}

/** 문서02 §4.3: "검증 오류는 해당 Field 아래에 구체적으로 표시한다." */
export function Field({ label, helper, error, id, ...rest }: Props) {
  const fieldId = id ?? label;
  return (
    <div className="app-field">
      <label htmlFor={fieldId} className="app-field__label">
        {label}
      </label>
      <input id={fieldId} className={`app-field__input${error ? " has-error" : ""}`} aria-invalid={!!error} {...rest} />
      {error ? (
        <p className="app-field__error">{error}</p>
      ) : helper ? (
        <p className="app-field__helper">{helper}</p>
      ) : null}
    </div>
  );
}
