import { avatarColor, initialsFor } from '../lib/constants';

export function Avatar({
  name,
  avatar,
  size = 40,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  const { bg, fg } = avatarColor(avatar);
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold select-none shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: Math.max(11, size * 0.38),
      }}
      aria-hidden
    >
      {initialsFor(name)}
    </div>
  );
}