import React, { useEffect, useId, useRef, useState } from "react";
import {
  getGuardianSettingLabel,
  getNextDropdownIndex,
} from "../state/guardianSettingOptions";

export default function GuardianSettingDropdown({
  fieldKey,
  label,
  value,
  options,
  onChange,
  disabled,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => String(option) === String(value))
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  const openMenu = (index = selectedIndex) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const selectOption = (index) => {
    onChange(options[index]);
    setActiveIndex(index);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      openMenu(getNextDropdownIndex(event.key, selectedIndex, options.length));
    }
  };

  const handleOptionKeyDown = (event, index) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActiveIndex(getNextDropdownIndex(event.key, index, options.length));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(index);
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="setting-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`setting-dropdown-trigger${isOpen ? " open" : ""}`}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
      >
        <span className="setting-dropdown-value">
          {getGuardianSettingLabel(fieldKey, value)}
        </span>
        <span className="setting-dropdown-chevron" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div id={listId} className="setting-dropdown-menu" role="listbox" aria-label={label}>
          {options.map((option, index) => {
            const isSelected = String(value) === String(option);
            return (
              <button
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                key={String(option)}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={activeIndex === index ? 0 : -1}
                className={`setting-dropdown-item${isSelected ? " selected" : ""}`}
                onClick={() => selectOption(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                disabled={disabled}
              >
                <span>{getGuardianSettingLabel(fieldKey, option)}</span>
                {isSelected ? (
                  <span className="setting-dropdown-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
