import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";

export function ChipInput({
  value = [],
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
  maxChips = 20
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  );

  function addChip(item) {
    const trimmed = item.trim();
    if (trimmed && !value.includes(trimmed) && value.length < maxChips) {
      onChange([...value, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  }

  function removeChip(chip) {
    onChange(value.filter(c => c !== chip));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeChip(value[value.length - 1]);
    }
  }

  return (
    <div className="chip-input" ref={containerRef}>
      <div className="chip-input-field">
        <AnimatePresence>
          {value.map((chip) => (
            <motion.span
              key={chip}
              className="chip"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              {chip}
              <button
                type="button"
                className="chip-remove"
                onClick={() => removeChip(chip)}
                aria-label={`Remove ${chip}`}
              >
                <X size={12} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="chip-input-input"
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="chip-suggestions">
          {filteredSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip-suggestion"
              onClick={() => addChip(suggestion)}
            >
              <Plus size={14} /> {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
