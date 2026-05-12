import type { CSSProperties } from 'react';

/** Back of a UNO card. Same dimensions as `UnoCard`, no perspective interaction. */
export default function UnoCardBack({ style }: { style?: CSSProperties }) {
  return (
    <div className="uno-card-back" style={style}>
      <div className="uno-card-back__oval">
        <span className="uno-card-back__logo">UNO</span>
      </div>
    </div>
  );
}
