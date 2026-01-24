import React from "react";
import styles from "./SearchBar.module.scss";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (q: string) => void;
}

export function SearchBar({ placeholder = "Search…", onSearch }: SearchBarProps) {
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSearch?.((e.target as HTMLInputElement).value);
  }

  return (
    <div className={styles.searchBar}>
      <input className={styles.input} placeholder={placeholder} onKeyDown={handleKey} />
    </div>
  );
}

export default SearchBar;
