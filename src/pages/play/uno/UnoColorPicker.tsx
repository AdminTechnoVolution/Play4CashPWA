import type { UnoColor } from '../../../data/models/ApiModels';
import { UNO_COLOR_BG } from './unoCardModel';

interface UnoColorPickerProps {
  open: boolean;
  title: string;
  cancelLabel: string;
  onPick: (color: UnoColor) => void;
  onCancel: () => void;
  labels: Record<UnoColor, string>;
}

/**
 * Modal overlay that appears when the player attempts to play a Wild or Wild +4.
 * Four large color buttons + a cancel link. Closes via either action.
 */
export default function UnoColorPicker({ open, title, cancelLabel, onPick, onCancel, labels }: UnoColorPickerProps) {
  if (!open) return null;
  const colors: UnoColor[] = ['R', 'G', 'B', 'Y'];
  return (
    <div className="uno-color-picker" role="dialog" aria-label={title}>
      <div className="uno-color-picker__title">{title}</div>
      <div className="uno-color-picker__grid">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className="uno-color-picker__btn"
            style={{ background: UNO_COLOR_BG[c] }}
            onClick={() => onPick(c)}
          >
            {labels[c]}
          </button>
        ))}
      </div>
      <button type="button" className="uno-color-picker__cancel" onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}
