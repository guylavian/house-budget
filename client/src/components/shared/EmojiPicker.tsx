interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const EMOJI_GROUPS = [
  {
    label: 'כסף והכנסות',
    emojis: ['💰','💵','💴','💶','💷','💸','🏦','📈','💳','🪙','💎','🤑'],
  },
  {
    label: 'אוכל ושתייה',
    emojis: ['🛒','🏪','🍽️','🍕','🍔','🥗','☕','🍺','🥐','🍣','🛍️','🧃'],
  },
  {
    label: 'בית ודיור',
    emojis: ['🏠','🏘️','🔑','🛋️','🪑','🛏️','🪴','🔧','🏗️','🏢','⚡','💧'],
  },
  {
    label: 'תחבורה',
    emojis: ['🚗','✈️','🚌','🚂','⛽','🛵','🚲','🚕','🛳️','🚁','🛞','🅿️'],
  },
  {
    label: 'בריאות',
    emojis: ['💊','🏥','🩺','💉','🩹','🧬','🏋️','🧘','❤️','🦷','👓','🌡️'],
  },
  {
    label: 'חינוך ועבודה',
    emojis: ['📚','🎓','✏️','💼','🖥️','📱','🖨️','📐','🔬','📝','🏫','🎯'],
  },
  {
    label: 'בידור ופנאי',
    emojis: ['🎬','🎮','🎵','📺','🎭','🎨','🏖️','⚽','🎸','🎲','🎪','🏄'],
  },
  {
    label: 'קניות וביגוד',
    emojis: ['👕','👗','👠','👟','🧥','💄','💍','🕶️','👜','🧴','🎁','🏷️'],
  },
  {
    label: 'חיסכון ואחר',
    emojis: ['🐷','🔒','📦','↔️','🔄','💵','🪣','🎯','⭐','✅','❓','📊'],
  },
];

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="space-y-3">
      {/* Current selection */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 flex items-center justify-center rounded-xl border-2 border-blue-300 bg-blue-50 text-3xl">
          {value || '📦'}
        </div>
        <span className="text-sm text-gray-500">אייקון נבחר</span>
      </div>

      {/* Emoji groups */}
      <div className="max-h-52 overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-2">
        {EMOJI_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-xs text-gray-400 mb-1 px-1">{group.label}</p>
            <div className="flex flex-wrap gap-0.5">
              {group.emojis.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onChange(emoji)}
                  className={`text-xl p-1 rounded cursor-pointer transition-colors ${
                    value === emoji
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Manual input */}
      <input
        type="text"
        placeholder="הקלד אימוג'י..."
        maxLength={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-center text-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
