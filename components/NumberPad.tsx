import React from 'react';
import { Delete, Check } from 'lucide-react';

interface NumberPadProps {
  onInput: (val: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  value: string;
  disabled?: boolean;
}

const NumberPad: React.FC<NumberPadProps> = ({ onInput, onDelete, onSubmit, value, disabled }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지우기', '0', '확인'];

  const handlePress = (key: string) => {
    if (disabled) return;
    if (key === '지우기') {
      onDelete();
    } else if (key === '확인') {
      onSubmit();
    } else {
      // 휴대폰 번호 뒷자리 8자리까지 입력
      if (value.length < 8) {
        onInput(key);
      }
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[340px] mx-auto">
      {keys.map((key) => {
        const isAction = key === '확인';
        const isDelete = key === '지우기';
        
        return (
          <button
            key={key}
            onClick={() => handlePress(key)}
            disabled={disabled || (isAction && value.length < 8)}
            className={`
              h-16 rounded-2xl text-2xl font-medium transition-all duration-200 active:scale-95 flex items-center justify-center select-none shadow-sm
              ${isAction 
                ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none shadow-brand-200' 
                : isDelete 
                  ? 'bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600' 
                  : 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-100 hover:border-gray-200'
              }
            `}
          >
            {isDelete ? <Delete size={28} strokeWidth={2} /> : isAction ? <Check size={32} strokeWidth={3} /> : key}
          </button>
        );
      })}
    </div>
  );
};

export default NumberPad;
