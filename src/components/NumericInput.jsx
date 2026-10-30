import React, { forwardRef, useEffect, useRef, useState } from 'react';

/** Numeric editor that lets users clear/replace a value and type decimals naturally. */
const NumericInput = forwardRef(function NumericInput({ type, value, defaultValue, onChange, onBlur, onFocus, ...props }, forwardedRef) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue == null ? '' : String(defaultValue));
  const currentValue = controlled ? value : internalValue;
  const [draft, setDraft] = useState(currentValue == null ? '' : String(currentValue));
  const [editing, setEditing] = useState(false);
  const localRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(currentValue == null ? '' : String(currentValue));
  }, [currentValue, editing]);

  return (
    <input
      {...props}
      ref={(node) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      type="text"
      inputMode={props.inputMode || (props.step === '1' || props.step === 1 ? 'numeric' : 'decimal')}
      value={editing ? draft : (currentValue == null ? '' : String(currentValue))}
      onFocus={(event) => {
        setEditing(true);
        setDraft(currentValue == null ? '' : String(currentValue));
        onFocus?.(event);
        if (Number(currentValue) === 0) requestAnimationFrame(() => event.target.select());
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/[\s,]/g, '');
        const integerOnly = props.step === '1' || props.step === 1;
        let next = raw.replace(integerOnly ? /[^0-9]/g : /[^0-9.]/g, '');
        if (!integerOnly && (next.match(/\./g) || []).length > 1) {
          const firstDot = next.indexOf('.');
          next = `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, '')}`;
        }
        if (event.target.value !== next) event.target.value = next;
        setDraft(next);
        if (!controlled) setInternalValue(next);
        onChange?.(event);
      }}
      onBlur={(event) => {
        setEditing(false);
        onBlur?.(event);
      }}
    />
  );
});

export default NumericInput;
