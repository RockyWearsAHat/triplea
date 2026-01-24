import * as React from "react";
import ui from "@shared/styles/primitives.module.scss";

export function FormField({
  label,
  help,
  error,
  children,
  required,
}: {
  label?: string;
  help?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className={ui.field}>
      {label ? (
        <label className={ui.label}>
          {label}
          {required ? " *" : null}
        </label>
      ) : null}
      {children}
      {help && !error ? <div className={ui.help}>{help}</div> : null}
      {error ? <div className={ui.error}>{error}</div> : null}
    </div>
  );
}

export default FormField;
