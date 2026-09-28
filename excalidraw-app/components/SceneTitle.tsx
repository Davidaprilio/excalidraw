import { useEffect, useState } from "react";

/** Scene name in the editor's top-right bar; click to rename. */
export function SceneTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  useEffect(() => {
    if (!editing) {
      setValue(title);
    }
  }, [title, editing]);

  const submit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed).catch(() => setValue(title));
    } else {
      setValue(title);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Scene name"
        className="app-scene-title app-scene-title--editing"
        value={value}
        maxLength={255}
        onFocus={(event) => event.target.select()}
        onChange={(event) => setValue(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          // keep Excalidraw's shortcuts from firing while typing
          event.stopPropagation();
          if (event.key === "Enter") {
            submit();
          } else if (event.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="app-scene-title"
      title={`${title} (click to rename)`}
      onClick={() => setEditing(true)}
    >
      {value}
    </button>
  );
}
